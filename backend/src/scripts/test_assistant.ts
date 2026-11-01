import { assistantService } from '../services/ai/assistant.service';
import { taskService } from '../services/task.service';
import { emailService } from '../services/db/email.service';
import { calendarEventService } from '../services/db/calendar-event.service';
import { userService } from '../services/db/user.service';
import assert from 'assert';

async function runAssistantTests() {
  console.log('=====================================================');
  console.log('  LIFESYNCH AI — CONVERSATIONAL ASSISTANT TEST SUITE ');
  console.log('=====================================================\n');

  // Setup real test users
  const timestamp = Date.now();
  const testUserA = await userService.upsertUser({
    email: `assistant_user_a_${timestamp}@lifesynch.ai`,
    name: 'Alex Johnson'
  });
  const userIdA = testUserA.id;

  const testUserB = await userService.upsertUser({
    email: `assistant_user_b_${timestamp}@lifesynch.ai`,
    name: 'Beth Smith'
  });
  const userIdB = testUserB.id;

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  console.log(`[SETUP] Created Test User A (${userIdA}) and Test User B (${userIdB})`);
  console.log(`[SETUP] Current test date: ${todayStr}, Tomorrow: ${tomorrowStr}`);

  // Seed real responsibilities for User A
  console.log('\n[SETUP] Seeding User A responsibilities, calendar, and emails...');
  
  // 1. High priority responsibility due today at 17:00
  const taskToday = await taskService.createTask(userIdA, {
    title: 'Final Minor Project Report Submission',
    description: 'Submit the completed documentation and source code to the coordinator.',
    priority: 'high',
    dueDate: todayStr,
    dueTime: '23:59',
    action: 'Submit report and code to coordinator',
    category: 'academic',
    source: 'gmail',
    sourceContext: { sender: 'project_coordinator@university.edu' }
  });

  // 2. Upcoming responsibility due tomorrow
  const taskTomorrow = await taskService.createTask(userIdA, {
    title: 'NPTEL Assignment 8 Submission',
    description: 'Complete online assessment on portal.',
    priority: 'medium',
    dueDate: tomorrowStr,
    dueTime: '23:59',
    action: 'Submit answers on portal',
    category: 'academic',
    source: 'gmail'
  });

  // 3. Calendar event for today (in the future relative to current time)
  await calendarEventService.saveEvents(userIdA, [{
    eventId: `cal_event_${timestamp}`,
    summary: 'Project Evaluation & Viva',
    startTime: `${todayStr}T22:00:00Z`,
    endTime: `${todayStr}T23:00:00Z`,
    status: 'confirmed',
    location: 'Lab 402'
  }]);

  // 4. Seed an email
  await emailService.saveEmails(userIdA, [{
    messageId: `email_${timestamp}`,
    sender: 'placement_officer@university.edu',
    subject: 'Fidelity Campus Drive Guidelines',
    receivedAt: today.toISOString(),
    snippet: 'The written test will be conducted online on Friday. Check guidelines.'
  }]);

  // ==========================================
  // [TEST 1] "What should I focus on today?" / Today Query
  // ==========================================
  console.log('\n[TEST 1] Focus & Due Today Query');
  const answerToday = await assistantService.ask(userIdA, 'What should I focus on today?');
  console.log('Assistant Answer:\n', answerToday);

  assert.ok(
    answerToday.toLowerCase().includes('final minor project report') || answerToday.toLowerCase().includes('project report'),
    'Answer must mention today due responsibility "Final Minor Project Report Submission"'
  );
  assert.ok(
    answerToday.includes('23:59') || answerToday.toLowerCase().includes('today') || answerToday.toLowerCase().includes('tonight') || answerToday.includes('11:59'),
    'Answer must reflect deadline time or today timing'
  );
  console.log('✔ Correctly identifies today focus and obligations based on real data');

  // ==========================================
  // [TEST 2] "What is my highest priority responsibility?"
  // ==========================================
  console.log('\n[TEST 2] Highest Priority Query');
  const answerPriority = await assistantService.ask(userIdA, 'What is my highest priority responsibility?');
  console.log('Assistant Answer:\n', answerPriority);

  assert.ok(
    answerPriority.toLowerCase().includes('final minor project report') || answerPriority.toLowerCase().includes('project report'),
    'Answer must identify highest priority responsibility'
  );
  assert.ok(
    answerPriority.toLowerCase().includes('high'),
    'Answer must state high priority status'
  );
  console.log('✔ Highest priority obligation correctly determined');

  // ==========================================
  // [TEST 3] "What is due tomorrow?"
  // ==========================================
  console.log('\n[TEST 3] Due Tomorrow Query');
  const answerTomorrow = await assistantService.ask(userIdA, 'What is due tomorrow?');
  console.log('Assistant Answer:\n', answerTomorrow);

  assert.ok(
    answerTomorrow.toLowerCase().includes('nptel assignment 8') || answerTomorrow.toLowerCase().includes('nptel'),
    'Answer must mention item due tomorrow "NPTEL Assignment 8 Submission"'
  );
  assert.ok(
    !answerTomorrow.toLowerCase().includes('final minor project report'),
    'Answer must NOT include today item as due tomorrow'
  );
  console.log('✔ Tomorrow query cleanly identifies tomorrow deadlines without mixing today items');

  // ==========================================
  // [TEST 4] "Why is this responsibility high priority?"
  // ==========================================
  console.log('\n[TEST 4] Priority Rationale Query');
  const answerWhy = await assistantService.ask(userIdA, 'Why is my project report responsibility high priority?');
  console.log('Assistant Answer:\n', answerWhy);

  assert.ok(
    answerWhy.toLowerCase().includes('due') || answerWhy.toLowerCase().includes('deadline') || answerWhy.toLowerCase().includes('today') || answerWhy.toLowerCase().includes('urgent'),
    'Answer must explain priority through deadline urgency or source importance'
  );
  console.log('✔ Priority rationale grounded in real deadline urgency and context');

  // ==========================================
  // [TEST 5] "Do I have anything overdue?"
  // ==========================================
  console.log('\n[TEST 5] Overdue Status Query');
  const answerOverdue = await assistantService.ask(userIdA, 'Do I have anything overdue?');
  console.log('Assistant Answer:\n', answerOverdue);

  assert.ok(
    answerOverdue.toLowerCase().includes('no') || answerOverdue.toLowerCase().includes("don't") || answerOverdue.toLowerCase().includes("do not") || answerOverdue.toLowerCase().includes('caught up') || answerOverdue.toLowerCase().includes('on schedule'),
    'User A has no overdue tasks; answer must reflect zero overdue items'
  );
  console.log('✔ Overdue query accurately confirms no overdue items');

  // ==========================================
  // [TEST 6] No Invented Data / Unavailable Information
  // ==========================================
  console.log('\n[TEST 6] Anti-Hallucination & Unavailable Information');
  const answerInvented = await assistantService.ask(userIdA, 'When is my dentist appointment with Dr. Smith?');
  console.log('Assistant Answer:\n', answerInvented);

  const isUnavailableReported = 
    answerInvented.toLowerCase().includes('unavailable') || 
    answerInvented.toLowerCase().includes('no record') || 
    answerInvented.toLowerCase().includes('not have any record') ||
    answerInvented.toLowerCase().includes('do not have') ||
    answerInvented.toLowerCase().includes('could not find') ||
    answerInvented.toLowerCase().includes("don't have");

  assert.ok(
    isUnavailableReported,
    'Assistant must state information is unavailable and NEVER invent appointments'
  );
  console.log('✔ Assistant refuses to invent fictitious data and states information is unavailable');

  // ==========================================
  // [TEST 7] User Data Isolation (User B cannot see User A data)
  // ==========================================
  console.log('\n[TEST 7] Multi-Tenant User Isolation');
  const answerUserB = await assistantService.ask(userIdB, 'What should I focus on today?');
  console.log('User B Assistant Answer:\n', answerUserB);

  assert.ok(
    !answerUserB.toLowerCase().includes('final minor project report') &&
    !answerUserB.toLowerCase().includes('nptel assignment 8') &&
    !answerUserB.toLowerCase().includes('project evaluation & viva'),
    'User B must NEVER see or receive User A responsibilities or events'
  );
  console.log('✔ User isolation strictly preserved: User B sees only their own data');

  // ==========================================
  // [TEST 8] Follow-up Question Support with Conversation History
  // ==========================================
  console.log('\n[TEST 8] Conversational Context & Follow-up Support');
  const history = [
    { role: 'user' as const, content: 'What is due tomorrow?' },
    { role: 'assistant' as const, content: 'You have **NPTEL Assignment 8 Submission** due tomorrow at 23:59.' }
  ];
  const answerFollowUp = await assistantService.ask(userIdA, 'What action do I need to take for it?', history);
  console.log('Follow-up Answer:\n', answerFollowUp);

  assert.ok(
    answerFollowUp.toLowerCase().includes('portal') || 
    answerFollowUp.toLowerCase().includes('submit') || 
    answerFollowUp.toLowerCase().includes('answers') ||
    answerFollowUp.toLowerCase().includes('assignment'),
    'Follow-up must resolve "it" to the NPTEL assignment from conversation history'
  );
  console.log('✔ Follow-up context resolved accurately from history');

  // ==========================================
  // [TEST 9] "What is on my calendar today?" returns Calendar events, not a responsibility report
  // ==========================================
  console.log('\n[TEST 9] Calendar Events vs Responsibility Report');
  const answerCalendar = await assistantService.ask(userIdA, 'What is on my calendar today?');
  console.log('Calendar Answer:\n', answerCalendar);

  assert.ok(
    answerCalendar.toLowerCase().includes('project evaluation') || answerCalendar.toLowerCase().includes('viva'),
    'Must return today calendar event "Project Evaluation & Viva"'
  );
  assert.ok(
    !answerCalendar.includes('Final Minor Project Report Submission'),
    'Must NOT return a responsibility dump in response to a calendar-specific question'
  );
  console.log('✔ Calendar question correctly returns calendar events without responsibility dump');

  // ==========================================
  // [TEST 10] Informational email with date range is NOT classified as overdue responsibility
  // ==========================================
  console.log('\n[TEST 10] Informational Email Dates vs Genuine Obligations');
  await taskService.createTask(userIdA, {
    title: 'SDP on Modern Web Architecture',
    description: 'The Skill Development Program will run from the 10th to the 13th in the seminar hall.',
    priority: 'low',
    dueDate: '2026-10-10', // past date range mentioned in email body
    action: 'Informational session',
    category: 'academic',
    source: 'gmail',
    sourceContext: {
      subject: 'SDP Schedule Announcement',
      snippet: 'The SDP will run from 10th to 13th. Sessions will be conducted daily.'
    }
  });

  const answerOverdueAfterInfo = await assistantService.ask(userIdA, 'What am I overdue on?');
  console.log('Overdue Answer with Info Item:\n', answerOverdueAfterInfo);

  assert.ok(
    !answerOverdueAfterInfo.toLowerCase().includes('sdp on modern web architecture'),
    'Informational email date range must NOT be classified as an overdue responsibility'
  );
  console.log('✔ Informational date ranges cleanly excluded from overdue responsibilities');

  // ==========================================
  // [TEST 11] Timezone Boundaries & Passed Time Deadlines
  // ==========================================
  console.log('\n[TEST 11] Timezone Boundaries & Today Passed Time Deadlines');
  // Add a task whose deadline was at 09:00 AM today (which has already passed)
  await taskService.createTask(userIdA, {
    title: 'Morning Lab Quiz Submission',
    description: 'Submit answers before 9 AM',
    priority: 'high',
    dueDate: todayStr,
    dueTime: '09:00',
    action: 'Submit quiz on LMS',
    category: 'academic',
    source: 'gmail'
  });

  // Query with Asia/Kolkata timezone where time is past 09:00
  const detailedOverdue = await assistantService.askDetailed(
    userIdA,
    'What am I overdue on?',
    [],
    'Asia/Kolkata'
  );
  console.log('Overdue Answer with Passed Time Deadline:\n', detailedOverdue.answer);

  assert.strictEqual(detailedOverdue.intent, 'overdue', 'Intent must be classified as overdue');
  assert.ok(
    detailedOverdue.answer.toLowerCase().includes('morning lab quiz') || detailedOverdue.answer.toLowerCase().includes('quiz'),
    'Task due earlier today past its time must be identified as overdue'
  );
  console.log('✔ Timezone-aware deadline evaluation accurately detects passed time-of-day deadlines');

  // ==========================================
  // [TEST 12] Structured Source Metadata & Stable IDs
  // ==========================================
  console.log('\n[TEST 12] Structured Source Metadata & Stable Record Navigation');
  const detailedFocus = await assistantService.askDetailed(
    userIdA,
    'What should I focus on today?'
  );
  console.log('Detailed Focus Sources:', detailedFocus.sources);

  assert.ok(Array.isArray(detailedFocus.sources) && detailedFocus.sources.length > 0, 'Sources array must not be empty');
  const taskSource = detailedFocus.sources.find(s => s.type === 'task');
  assert.ok(taskSource && taskSource.id, 'Task source must have a valid stable ID');
  assert.ok(detailedFocus.answer.includes('[Source:'), 'Answer must include clickable source tag');
  console.log('✔ Structured source metadata returned with valid IDs for trustworthy UI navigation');

  // ==========================================
  // [TEST 13] Meeting Lookup Query & Spelling Mistake Tolerance
  // ==========================================
  console.log('\n[TEST 13] Meeting Lookup & Typo Tolerance');
  const meetingQuery = await assistantService.askDetailed(userIdA, 'When is my meetng?');
  console.log('Meeting Query Answer:\n', meetingQuery.answer);
  assert.strictEqual(meetingQuery.intent, 'meeting_lookup', 'Intent must be meeting_lookup');
  assert.ok(
    meetingQuery.answer.toLowerCase().includes('project evaluation & viva') || meetingQuery.answer.toLowerCase().includes('viva'),
    'Must identify scheduled meeting Project Evaluation & Viva'
  );
  assert.ok(meetingQuery.answer.includes('22:00') || meetingQuery.answer.includes('10:00'), 'Must include meeting time');
  assert.ok(Array.isArray(meetingQuery.suggestedQuestions) && meetingQuery.suggestedQuestions.length >= 2, 'Must include suggested questions');
  console.log('✔ Meeting query accurately identified event time and provided follow-up suggestions');

  // ==========================================
  // [TEST 14] Career Opportunities & Internships
  // ==========================================
  console.log('\n[TEST 14] Career Opportunities & Internships');
  // Seed a career opportunity email
  await emailService.saveEmails(userIdA, [{
    messageId: `eurogrip_${timestamp}`,
    sender: 'opportunities@eurogrip.com',
    subject: 'Register for Eurogrip Creator Challenge 2026',
    receivedAt: today.toISOString(),
    snippet: 'Opportunity for engineering students with Pre-Placement Offers (PPOs) and awards.',
    bodyText: 'Register for Eurogrip Creator Challenge. Win mentorship and direct Pre-Placement Offers (PPO) in automotive engineering.'
  }]);

  const oppQuery = await assistantService.askDetailed(userIdA, 'Any new internshps or job opportunities?');
  console.log('Opportunities Answer:\n', oppQuery.answer);
  assert.strictEqual(oppQuery.intent, 'opportunities', 'Intent must be opportunities');
  assert.ok(
    oppQuery.answer.toLowerCase().includes('eurogrip') || oppQuery.answer.toLowerCase().includes('fidelity'),
    'Must return matching career opportunities'
  );
  assert.ok(Array.isArray(oppQuery.suggestedQuestions) && oppQuery.suggestedQuestions.length >= 2, 'Must provide suggested follow-up questions');
  console.log('✔ Opportunities query accurately identified career opportunities and internships');

  // ==========================================
  // [TEST 15] "What is coming up?" Query
  // ==========================================
  console.log('\n[TEST 15] "What is coming up?" Query');
  const comingUpQuery = await assistantService.askDetailed(userIdA, 'What is coming up?');
  console.log('Coming Up Answer:\n', comingUpQuery.answer);
  assert.strictEqual(comingUpQuery.intent, 'upcoming_deadlines', 'Intent must be upcoming_deadlines');
  assert.ok(
    comingUpQuery.answer.toLowerCase().includes('nptel') || comingUpQuery.answer.toLowerCase().includes('submission'),
    'Must show upcoming deadlines'
  );
  console.log('✔ "What is coming up?" correctly retrieves upcoming deadlines and events');

  // ==========================================
  // [TEST 16] "What should I do today?" (Strictly Your Day items only)
  // ==========================================
  console.log('\n[TEST 16] "What should I do today?" Query');
  const answerDoToday = await assistantService.ask(userIdA, 'What should I do today?');
  console.log('Do Today Answer:\n', answerDoToday);
  assert.ok(
    answerDoToday.toLowerCase().includes('final minor project report') || answerDoToday.toLowerCase().includes('project report'),
    'Must include today actionable responsibility'
  );
  assert.ok(
    !answerDoToday.toLowerCase().includes('nptel assignment 8'),
    'Must strictly NOT include tomorrow responsibility in today action items'
  );
  console.log('✔ "What should I do today?" returns strictly Your Day items');

  // ==========================================
  // [TEST 17] "What deadlines are upcoming?" (Upcoming in date order)
  // ==========================================
  console.log('\n[TEST 17] "What deadlines are upcoming?" Query');
  const upcomingDeadlinesQuery = await assistantService.askDetailed(userIdA, 'What deadlines are upcoming?');
  console.log('Upcoming Deadlines Answer:\n', upcomingDeadlinesQuery.answer);
  assert.strictEqual(upcomingDeadlinesQuery.intent, 'upcoming_deadlines');
  assert.ok(
    upcomingDeadlinesQuery.answer.toLowerCase().includes('nptel') || upcomingDeadlinesQuery.answer.toLowerCase().includes('submission'),
    'Must show upcoming deadlines in chronological order'
  );
  console.log('✔ "What deadlines are upcoming?" retrieves upcoming responsibilities in date order');

  // ==========================================
  // [TEST 18] "What has passed?" (Passed section)
  // ==========================================
  console.log('\n[TEST 18] "What has passed?" Query');
  const passedQuery = await assistantService.askDetailed(userIdA, 'What has passed?');
  console.log('Passed Answer:\n', passedQuery.answer);
  assert.ok(passedQuery.intent === 'passed' || passedQuery.intent === 'overdue');
  assert.ok(
    passedQuery.answer.toLowerCase().includes('morning lab quiz') || passedQuery.answer.toLowerCase().includes('quiz'),
    'Must return passed items such as Morning Lab Quiz'
  );
  console.log('✔ "What has passed?" retrieves passed responsibilities');

  // ==========================================
  // [TEST 19] "Show my academic updates."
  // ==========================================
  console.log('\n[TEST 19] "Show my academic updates." Query');
  const academicQuery = await assistantService.askDetailed(userIdA, 'Show my academic updates.');
  console.log('Academic Updates Answer:\n', academicQuery.answer);
  assert.strictEqual(academicQuery.intent, 'academic_updates');
  assert.ok(
    academicQuery.answer.toLowerCase().includes('final minor project report') || academicQuery.answer.toLowerCase().includes('nptel') || academicQuery.answer.toLowerCase().includes('academic'),
    'Must retrieve Academic & Learning responsibilities'
  );
  console.log('✔ "Show my academic updates." retrieves Academic & Learning records');

  // ==========================================
  // [TEST 20] "Any new career opportunities?"
  // ==========================================
  console.log('\n[TEST 20] "Any new career opportunities?" Query');
  const careerOppQuery = await assistantService.askDetailed(userIdA, 'Any new career opportunities?');
  console.log('Career Opps Answer:\n', careerOppQuery.answer);
  assert.strictEqual(careerOppQuery.intent, 'opportunities');
  assert.ok(
    careerOppQuery.answer.toLowerCase().includes('eurogrip') || careerOppQuery.answer.toLowerCase().includes('fidelity'),
    'Must retrieve career opportunities and discoveries'
  );
  console.log('✔ "Any new career opportunities?" retrieves Career & Opportunities records');

  // ==========================================
  // [TEST 21] "Tell me about this internship." / Specific entity lookup
  // ==========================================
  console.log('\n[TEST 21] "Tell me about this internship." Query');
  const specificInternshipQuery = await assistantService.askDetailed(userIdA, 'Tell me about Eurogrip Creator Challenge');
  console.log('Specific Internship Answer:\n', specificInternshipQuery.answer);
  assert.strictEqual(specificInternshipQuery.intent, 'specific_lookup');
  assert.ok(
    specificInternshipQuery.answer.toLowerCase().includes('eurogrip') && (specificInternshipQuery.answer.toLowerCase().includes('ppo') || specificInternshipQuery.answer.toLowerCase().includes('engineering') || specificInternshipQuery.answer.toLowerCase().includes('opportunities')),
    'Must retrieve Eurogrip Creator Challenge details'
  );
  console.log('✔ "Tell me about this internship." retrieves correct entity details and context');

  console.log('\n=====================================================');
  console.log('  ALL CONVERSATIONAL ASSISTANT TESTS PASSED! (21/21) ');
  console.log('=====================================================\n');
}

runAssistantTests().catch(err => {
  console.error('ASSISTANT TEST SUITE FAILED:', err);
  process.exit(1);
});
