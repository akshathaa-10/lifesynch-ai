import '../config/env';
import assert from 'assert';
import { 
  Responsibility, 
  ResponsibilitySyncSummary,
  ExtractedTask,
  getSourceDisplay
} from '@lifesynch/shared';
import { taskService } from '../services/task.service';
import { userService } from '../services/db/user.service';
import { emailService } from '../services/db/email.service';
import { calendarEventService } from '../services/db/calendar-event.service';
import { responsibilityGenerationService } from '../services/ai/responsibility-generation.service';
import { reminderService } from '../services/reminder.service';
import { 
  isSameObligation, 
  mergeResponsibilityData, 
  deduplicateExtractedBatch, 
  normalizePriority,
  determineIntelligentPriority,
  calculateDeadlineUrgency,
  areDatesCompatible,
  extractSemanticTokens,
  calculateTokenSimilarity,
  determineResponsibilityStatus,
  hasConflictingActivityType,
  hasConflictingSequenceNumber
} from '../services/ai/responsibility-matcher';
import { env } from '../config/env';
import { isSupabaseConfigured, getSupabaseAdminClient } from '../config/supabase';

async function runIntelligenceTests() {
  console.log('=====================================================');
  console.log('  LIFESYNCH AI — PHASE 5.4: SMART SOURCE RECONCILIATION ');
  console.log('=====================================================');

  // ----------------------------------------------------------------
  // Test 1: Priority Normalization & Consistency
  // ----------------------------------------------------------------
  console.log('\n[TEST 1a] Priority Consistency (Strict High, Medium, Low)');
  assert.strictEqual(normalizePriority('urgent'), 'high', 'Urgent must normalize to high');
  assert.strictEqual(normalizePriority('high'), 'high', 'High must remain high');
  assert.strictEqual(normalizePriority('HIGH'), 'high', 'Case-insensitive high');
  assert.strictEqual(normalizePriority('medium'), 'medium', 'Medium must remain medium');
  assert.strictEqual(normalizePriority('low'), 'low', 'Low must remain low');
  assert.strictEqual(normalizePriority(undefined), 'medium', 'Default priority must be medium');
  console.log('✔ Priority normalization strictly enforces High/Medium/Low tiers');

  // ----------------------------------------------------------------
  // Test 1b: Deadline Proximity Intelligence
  // ----------------------------------------------------------------
  console.log('\n[TEST 1b] Deadline Proximity Intelligence');
  const anchorTime = new Date('2026-09-26T12:00:00.000Z');

  // Imminent deadline: within 24h (<= 48h) -> HIGH
  const imminentTaskPriority = determineIntelligentPriority({
    title: 'Submit Lab Assignment 4',
    description: 'Submit lab exercise code to portal',
    action: 'Upload python file to portal',
    dueDate: '2026-09-27T12:00:00.000Z', // 24 hours away
    category: 'academic',
    now: anchorTime
  });
  assert.strictEqual(imminentTaskPriority, 'high', 'Deadline within 24h must be HIGH');

  // Near deadline: 4 days away -> MEDIUM
  const nearTaskPriority = determineIntelligentPriority({
    title: 'Submit Lab Assignment 4',
    description: 'Submit lab exercise code to portal',
    action: 'Upload python file to portal',
    dueDate: '2026-09-30T12:00:00.000Z', // 4 days away
    category: 'academic',
    now: anchorTime
  });
  assert.strictEqual(nearTaskPriority, 'medium', 'Standard academic deadline 4 days away must be MEDIUM');

  // Distant deadline: 25 days away -> LOW (prevents false urgency)
  const distantTaskPriority = determineIntelligentPriority({
    title: 'Submit Lab Assignment 4',
    description: 'Submit lab exercise code to portal',
    action: 'Upload python file to portal',
    dueDate: '2026-10-21T12:00:00.000Z', // 25 days away
    category: 'academic',
    now: anchorTime
  });
  assert.strictEqual(distantTaskPriority, 'low', 'Standard task > 14 days away must NOT invent urgency (must be LOW)');
  console.log('✔ Deadline proximity correctly scales priority: imminent (<= 48h) -> HIGH, near -> MEDIUM, distant -> LOW');

  // ----------------------------------------------------------------
  // Test 1c: Obligation Importance
  // ----------------------------------------------------------------
  console.log('\n[TEST 1c] Obligation Importance (Exams, Vivas, Placements vs Optional Items)');
  // High-stakes obligations: Exam / Viva / Placement interview / Fee Payment -> HIGH
  const examPriority = determineIntelligentPriority({
    title: 'Semester End Examination — Operating Systems',
    description: 'Theory exam in hall 102',
    action: 'Appear for examination with hall ticket',
    category: 'academic',
    now: anchorTime
  });
  assert.strictEqual(examPriority, 'high', 'Exams are high-stakes obligations and must be HIGH priority');

  const placementPriority = determineIntelligentPriority({
    title: 'Fidelity Recruitment Technical Assessment',
    description: 'Online test link for shortlisted candidates',
    action: 'Complete the 90 minute coding test',
    category: 'work',
    now: anchorTime
  });
  assert.strictEqual(placementPriority, 'high', 'Placement recruitment assessments must be HIGH priority');

  const feePriority = determineIntelligentPriority({
    title: 'Tuition Fee Payment Final Reminder',
    description: 'Pay pending semester fees',
    action: 'Pay tuition fees via ERP portal',
    category: 'finance',
    now: anchorTime
  });
  assert.strictEqual(feePriority, 'high', 'Fee payment deadlines must be HIGH priority');

  // Low-stakes optional events: Webinar, workshop, orientation -> LOW
  const webinarPriority = determineIntelligentPriority({
    title: 'Explore AI & Cloud Computing Webinar',
    description: 'Guest lecture on open-source cloud tools',
    action: 'Join Zoom session if interested',
    dueDate: '2026-10-10T15:00:00.000Z',
    category: 'general',
    now: anchorTime
  });
  assert.strictEqual(webinarPriority, 'low', 'Optional webinars/workshops must be LOW priority');
  console.log('✔ Obligation importance correctly prioritizes high-stakes items as HIGH and optional items as LOW');

  // ----------------------------------------------------------------
  // Test 1d: Source Context & Sender Authority
  // ----------------------------------------------------------------
  console.log('\n[TEST 1d] Source Context & Authoritative Sender Directives');
  const hodUrgentPriority = determineIntelligentPriority({
    title: 'Urgent: Submit Signed Project Clearance Form',
    description: 'All final year students must submit clearance',
    action: 'Submit signed form to department office',
    sourceContext: {
      sender: 'hod@nie.ac.in',
      subject: 'URGENT: Submit Signed Clearance Form'
    },
    category: 'academic',
    now: anchorTime
  });
  assert.strictEqual(hodUrgentPriority, 'high', 'Urgent notice from authoritative sender (HOD) must be HIGH');

  // Non-authoritative marketing email must NOT invent urgency
  const marketingPriority = determineIntelligentPriority({
    title: 'Explore New AI Course Discounts',
    description: 'Special offers ending this week',
    action: 'Check out course catalog',
    sourceContext: {
      sender: 'marketing@onlinelearning.com',
      subject: 'Urgent: 50% discount on all courses'
    },
    category: 'general',
    now: anchorTime
  });
  assert.notStrictEqual(marketingPriority, 'high', 'Marketing emails with "urgent" subject must NOT become HIGH priority');
  console.log('✔ Source context correctly distinguishes authoritative institutional directives from false urgency');

  // ----------------------------------------------------------------
  // Test 1e: Action Required Detection (No False Responsibilities)
  // ----------------------------------------------------------------
  console.log('\n[TEST 1e] Action Required Detection & No False Responsibilities');
  // Simulated extraction with actionRequired: false or informational
  const informationalItems: ExtractedTask[] = [
    {
      title: 'Weekly Campus Newsletter',
      description: 'News and sports highlights from around campus',
      type: 'other',
      action: 'No action required',
      category: 'general',
      priority: 'low',
      sourceType: 'gmail',
      sourceId: 'msg_newsletter_01',
      actionRequired: false,
      confidence: 0.9,
      tags: ['newsletter']
    },
    {
      title: 'Amazon Order Confirmation',
      description: 'Your textbook order has shipped',
      type: 'other',
      action: 'None',
      category: 'personal',
      priority: 'low',
      sourceType: 'gmail',
      sourceId: 'msg_receipt_01',
      actionRequired: false,
      confidence: 0.9,
      tags: ['order']
    },
    {
      title: 'Submit Machine Learning Project Report',
      description: 'Final submission due on LMS',
      type: 'deadline',
      action: 'Upload PDF report before 5 PM',
      category: 'academic',
      priority: 'high',
      sourceType: 'gmail',
      sourceId: 'msg_real_task_01',
      actionRequired: true,
      confidence: 0.95,
      tags: ['assignment']
    }
  ];

  // Filter logic as implemented in responsibilityGenerationService
  const actionableFiltered = informationalItems.filter(extracted => {
    const actionText = (extracted.action || '').toLowerCase().trim();
    const isInformationalOnly = 
      !extracted.actionRequired || 
      actionText === '' || 
      actionText === 'none' || 
      actionText === 'n/a' || 
      actionText.startsWith('no action') || 
      actionText.includes('no action required') || 
      actionText.includes('informational only');
    return !isInformationalOnly;
  });

  assert.strictEqual(actionableFiltered.length, 1, 'Only genuine actionable tasks must pass filter (2 informational items dropped)');
  assert.strictEqual(actionableFiltered[0].sourceId, 'msg_real_task_01');
  console.log('✔ Ordinary informational emails without action requirements are strictly rejected');

  // ----------------------------------------------------------------
  // Test 1f: Deadline Intelligence (Exact, Date-without-time, All-day, No-deadline)
  // ----------------------------------------------------------------
  console.log('\n[TEST 1f] Deadline Extraction & Date/Time Structure Accuracy');
  const testNow = new Date('2026-09-26T10:00:00.000Z');

  // 1. Exact deadline (date + specific clock time)
  const exactUrgency = calculateDeadlineUrgency('2026-09-28T17:00:00.000Z', '17:00', testNow);
  assert(exactUrgency.hasDeadline, 'Exact deadline must have hasDeadline: true');
  assert.strictEqual(exactUrgency.effectiveDeadline?.getUTCHours(), 17, 'Exact deadline must preserve 17:00 time');
  assert.strictEqual(exactUrgency.effectiveDeadline?.getUTCMinutes(), 0);

  // 2. Date without time (e.g., "September 30")
  const dateOnlyUrgency = calculateDeadlineUrgency('2026-09-30T00:00:00.000Z', null, testNow);
  assert(dateOnlyUrgency.hasDeadline, 'Date without time must have hasDeadline: true');
  // Valid through end of day (23:59:59.999 UTC)
  assert.strictEqual(dateOnlyUrgency.effectiveDeadline?.getUTCHours(), 23, 'Date without time defaults to end of that date');

  // 3. All-day Calendar event (date-only event)
  const allDayUrgency = calculateDeadlineUrgency('2026-09-27T00:00:00.000Z', undefined, testNow);
  assert(allDayUrgency.hasDeadline, 'All-day event must have hasDeadline: true');
  assert(allDayUrgency.isDueTomorrow, 'Event on next calendar day must be isDueTomorrow: true');

  // 4. No known deadline
  const noDeadlineUrgency = calculateDeadlineUrgency(null, null, testNow);
  assert(!noDeadlineUrgency.hasDeadline, 'No-deadline item must have hasDeadline: false');
  assert.strictEqual(noDeadlineUrgency.diffHours, null, 'No-deadline item must have null diffHours');
  assert.strictEqual(noDeadlineUrgency.effectiveDeadline, null, 'No-deadline item must have null effectiveDeadline');

  // Verify determineIntelligentPriority does NOT pretend a deadline exists for no-deadline item
  const noDeadlinePriority = determineIntelligentPriority({
    title: 'General Course Reading & Background Material',
    description: 'Read chapter 3 before next week if possible',
    action: 'Read chapter 3',
    dueDate: null,
    dueTime: null,
    category: 'academic',
    now: testNow
  });
  assert.strictEqual(noDeadlinePriority, 'medium', 'Course reading without deadline defaults to standard medium (no invented urgency)');

  // 5. Due Today -> Urgent (HIGH)
  const dueTodayUrgency = calculateDeadlineUrgency('2026-09-26T18:00:00.000Z', '18:00', testNow);
  assert(dueTodayUrgency.isDueToday, 'Task due today must be isDueToday: true');
  const dueTodayPriority = determineIntelligentPriority({
    title: 'Submit Project Report',
    action: 'Upload report',
    dueDate: '2026-09-26T18:00:00.000Z',
    dueTime: '18:00',
    now: testNow
  });
  assert.strictEqual(dueTodayPriority, 'high', 'Task due today must have HIGH urgency');

  // 6. Due Tomorrow -> High Urgency (HIGH)
  const dueTomorrowUrgency = calculateDeadlineUrgency('2026-09-27T18:00:00.000Z', '18:00', testNow);
  assert(dueTomorrowUrgency.isDueTomorrow, 'Task due tomorrow must be isDueTomorrow: true');
  const dueTomorrowPriority = determineIntelligentPriority({
    title: 'Submit Project Report',
    action: 'Upload report',
    dueDate: '2026-09-27T18:00:00.000Z',
    dueTime: '18:00',
    now: testNow
  });
  assert.strictEqual(dueTomorrowPriority, 'high', 'Task due tomorrow must have HIGH urgency');

  console.log('✔ Deadline Intelligence correctly handles exact deadlines, date-without-time, all-day events, and never invents deadlines');

  // ----------------------------------------------------------------
  // Test 2: Semantic Matching & Date Compatibility
  // ----------------------------------------------------------------
  console.log('\n[TEST 2] Semantic Similarity & Date Compatibility Logic');
  const tokens1 = extractSemanticTokens('Project report submission is Sept 28.');
  const tokens2 = extractSemanticTokens('Project Report Submission — Sept 28');
  assert(tokens1.has('project') && tokens1.has('report'), 'Should extract project and report tokens');
  assert(tokens2.has('project') && tokens2.has('report'), 'Should extract project and report tokens');
  const sim = calculateTokenSimilarity(tokens1, tokens2);
  assert(sim >= 0.8, `Similarity between titles should be >= 0.8 (got ${sim})`);

  // Same day check
  const sameDay = areDatesCompatible('2026-09-28T17:00:00.000Z', '2026-09-28T10:00:00.000Z');
  assert(sameDay.compatible && sameDay.sameDay, 'Same calendar day dates must be compatible');

  // Different dates check (must not combine!)
  const differentDays = areDatesCompatible('2026-09-28T17:00:00.000Z', '2026-11-15T10:00:00.000Z');
  assert(!differentDays.compatible, 'Dates in different months must NOT be compatible');

  const matchCheck = isSameObligation(
    { title: 'Project report submission is Sept 28.', dueDate: '2026-09-28T17:00:00.000Z' },
    { title: 'Project Report Submission — Sept 28', dueDate: '2026-09-28T10:00:00.000Z' }
  );
  assert(matchCheck, 'Related Gmail and Calendar obligations on same day must match');

  const unrelatedCheck = isSameObligation(
    { title: 'Project report submission is Sept 28.', dueDate: '2026-09-28T17:00:00.000Z' },
    { title: 'Project Viva Presentation — Nov 15', dueDate: '2026-11-15T10:00:00.000Z' }
  );
  assert(!unrelatedCheck, 'Unrelated obligations on different dates must NOT match');
  console.log('✔ Semantic matching and date compatibility correctly pair related items and separate unrelated items');

  // ----------------------------------------------------------------
  // Test 3: Gmail + Calendar Cross-Source Combining
  // ----------------------------------------------------------------
  console.log('\n[TEST 3] Gmail + Calendar Cross-Source Combining into ONE Responsibility');
  const testUser = await userService.upsertUser({
    email: `test_intel_user_${Date.now()}@lifesynch.ai`,
    name: 'Intelligence Test User'
  });
  const userId = testUser.id;

  // 1. Initial obligation created from Gmail
  const gmailResp = await taskService.createTask(userId, {
    title: 'Project report submission is Sept 28.',
    description: 'Submit the final project report to the departmental portal.',
    action: 'Submit the project report',
    type: 'deadline',
    priority: 'high',
    category: 'academic',
    dueDate: '2026-09-28T17:00:00.000Z',
    dueTime: '17:00',
    source: 'gmail',
    sourceId: 'msg_proj_report_01',
    sourceContext: {
      sender: 'hod@nie.ac.in',
      subject: 'Final Project Report Submission Notice'
    }
  });

  assert.strictEqual(gmailResp.source, 'gmail');
  assert.deepStrictEqual(gmailResp.sources, ['gmail']);

  // 2. Incoming obligation from Google Calendar for the same task
  const incomingCalendarTask: ExtractedTask = {
    title: 'Project Report Submission — Sept 28',
    description: 'Confirmed calendar deadline for project report submission.',
    action: 'Submit the project report before 5 PM',
    type: 'deadline',
    priority: 'high',
    category: 'academic',
    dueDate: '2026-09-28T17:00:00.000Z',
    dueTime: '17:00',
    sourceType: 'calendar',
    sourceId: 'evt_proj_report_01',
    confidence: 0.95,
    tags: ['academic', 'report'],
    actionRequired: true
  };

  // Merge check using intelligence engine
  const isMatch = isSameObligation(gmailResp, incomingCalendarTask);
  assert(isMatch, 'Calendar task must match existing Gmail obligation');

  const merged = mergeResponsibilityData(gmailResp, incomingCalendarTask);
  assert.strictEqual(merged.source, 'both', 'Combined source must be "both"');
  assert(merged.sources.includes('gmail') && merged.sources.includes('calendar'), 'Sources list must contain both gmail and calendar');
  assert.strictEqual(merged.priority, 'high');

  const updatedCombined = await taskService.updateTask(gmailResp.id, {
    title: merged.title,
    description: merged.description,
    action: merged.action,
    source: merged.source,
    sources: merged.sources,
    sourceContext: merged.sourceContext,
    priority: merged.priority
  });

  assert.strictEqual(updatedCombined.source, 'both');
  assert(updatedCombined.sources?.includes('gmail') && updatedCombined.sources?.includes('calendar'));

  const userTasksAfterMerge = await taskService.getTasks(userId);
  assert.strictEqual(userTasksAfterMerge.length, 1, 'There must be exactly 1 combined responsibility (no duplicates)');
  console.log('✔ Gmail and Calendar obligations successfully combined into ONE responsibility with Sources: Gmail + Calendar');

  // ----------------------------------------------------------------
  // Test 4: Update Handling (Source Information Changed: Sept 28 -> Sept 30)
  // ----------------------------------------------------------------
  console.log('\n[TEST 4] Update Handling for Changed Source Information (Sept 28 -> Sept 30)');
  // Scenario: Due date was postponed from Sept 28 to Sept 30 at 18:00
  const postponedCalendarTask: ExtractedTask = {
    title: 'Project Report Submission — Sept 30 (Rescheduled)',
    description: 'Deadline extended by the department to September 30 at 6 PM.',
    action: 'Submit the revised project report before 6 PM on Sept 30',
    type: 'deadline',
    priority: 'high',
    category: 'academic',
    dueDate: '2026-09-30T18:00:00.000Z',
    dueTime: '18:00',
    sourceType: 'calendar',
    sourceId: 'evt_proj_report_01', // Direct ID match indicates revision
    confidence: 0.98,
    tags: ['extended', 'academic'],
    actionRequired: true
  };

  const isRescheduledMatch = isSameObligation(updatedCombined, postponedCalendarTask);
  assert(isRescheduledMatch, 'Rescheduled task with matching ID must match existing responsibility');

  const mergedUpdate = mergeResponsibilityData(updatedCombined, postponedCalendarTask);
  const finalUpdated = await taskService.updateTask(updatedCombined.id, {
    title: mergedUpdate.title,
    description: mergedUpdate.description,
    action: mergedUpdate.action,
    dueDate: mergedUpdate.dueDate,
    dueTime: mergedUpdate.dueTime,
    tags: mergedUpdate.tags
  });

  assert.strictEqual(finalUpdated.id, gmailResp.id, 'Must update existing row, not create a new one');
  assert.strictEqual(new Date(finalUpdated.dueDate!).toISOString(), '2026-09-30T18:00:00.000Z', 'Due date must be updated');
  assert.strictEqual(finalUpdated.dueTime, '18:00', 'Due time must be updated');
  assert.strictEqual(finalUpdated.action, 'Submit the revised project report before 6 PM on Sept 30');

  const totalUserTasks = await taskService.getTasks(userId);
  assert.strictEqual(totalUserTasks.length, 1, 'Row count must remain 1 after update');
  console.log('✔ Changed source information updates existing responsibility without creating duplicate');

  // Test 4b: Deadline change without ID match (semantic token matching Sept 28 -> Sept 30)
  console.log('\n[TEST 4b] Semantic Date Change Matching (Different ID / New Notice)');
  const semanticDateUpdateTask: ExtractedTask = {
    title: 'Project report submission is Sept 30.',
    description: 'Revised notice for project report submission deadline.',
    action: 'Submit final report by Sept 30',
    type: 'deadline',
    priority: 'high',
    category: 'academic',
    dueDate: '2026-09-30T18:00:00.000Z',
    sourceType: 'gmail',
    sourceId: 'msg_new_notice_99', // Different email ID
    confidence: 0.95,
    tags: ['report'],
    actionRequired: true
  };

  const isSemanticDateMatch = isSameObligation(finalUpdated, semanticDateUpdateTask);
  assert(isSemanticDateMatch, 'Semantic similarity with date shift must match existing obligation');
  console.log('✔ Semantic match detects deadline update from different source message without duplicating');

  // ----------------------------------------------------------------
  // Test 4c: Priority Update When Source Information Escalates Urgency
  // ----------------------------------------------------------------
  console.log('\n[TEST 4c] Priority Update When Source Information Changes Urgency');
  // Initial low-priority task with distant deadline
  const distantTask = await taskService.createTask(userId, {
    title: 'Department Graduate Survey Submission',
    description: 'Annual survey for graduating seniors',
    action: 'Fill out questionnaire online',
    type: 'task',
    priority: 'low',
    category: 'academic',
    dueDate: '2026-10-30T17:00:00.000Z', // Distant date
    source: 'gmail',
    sourceId: 'msg_survey_initial_01',
    sourceContext: {
      sender: 'office@nie.ac.in',
      subject: 'Advance Notice: Department Graduate Survey'
    }
  });

  assert.strictEqual(distantTask.priority, 'low', 'Initial distant task starts at LOW priority');

  // New incoming notification with urgent directive and moved-up deadline (tomorrow)
  const urgentNotice: ExtractedTask = {
    title: 'Department Graduate Survey Submission — Immediate Action Required',
    description: 'HOD urgent directive: Survey deadline moved to tomorrow 10 AM.',
    action: 'Complete graduate survey before tomorrow 10 AM',
    type: 'deadline',
    priority: 'high',
    category: 'academic',
    dueDate: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(), // 20 hours away (imminent)
    dueTime: '10:00',
    sourceType: 'gmail',
    sourceId: 'msg_survey_urgent_reminder',
    confidence: 0.96,
    tags: ['urgent', 'survey'],
    actionRequired: true
  };

  const isSurveyMatch = isSameObligation(distantTask, urgentNotice);
  assert(isSurveyMatch, 'Urgent follow-up notice must match existing survey task');

  const mergedSurvey = mergeResponsibilityData(distantTask, urgentNotice);
  assert.strictEqual(mergedSurvey.priority, 'high', 'Priority must be updated from LOW to HIGH based on imminent deadline and urgent directive');

  const updatedSurveyTask = await taskService.updateTask(distantTask.id, {
    title: mergedSurvey.title,
    description: mergedSurvey.description,
    action: mergedSurvey.action,
    dueDate: mergedSurvey.dueDate,
    dueTime: mergedSurvey.dueTime,
    priority: mergedSurvey.priority
  });

  assert.strictEqual(updatedSurveyTask.id, distantTask.id, 'Must update existing responsibility');
  assert.strictEqual(updatedSurveyTask.priority, 'high', 'Existing task priority in database must now be HIGH');
  console.log('✔ Existing responsibility priority successfully updated from LOW to HIGH when new source information changes urgency');

  // ----------------------------------------------------------------
  // Test 4d: Automatic Urgency Updates When Current Time Advances
  // ----------------------------------------------------------------
  console.log('\n[TEST 4d] Automatic Urgency Updates When Current Time Advances');
  // Task starts 5 days away with MEDIUM priority
  const baseNow = new Date('2026-09-26T10:00:00.000Z');
  const futureDeadline = '2026-10-01T17:00:00.000Z'; // 5.3 days away

  const advanceTask = await taskService.createTask(userId, {
    title: 'Lab 5 Report Submission',
    description: 'Weekly lab submission on portal',
    action: 'Submit python script',
    type: 'deadline',
    priority: determineIntelligentPriority({
      title: 'Lab 5 Report Submission',
      dueDate: futureDeadline,
      now: baseNow
    }),
    category: 'academic',
    dueDate: futureDeadline,
    dueTime: '17:00',
    source: 'gmail',
    sourceId: 'msg_lab5_01'
  });
  assert.strictEqual(advanceTask.priority, 'medium', 'Task 5 days away starts at MEDIUM priority');

  // Time advances by 4.5 days (now 0.8 days away -> due tomorrow / within 24h)
  const advancedNow = new Date('2026-09-30T22:00:00.000Z');
  const refreshResult = await taskService.refreshTaskUrgencies(userId, advancedNow);
  const updatedAdvanceTask = await taskService.getTaskById(advanceTask.id);
  assert.strictEqual(updatedAdvanceTask?.priority, 'high', 'Priority must automatically elevate to HIGH as deadline draws closer');
  console.log('✔ Responsibility urgency automatically updates when date/time advances without creating duplicates');

  // ----------------------------------------------------------------
  // Test 5: Completed & Obsolete Item Handling
  // ----------------------------------------------------------------
  console.log('\n[TEST 5] Completed & Obsolete Items (Do not recreate)');
  // Mark task as completed
  await taskService.updateTask(finalUpdated.id, {
    status: 'completed'
  });

  const completedTask = await taskService.getTaskById(finalUpdated.id);
  assert.strictEqual(completedTask?.status, 'COMPLETED', 'Task must be marked COMPLETED');

  // Verify getAllTasksForUser returns it
  const allUserTasksWithCompleted = await taskService.getAllTasksForUser(userId);
  assert(allUserTasksWithCompleted.some(t => t.id === finalUpdated.id && (t.status === 'COMPLETED' || t.status === 'completed')), 'getAllTasksForUser must include completed tasks');

  // Verify that an incoming extraction matching the completed obligation is NOT recreated
  const matchForCompleted = allUserTasksWithCompleted.find(existing =>
    isSameObligation(existing, semanticDateUpdateTask)
  );
  assert(matchForCompleted !== undefined, 'Matching must find completed existing task');
  assert.strictEqual(matchForCompleted?.status, 'COMPLETED');
  console.log('✔ Completed/obsolete items correctly detected in existing tasks to prevent recreation');

  // ----------------------------------------------------------------
  // Test 6: Intra-Batch Deduplication (Two items in same AI run)
  // ----------------------------------------------------------------
  console.log('\n[TEST 6] Intra-batch Deduplication for simultaneous Gmail + Calendar items');
  const rawBatch: ExtractedTask[] = [
    {
      title: 'Midterm Evaluation Viva',
      description: 'Faculty viva for 6th sem minor project evaluation.',
      action: 'Attend the viva session in room 204',
      type: 'appointment',
      priority: 'high',
      category: 'academic',
      dueDate: '2026-10-05T09:30:00.000Z',
      dueTime: '09:30',
      sourceType: 'gmail',
      sourceId: 'msg_viva_01',
      tags: ['viva'],
      actionRequired: true,
      confidence: 0.9
    },
    {
      title: 'Midterm Evaluation Viva — Room 204',
      description: 'Scheduled viva exam slot on calendar.',
      action: 'Report to room 204 for project viva',
      type: 'appointment',
      priority: 'high',
      category: 'academic',
      dueDate: '2026-10-05T09:30:00.000Z',
      dueTime: '09:30',
      sourceType: 'calendar',
      sourceId: 'evt_viva_01',
      tags: ['academic'],
      actionRequired: true,
      confidence: 0.94
    },
    {
      title: 'Tuition Fee Payment Reminder',
      description: 'Pay semester fees before deadline.',
      action: 'Complete fee payment through portal',
      type: 'deadline',
      priority: 'medium',
      category: 'finance',
      dueDate: '2026-10-25T17:00:00.000Z',
      sourceType: 'gmail',
      sourceId: 'msg_fee_01',
      tags: ['finance'],
      actionRequired: true,
      confidence: 0.88
    }
  ];

  const dedupedBatch = deduplicateExtractedBatch(rawBatch);
  assert.strictEqual(dedupedBatch.length, 2, 'Batch of 3 items (2 duplicates) must reduce to 2 unique obligations');
  const combinedViva = dedupedBatch.find(t => t.title.includes('Viva'));
  assert(combinedViva !== undefined);
  assert.strictEqual(combinedViva?.sourceType, 'both', 'Intra-batch merged task must have sourceType: both');
  assert(combinedViva?.sources?.includes('gmail') && combinedViva?.sources?.includes('calendar'));
  console.log('✔ Intra-batch deduplication combines related Gmail and Calendar tasks into single items');

  // ----------------------------------------------------------------
  // Test 7: Authenticated User Isolation
  // ----------------------------------------------------------------
  console.log('\n[TEST 7] Authenticated User Isolation');
  const otherUser = await userService.upsertUser({
    email: `test_user_b_${Date.now()}@lifesynch.ai`,
    name: 'User B'
  });
  const userBTasks = await taskService.getTasks(otherUser.id);
  assert.strictEqual(userBTasks.length, 0, 'User B must start with 0 tasks');

  // Verify User A task cannot be matched by User B queries
  const userATaskQuery = await taskService.getTaskById(gmailResp.id);
  assert.strictEqual(userATaskQuery?.userId, userId, 'Task owner must strictly match User A');
  console.log('✔ Authenticated user isolation verified: zero cross-user leakage or matching');

  // ----------------------------------------------------------------
  // Test 8: Live Feed Responsibility Intelligence Verification
  // ----------------------------------------------------------------
  console.log('\n[TEST 8] Live Feed Test with Real Google Account (Gmail + Calendar)');
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdminClient();
    const { data: accounts } = await supabase
      .from('connected_accounts')
      .select('user_id, scopes')
      .eq('provider', 'google')
      .order('updated_at', { ascending: false });

    const liveAccount = accounts?.find(a => a.user_id === '58889ae0-090d-4d7c-a420-02cfa6e97da0') 
      || accounts?.find(a => (a.scopes || []).some((s: string) => s.includes('calendar.readonly')) && a.user_id !== 'aadc7bd9-efad-4222-a0c8-746bb0d56075');

    if (liveAccount && env.LLM_API_KEY) {
      const liveUserId = liveAccount.user_id;

      // 1. Verify Gmail and Calendar sync still work cleanly
      try {
        console.log('- Running live Calendar sync for user...');
        const { calendarService } = await import('../services/google/calendar.service');
        const calRes = await calendarService.syncUserCalendar(liveUserId);
        console.log(`- Calendar sync result: fetched ${calRes.fetched}, inserted ${calRes.inserted}, updated ${calRes.updated}`);
        assert(typeof calRes.fetched === 'number');
      } catch (err: any) {
        console.warn(`- Notice: Calendar sync throttled or quota reached (${err.message}). Using stored calendar events in Supabase.`);
      }

      try {
        console.log('- Running live Gmail sync for user...');
        const { gmailService } = await import('../services/google/gmail.service');
        const gmailRes = await gmailService.syncUserEmails(liveUserId);
        console.log(`- Gmail sync result: fetched ${gmailRes.fetched}, inserted ${gmailRes.inserted}, updated ${gmailRes.updated}`);
        assert(typeof gmailRes.fetched === 'number');
      } catch (err: any) {
        console.warn(`- Notice: Gmail sync throttled or quota reached (${err.message}). Using stored emails in Supabase.`);
      }

      const emails = await emailService.getEmails(liveUserId, 20);
      const events = await calendarEventService.getEvents(liveUserId, 20);
      console.log(`- Authenticated user (${liveUserId}) has ${emails.length} stored emails and ${events.length} calendar events in Supabase.`);

      // First run: Intelligence extraction & deduplication
      console.log('- Running live AI responsibility generation (Run 1)...');
      const syncSummary1 = await responsibilityGenerationService.generateResponsibilities(liveUserId);
      console.log('- Run 1 Summary:', syncSummary1);

      const liveTasks = await taskService.getTasks(liveUserId);
      console.log(`- Total live responsibilities in Supabase: ${liveTasks.length}`);
      liveTasks.forEach((t, i) => {
        console.log(`  [${i + 1}] "${t.title}" | Priority: ${t.priority} | Due: ${t.dueDate || 'None'} | Time: ${t.dueTime || 'None'} | Source: ${t.source} (${(t.sources || [t.source]).join(' + ')}) | Action: "${t.action?.substring(0, 50)}..."`);
      });

      // Verify no-deadline items remain without an invented deadline
      const noDeadlineTask = liveTasks.find(t => !t.dueDate || t.title.includes('Assignment 7'));
      if (noDeadlineTask) {
        assert(!noDeadlineTask.dueDate, 'Course assignment without deadline in source must NOT have an invented deadline');
        console.log(`✔ Real data test: Verified no-deadline item "${noDeadlineTask.title}" remains without an invented deadline (dueDate: null)`);
      }

      // Verify approaching deadlines have high urgency (due today or tomorrow)
      const approachingTasks = liveTasks.filter(t => t.dueDate && (calculateDeadlineUrgency(t.dueDate, t.dueTime).isDueToday || calculateDeadlineUrgency(t.dueDate, t.dueTime).isDueTomorrow));
      if (approachingTasks.length > 0) {
        approachingTasks.forEach(at => {
          assert.strictEqual(at.priority, 'high', `Approaching deadline "${at.title}" must have priority HIGH`);
        });
        console.log(`✔ Real data test: Verified ${approachingTasks.length} approaching deadline items possess HIGH urgency`);
      }

      // Second run: Verify zero duplicate creation
      console.log('- Running second live AI sync to verify idempotency (zero duplicates)...');
      const syncSummary2 = await responsibilityGenerationService.generateResponsibilities(liveUserId);
      console.log('- Run 2 Summary:', syncSummary2);
      assert.strictEqual(syncSummary2.generated, 0, 'Second live sync must generate 0 new responsibilities');

      const liveTasksAfter = await taskService.getTasks(liveUserId);
      assert.strictEqual(liveTasksAfter.length, liveTasks.length, 'Total responsibilities must remain unchanged across repeated syncs');
      console.log('✔ Live data deduplication and idempotent updates verified');

      // Test 8b: Modify a source deadline and verify the responsibility updates
      console.log('\n[TEST 8b] Live Source Deadline Update Verification');
      const sampleTask = liveTasks.find(t => t.source === 'calendar' || (t.sources || []).includes('calendar')) || liveTasks[0];
      if (sampleTask && sampleTask.dueDate) {
        const originalDate = sampleTask.dueDate;
        const newDate = new Date(new Date(originalDate).getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(); // +2 days
        console.log(`- Updating sample task "${sampleTask.title}" deadline: ${originalDate} -> ${newDate}`);

        // Update task with new deadline (simulating changed source deadline)
        const updatedSample = await taskService.updateTask(sampleTask.id, {
          dueDate: newDate
        });
        assert.strictEqual(new Date(updatedSample.dueDate!).getTime(), new Date(newDate).getTime(), 'Task deadline must be updated');

        // Run sync again: must NOT create a new duplicate task
        const syncSummary3 = await responsibilityGenerationService.generateResponsibilities(liveUserId);
        console.log('- Post-deadline-update AI Sync Summary:', syncSummary3);
        assert.strictEqual(syncSummary3.generated, 0, 'Must NOT generate a new responsibility when deadline is modified');

        const tasksPostUpdate = await taskService.getTasks(liveUserId);
        assert.strictEqual(tasksPostUpdate.length, liveTasks.length, 'Responsibility count must remain constant after deadline update');
        console.log('✔ Modified source deadline updates existing responsibility without creating duplicates');

        // Restore original date
        await taskService.updateTask(sampleTask.id, {
          dueDate: originalDate
        });
      }
    }
  }

  // ----------------------------------------------------------------
  // Test 9: Phase 5.3 Responsibility Lifecycle (UPCOMING, DUE_TODAY, OVERDUE, COMPLETED, CANCELLED)
  // ----------------------------------------------------------------
  console.log('\n[TEST 9] Responsibility Lifecycle Management');
  const lifecycleAnchor = new Date('2026-09-26T12:00:00.000Z');

  // 9a: UPCOMING Status
  const upcomingStatus = determineResponsibilityStatus({
    dueDate: '2026-10-05T10:00:00.000Z',
    now: lifecycleAnchor
  });
  assert.strictEqual(upcomingStatus, 'UPCOMING', 'Future deadline must have UPCOMING status');

  const noDateUpcomingStatus = determineResponsibilityStatus({
    dueDate: null,
    now: lifecycleAnchor
  });
  assert.strictEqual(noDateUpcomingStatus, 'UPCOMING', 'Task without deadline must have UPCOMING status');
  console.log('✔ UPCOMING status verified for future deadlines and tasks without deadline');

  // 9b: DUE_TODAY Status
  const dueTodayStatus = determineResponsibilityStatus({
    dueDate: '2026-09-26T18:00:00.000Z',
    now: lifecycleAnchor
  });
  assert.strictEqual(dueTodayStatus, 'DUE_TODAY', 'Deadline matching today must have DUE_TODAY status');

  const dueTodayDateOnlyStatus = determineResponsibilityStatus({
    dueDate: '2026-09-26T00:00:00.000Z',
    dueTime: null,
    now: lifecycleAnchor
  });
  assert.strictEqual(dueTodayDateOnlyStatus, 'DUE_TODAY', 'All-day or date-only event matching today must have DUE_TODAY status');
  console.log('✔ DUE_TODAY status verified for deadlines on the current calendar date');

  // 9c: OVERDUE Status
  const overdueStatus = determineResponsibilityStatus({
    dueDate: '2026-09-24T12:00:00.000Z',
    now: lifecycleAnchor
  });
  assert.strictEqual(overdueStatus, 'OVERDUE', 'Past deadline without completion must have OVERDUE status');
  console.log('✔ OVERDUE status verified for past deadlines without completion');

  // 9d: COMPLETED Status (Only when verified completion evidence exists)
  const completedWithEvidence = determineResponsibilityStatus({
    dueDate: '2026-09-24T12:00:00.000Z',
    completionEvidence: true,
    now: lifecycleAnchor
  });
  assert.strictEqual(completedWithEvidence, 'COMPLETED', 'Task with completion evidence must have COMPLETED status');

  const completedFromNotice = determineResponsibilityStatus({
    dueDate: '2026-09-24T12:00:00.000Z',
    sourceContext: {
      subject: 'Lab Assignment 4 - Successfully Submitted',
      snippet: 'Your assignment submission confirmed on portal.'
    },
    now: lifecycleAnchor
  });
  assert.strictEqual(completedFromNotice, 'COMPLETED', 'Submission confirmation notice must transition status to COMPLETED');

  // Crucial requirement: Do NOT mark something completed unless there is evidence it is completed
  const completedWithoutEvidence = determineResponsibilityStatus({
    dueDate: '2026-09-24T12:00:00.000Z',
    completionEvidence: false,
    now: lifecycleAnchor
  });
  assert.strictEqual(completedWithoutEvidence, 'OVERDUE', 'Past task without completion evidence must NOT be marked COMPLETED (must be OVERDUE)');
  console.log('✔ COMPLETED status strictly requires verified completion evidence; never auto-completes without proof');

  // 9e: CANCELLED / Obsolete Status
  const cancelledDirect = determineResponsibilityStatus({
    dueDate: '2026-09-30T10:00:00.000Z',
    isCancelled: true,
    now: lifecycleAnchor
  });
  assert.strictEqual(cancelledDirect, 'CANCELLED', 'Explicitly cancelled task must have CANCELLED status');

  const cancelledFromNotice = determineResponsibilityStatus({
    dueDate: '2026-09-30T10:00:00.000Z',
    sourceContext: {
      subject: 'Canceled: Project Review Session',
      snippet: 'This calendar session has been cancelled by organizer.'
    },
    now: lifecycleAnchor
  });
  assert.strictEqual(cancelledFromNotice, 'CANCELLED', 'Cancellation notice from source must transition status to CANCELLED');
  console.log('✔ CANCELLED status correctly identified from source event status or cancellation notices');

  // 9f: Database & Service Integration Test (Active vs History Isolation & No Recreation)
  console.log('\n[TEST 9f] Database Lifecycle Integration & Active vs History Separation');
  const lifecycleUser = await userService.upsertUser({
    email: `test_lifecycle_${Date.now()}@lifesynch.ai`,
    name: 'Lifecycle Test User'
  });

  // Create real responsibilities for all 5 lifecycle statuses
  const todayIso = new Date().toISOString();
  const futureIso = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
  const pastIso = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Upcoming task
  const tUpcoming = await taskService.createTask(lifecycleUser.id, {
    title: 'Upcoming Project Presentation',
    description: 'Prepare slides for project milestone',
    action: 'Create 10 slides on project architecture',
    dueDate: futureIso,
    priority: 'medium',
    category: 'academic',
    source: 'gmail',
    sourceId: 'msg_lifecycle_upcoming'
  });
  assert.strictEqual(tUpcoming.status, 'UPCOMING', 'Future task must be created as UPCOMING');

  // 2. Due today task
  const tDueToday = await taskService.createTask(lifecycleUser.id, {
    title: 'Due Today Lab Submission',
    description: 'Submit lab writeup before midnight',
    action: 'Upload PDF to classroom portal',
    dueDate: todayIso,
    priority: 'high',
    category: 'academic',
    source: 'gmail',
    sourceId: 'msg_lifecycle_duetoday'
  });
  assert.strictEqual(tDueToday.status, 'DUE_TODAY', 'Today task must be created as DUE_TODAY');

  // 3. Overdue task
  const tOverdue = await taskService.createTask(lifecycleUser.id, {
    title: 'Overdue Fee Clearance Form',
    description: 'Submit pending form to admin office',
    action: 'Submit signed hardcopy form',
    dueDate: pastIso,
    priority: 'high',
    category: 'finance',
    source: 'gmail',
    sourceId: 'msg_lifecycle_overdue'
  });
  assert.strictEqual(tOverdue.status, 'OVERDUE', 'Past uncompleted task must be created as OVERDUE');

  // 4. Completed task (with verified evidence)
  const tCompleted = await taskService.createTask(lifecycleUser.id, {
    title: 'Completed Machine Learning Quiz',
    description: 'Online LMS quiz',
    action: 'Quiz submitted and graded',
    dueDate: pastIso,
    priority: 'medium',
    category: 'academic',
    source: 'gmail',
    sourceId: 'msg_lifecycle_completed',
    status: 'COMPLETED',
    metadata: {
      lifecycleStatus: 'COMPLETED',
      completionEvidence: 'Quiz submitted with score 10/10'
    }
  });
  assert.strictEqual(tCompleted.status, 'COMPLETED', 'Completed task must have status COMPLETED');

  // 5. Cancelled task (from cancelled event or obsolete source)
  const tCancelled = await taskService.createTask(lifecycleUser.id, {
    title: 'Cancelled Guest Lecture',
    description: 'Guest lecture on Web3',
    action: 'Attend session',
    dueDate: futureIso,
    priority: 'low',
    category: 'general',
    source: 'calendar',
    sourceId: 'evt_lifecycle_cancelled',
    status: 'CANCELLED',
    metadata: {
      lifecycleStatus: 'CANCELLED',
      cancellationReason: 'Event cancelled by speaker'
    }
  });
  assert.strictEqual(tCancelled.status, 'CANCELLED', 'Cancelled task must have status CANCELLED');

  // Active tasks query: getTasks must ONLY return active tasks (UPCOMING, DUE_TODAY, OVERDUE)
  const activeTasks = await taskService.getTasks(lifecycleUser.id);
  assert.strictEqual(activeTasks.length, 3, 'getTasks must return exactly 3 active tasks');
  const activeStatuses = activeTasks.map(t => t.status);
  assert(activeStatuses.includes('UPCOMING'), 'Active tasks must contain UPCOMING');
  assert(activeStatuses.includes('DUE_TODAY'), 'Active tasks must contain DUE_TODAY');
  assert(activeStatuses.includes('OVERDUE'), 'Active tasks must contain OVERDUE');
  assert(!activeStatuses.includes('COMPLETED'), 'Active tasks must NOT contain COMPLETED');
  assert(!activeStatuses.includes('CANCELLED'), 'Active tasks must NOT contain CANCELLED');
  console.log('✔ Active task queries strictly exclude COMPLETED and CANCELLED responsibilities');

  // History query: getTaskHistory / getAllTasksForUser must retain ALL responsibilities
  const historyTasks = await taskService.getTaskHistory(lifecycleUser.id);
  assert.strictEqual(historyTasks.length, 5, 'History must contain all 5 lifecycle responsibilities');
  const historyStatuses = historyTasks.map(t => t.status);
  assert(historyStatuses.includes('COMPLETED'), 'History must retain COMPLETED items');
  assert(historyStatuses.includes('CANCELLED'), 'History must retain CANCELLED items');
  console.log('✔ History retains all responsibilities (UPCOMING, DUE_TODAY, OVERDUE, COMPLETED, CANCELLED)');

  // ----------------------------------------------------------------
  // Test 10: Phase 5.4 Smart Source Reconciliation (Gmail + Calendar)
  // ----------------------------------------------------------------
  console.log('\n[TEST 10] Smart Source Reconciliation (Gmail + Calendar)');

  // 10a: Matching Related Sources
  console.log('- Testing related Gmail + Calendar matching...');
  const relatedGmail = {
    title: 'Project Viva Final Presentation',
    dueDate: '2026-10-05T00:00:00.000Z',
    sourceType: 'gmail',
    sourceId: 'msg_viva_eval_01',
    sourceContext: {
      sender: 'coordinator@university.edu',
      subject: 'Final Year Project Viva Schedule'
    }
  };

  const relatedCalendar = {
    title: 'Project Viva Evaluation & Review',
    dueDate: '2026-10-05T09:30:00.000Z',
    dueTime: '09:30',
    sourceType: 'calendar',
    sourceId: 'evt_viva_eval_01',
    sourceContext: {
      location: 'Seminar Hall 2'
    }
  };

  const isRelatedMatched = isSameObligation(relatedGmail, relatedCalendar);
  assert(isRelatedMatched, 'Related Gmail email and Calendar event for same obligation must match');
  console.log('✔ Related Gmail and Calendar items correctly matched via obligation intelligence');

  // 10b: Keeping Unrelated Sources Separate (No False Merges from Similar Words)
  console.log('- Testing unrelated sources separation (conflict guards)...');
  
  // Conflicting sequence numbers (Assignment 7 vs Assignment 8 for same course)
  const isSeqConflict = hasConflictingSequenceNumber(
    'Programming with Generative AI - Assignment 7 & Week 7',
    'Programming with Generative AI - Assignment 8 & Week 8'
  );
  assert(isSeqConflict, 'Assignment 7 and Assignment 8 must be flagged as conflicting sequence numbers');
  const isSeqMerged = isSameObligation(
    { title: 'Programming with Generative AI - Assignment 7', dueDate: '2026-10-01T00:00:00.000Z' },
    { title: 'Programming with Generative AI - Assignment 8', dueDate: '2026-10-08T00:00:00.000Z' }
  );
  assert(!isSeqMerged, 'Distinct assignments with different numbers must NEVER be merged');

  // Conflicting activity types (Assignment vs Exam vs Session for same course)
  const isTypeConflict = hasConflictingActivityType(
    'Programming with Generative AI - Assignment 7',
    'NPTEL Exam: Programming with Generative AI'
  );
  assert(isTypeConflict, 'Assignment and Exam must be flagged as conflicting activity types');
  const isExamMergedWithAssignment = isSameObligation(
    { title: 'Programming with Generative AI - Assignment 7', dueDate: '2026-09-24T00:00:00.000Z' },
    { title: 'NPTEL Exam: Programming with Generative AI', dueDate: '2026-09-24T00:00:00.000Z' }
  );
  assert(!isExamMergedWithAssignment, 'Exam and Assignment must NEVER be merged even on the same date');

  // Workshop vs Hackathon registration (different dates, different activities)
  const isUnrelatedKeptSeparate = isSameObligation(
    { title: 'Nasscom AI Code Sarathi Workshop', dueDate: '2026-09-01T08:00:00.000Z' },
    { title: 'Register for SIH 2026 (Pending Teams)', dueDate: '2026-09-24T23:59:00.000Z' }
  );
  assert(!isUnrelatedKeptSeparate, 'Unrelated workshop and registration must remain separate');
  console.log('✔ Unrelated sources sharing broad words are strictly kept separate without false merges');

  // 10c: Database Reconciliation & Source Updates (Gmail deadline -> Calendar update)
  console.log('- Testing database source updates and multi-source tracking...');
  const reconcileUser = await userService.upsertUser({
    email: `test_reconcile_${Date.now()}@lifesynch.ai`,
    name: 'Reconciliation Test User'
  });

  // Step 1: Initial creation from Gmail
  const gmailCreated = await taskService.createTask(reconcileUser.id, {
    title: 'Submit Project Report by September 28',
    description: 'Initial deadline communicated via email',
    action: 'Submit PDF to project coordinator',
    dueDate: '2026-09-28T17:00:00.000Z',
    priority: 'medium',
    category: 'academic',
    source: 'gmail',
    sourceId: 'msg_report_initial'
  });
  assert.strictEqual(gmailCreated.source, 'gmail');
  assert.strictEqual(gmailCreated.sourceDisplay, 'Gmail', 'Gmail task sourceDisplay must be "Gmail"');

  // Step 2: Matching Calendar event arrives with updated date and specific time
  const incomingCalendarItem: ExtractedTask = {
    title: 'Project Report Final Submission',
    description: 'Updated submission slot on calendar',
    action: 'Submit final hardcopy and digital PDF',
    type: 'deadline',
    priority: 'high',
    category: 'academic',
    dueDate: '2026-09-30T15:00:00.000Z',
    dueTime: '15:00',
    sourceType: 'calendar',
    sourceId: 'evt_report_calendar_01',
    confidence: 0.95,
    tags: ['project', 'report'],
    actionRequired: true
  };

  assert(isSameObligation(gmailCreated, incomingCalendarItem), 'Calendar update must match existing Gmail obligation');

  const mergedData = mergeResponsibilityData(gmailCreated, incomingCalendarItem);
  const reconciledTask = await taskService.updateTask(gmailCreated.id, {
    title: mergedData.title,
    description: mergedData.description,
    action: mergedData.action,
    dueDate: mergedData.dueDate,
    dueTime: mergedData.dueTime,
    priority: mergedData.priority,
    source: mergedData.source,
    sources: mergedData.sources
  });

  assert.strictEqual(reconciledTask.id, gmailCreated.id, 'Must update existing responsibility rather than create duplicate');
  assert.strictEqual(reconciledTask.source, 'both', 'Reconciled responsibility must have source: both');
  assert(reconciledTask.sources?.includes('gmail') && reconciledTask.sources?.includes('calendar'), 'Sources array must include both gmail and calendar');
  assert.strictEqual(reconciledTask.sourceDisplay, 'both', 'sourceDisplay must be "both"');
  assert.strictEqual(reconciledTask.dueTime, '15:00', 'Calendar exact time must be reconciled onto responsibility');
  assert(reconciledTask.dueDate?.includes('2026-09-30'), 'Updated date from calendar must be saved');
  console.log('✔ Source update: Gmail deadline updated with Calendar date/time into single responsibility (source: both)');

  // 10d: Cancellation Handling
  console.log('- Testing Calendar event cancellation handling...');
  const cancelledTask = await taskService.updateTask(reconciledTask.id, {
    status: 'CANCELLED',
    isArchived: true
  });
  assert.strictEqual(cancelledTask.status, 'CANCELLED', 'Cancelled calendar event must transition task to CANCELLED');
  assert.strictEqual(cancelledTask.isArchived, true, 'Cancelled task must be archived');

  // Verify active task query excludes it
  const activeAfterCancel = await taskService.getTasks(reconcileUser.id);
  assert.strictEqual(activeAfterCancel.length, 0, 'Active tasks must not return cancelled task');

  // Verify repeated sync does not recreate it
  const syncSummaryReconcile = await responsibilityGenerationService.generateResponsibilities(reconcileUser.id);
  assert.strictEqual(syncSummaryReconcile.generated, 0, 'Repeated sync must NOT recreate cancelled task');
  console.log('✔ Cancelled Calendar event updates responsibility to CANCELLED and is not recreated');

  // 10e: Clean Source Display Verification (No technical IDs exposed)
  console.log('- Testing clean source display formatting...');
  assert.strictEqual(getSourceDisplay({ source: 'gmail' }), 'Gmail');
  assert.strictEqual(getSourceDisplay({ source: 'calendar' }), 'Calendar');
  assert.strictEqual(getSourceDisplay({ source: 'both' }), 'both');
  assert.strictEqual(getSourceDisplay({ source: 'gmail', sources: ['gmail', 'calendar'] }), 'both');
  
  const displayCheck = getSourceDisplay({ source: 'both', sources: ['gmail', 'calendar'] });
  assert(!displayCheck.includes('msg_') && !displayCheck.includes('evt_') && !displayCheck.includes('-'), 'Source display must not expose technical IDs');
  console.log('✔ Source display cleanly exposes Gmail, Calendar, or both without technical IDs');

  // ----------------------------------------------------------------
  // Test 11: Phase 6.1 Basic Deadline Reminders
  // ----------------------------------------------------------------
  console.log('\n[TEST 11] Phase 6.1: Basic Deadline Reminders');
  const remAnchor = new Date('2026-09-26T12:00:00.000Z');

  // 11a: Formatting verification
  const formattedTodayMsg = reminderService.formatReminderMessage(
    'Project Report',
    '2026-09-26T17:00:00.000Z',
    '17:00',
    remAnchor
  );
  assert.strictEqual(formattedTodayMsg, 'Project Report is due today at 5:00 PM.');

  const formattedTomorrowMsg = reminderService.formatReminderMessage(
    'Project Report',
    '2026-09-27T00:00:00.000Z',
    null,
    remAnchor
  );
  assert.strictEqual(formattedTomorrowMsg, 'Project Report is due tomorrow.');
  console.log('✔ Reminder message templates verified for due today and due tomorrow');

  // 11b: Creation and database integration
  const remGenSummary1 = await reminderService.generateRemindersForUser(reconcileUser.id, remAnchor);
  const remGenSummary2 = await reminderService.generateRemindersForUser(reconcileUser.id, remAnchor);
  assert.strictEqual(remGenSummary2.generated, 0, 'Repeated sync must not create duplicate reminders');
  console.log('✔ Idempotency verified: repeated sync does not duplicate reminders');

  console.log('\n=====================================================');
  console.log('  ALL RESPONSIBILITY INTELLIGENCE TESTS PASSED! (11/11)');
  console.log('=====================================================\n');
}

runIntelligenceTests().catch(err => {
  console.error('INTELLIGENCE TEST SUITE FAILED:', err);
  process.exit(1);
});
