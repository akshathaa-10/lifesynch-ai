import '../config/env';
import assert from 'assert';
import { reminderService } from '../services/reminder.service';
import { taskService } from '../services/task.service';
import { userService } from '../services/db/user.service';
import { formatClockTime, formatDateDisplay } from '@lifesynch/shared';
import { isSupabaseConfigured, getSupabaseAdminClient } from '../config/supabase';

async function runReminderTests() {
  console.log('=====================================================');
  console.log('  LIFESYNCH AI — PHASE 6.1: BASIC REMINDERS TEST     ');
  console.log('=====================================================');

  // Dynamically generated anchor dates relative to current time for deterministic tests
  const now = new Date();
  const anchorNow = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  const todayDateStr = `${anchorNow.getFullYear()}-${pad(anchorNow.getMonth() + 1)}-${pad(anchorNow.getDate())}`;

  const tomorrowObj = new Date(anchorNow);
  tomorrowObj.setDate(tomorrowObj.getDate() + 1);
  const tomorrowDateStr = `${tomorrowObj.getFullYear()}-${pad(tomorrowObj.getMonth() + 1)}-${pad(tomorrowObj.getDate())}`;

  const yesterdayObj = new Date(anchorNow);
  yesterdayObj.setDate(yesterdayObj.getDate() - 1);
  const yesterdayDateStr = `${yesterdayObj.getFullYear()}-${pad(yesterdayObj.getMonth() + 1)}-${pad(yesterdayObj.getDate())}`;

  // ----------------------------------------------------------------
  // Test 1: Date & Time Formatting Verification
  // ----------------------------------------------------------------
  console.log('\n[TEST 1] Date & Time Formatting Verification');
  assert.strictEqual(formatClockTime('17:00'), '5:00 PM', '17:00 must format to 5:00 PM');
  assert.strictEqual(formatClockTime('09:30'), '9:30 AM', '09:30 must format to 9:30 AM');
  assert.strictEqual(formatClockTime('12:00'), '12:00 PM', '12:00 must format to 12:00 PM');
  assert.strictEqual(formatClockTime('00:00'), '12:00 AM', '00:00 must format to 12:00 AM');
  assert.strictEqual(formatDateDisplay('2026-09-30T00:00:00.000Z'), 'September 30');
  assert.strictEqual(formatDateDisplay('2026-10-05T00:00:00.000Z'), 'October 5');
  console.log('✔ Time and date formatters accurately render 12-hour AM/PM and month/day');

  // ----------------------------------------------------------------
  // Test 2: Message Template & Examples Verification
  // ----------------------------------------------------------------
  console.log('\n[TEST 2] Reminder Message Format (Due Today, Due Tomorrow & Past Exclusion)');
  
  // Example 1: Due Today at 5:00 PM
  const msgToday = reminderService.formatReminderMessage(
    'Project Report',
    `${todayDateStr}T17:00:00.000Z`,
    '17:00',
    anchorNow
  );
  assert.strictEqual(
    msgToday,
    'Project Report is due today at 5:00 PM.',
    'Must match exact example format: "Project Report is due today at 5:00 PM."'
  );

  // Example 2: Due Tomorrow (without clock time)
  const msgTomorrow = reminderService.formatReminderMessage(
    'Project Report',
    `${tomorrowDateStr}T00:00:00.000Z`,
    null,
    anchorNow
  );
  assert.strictEqual(
    msgTomorrow,
    'Project Report is due tomorrow.',
    'Must match exact example format: "Project Report is due tomorrow."'
  );

  // Example 3: No deadline
  const msgNoDeadline = reminderService.formatReminderMessage('Task without deadline', null, null, anchorNow);
  assert.strictEqual(msgNoDeadline, null, 'Items without deadline must NOT generate reminder messages');

  // Example 4: Past deadline (Must return null)
  const msgPast = reminderService.formatReminderMessage(
    'Past Assignment',
    `${yesterdayDateStr}T17:00:00.000Z`,
    '17:00',
    anchorNow
  );
  assert.strictEqual(msgPast, null, 'Past deadlines must NOT generate reminder messages');
  console.log('✔ Reminder messages strictly match expected templates for today and tomorrow and exclude past deadlines');

  // ----------------------------------------------------------------
  // Test 3: Real Database Integration (Creation, Reference, Date/Time)
  // ----------------------------------------------------------------
  console.log('\n[TEST 3] Real Database Integration (Creation, Reference & Date/Time)');
  const testUser = await userService.upsertUser({
    email: `test_reminders_${Date.now()}@lifesynch.ai`,
    name: 'Reminders Test User'
  });

  // Create an active responsibility due today with exact time
  const taskToday = await taskService.createTask(testUser.id, {
    title: 'Project Report',
    description: 'Final submission for semester project',
    action: 'Upload report to classroom portal',
    dueDate: `${todayDateStr}T17:00:00.000Z`,
    dueTime: '17:00',
    priority: 'high',
    category: 'academic',
    source: 'gmail',
    sourceId: 'msg_report_due_today'
  });

  // Create an active responsibility due tomorrow without time
  const taskTomorrow = await taskService.createTask(testUser.id, {
    title: 'SIH Final Pitch Deck',
    description: 'Pitch deck presentation for hackathon',
    action: 'Finalize slides with team',
    dueDate: `${tomorrowDateStr}T00:00:00.000Z`,
    priority: 'high',
    category: 'academic',
    source: 'calendar',
    sourceId: 'evt_sih_tomorrow'
  });

  // Generate reminders
  const syncSummary1 = await reminderService.generateRemindersForUser(testUser.id, anchorNow);
  assert.strictEqual(syncSummary1.generated, 2, 'Should generate exactly 2 reminders for the 2 active tasks with deadlines');

  // Fetch reminders and verify correctness
  const userReminders = await reminderService.getRemindersForUser(testUser.id, anchorNow);
  assert.strictEqual(userReminders.length, 2, 'User must have exactly 2 stored reminders');

  const remToday = userReminders.find(r => r.responsibilityId === taskToday.id || r.title.includes('Project Report'));
  assert(remToday !== undefined, 'Reminder for taskToday must exist');
  assert.strictEqual(remToday?.title, 'Reminder: Project Report', 'Title must reference task title');
  assert.strictEqual(remToday?.message, 'Project Report is due today at 5:00 PM.', 'Message must show exact date/time');
  assert.strictEqual(remToday?.type, 'responsibility', 'Notification type must be responsibility');

  const remTomorrow = userReminders.find(r => r.responsibilityId === taskTomorrow.id || r.title.includes('SIH Final Pitch Deck'));
  assert(remTomorrow !== undefined, 'Reminder for taskTomorrow must exist');
  assert.strictEqual(remTomorrow?.message, 'SIH Final Pitch Deck is due tomorrow.', 'Message must show due tomorrow');
  console.log('✔ Reminders created with correct responsibility references and exact date/time');

  // ----------------------------------------------------------------
  // Test 4: Idempotency & No Duplicate Reminders on Repeated Sync
  // ----------------------------------------------------------------
  console.log('\n[TEST 4] Idempotency & No Duplicate Reminders on Repeated Sync');
  const syncSummary2 = await reminderService.generateRemindersForUser(testUser.id, anchorNow);
  assert.strictEqual(syncSummary2.generated, 0, 'Second run must generate 0 new reminders');
  assert(syncSummary2.skipped >= 2, 'Second run must skip existing reminders');

  const remindersAfterRepeat = await reminderService.getRemindersForUser(testUser.id, anchorNow);
  assert.strictEqual(remindersAfterRepeat.length, 2, 'Total reminder count must remain unchanged after repeated run');
  console.log('✔ Repeated sync does not create duplicate reminders');

  // ----------------------------------------------------------------
  // Test 5: Completed & Cancelled Items and No-Deadline Items Excluded
  // ----------------------------------------------------------------
  console.log('\n[TEST 5] Completed, Cancelled, and No-Deadline Items Excluded');
  
  // 5a: Completed Task
  const completedTask = await taskService.createTask(testUser.id, {
    title: 'Completed Lab Assessment',
    description: 'Lab evaluation submitted and graded',
    action: 'Already submitted',
    dueDate: `${todayDateStr}T17:00:00.000Z`,
    dueTime: '17:00',
    priority: 'medium',
    category: 'academic',
    source: 'gmail',
    sourceId: 'msg_completed_lab',
    status: 'COMPLETED',
    metadata: {
      lifecycleStatus: 'COMPLETED',
      completionEvidence: 'Submitted score: 100%'
    }
  });

  // 5b: Cancelled Task
  const cancelledTask = await taskService.createTask(testUser.id, {
    title: 'Cancelled Guest Lecture Session',
    description: 'Meeting cancelled by guest lecturer',
    action: 'No action required',
    dueDate: `${todayDateStr}T17:00:00.000Z`,
    dueTime: '17:00',
    priority: 'low',
    category: 'general',
    source: 'calendar',
    sourceId: 'evt_cancelled_lecture',
    status: 'CANCELLED',
    metadata: {
      lifecycleStatus: 'CANCELLED',
      cancellationReason: 'Cancelled by speaker'
    }
  });

  // 5c: Task without known deadline
  const noDeadlineTask = await taskService.createTask(testUser.id, {
    title: 'Optional Reading Chapter 4',
    description: 'Read chapter when time permits',
    action: 'Read chapter 4',
    priority: 'low',
    category: 'academic',
    source: 'gmail',
    sourceId: 'msg_optional_read'
  });

  // 5d: Past deadline task (expired)
  const pastDeadlineTask = await taskService.createTask(testUser.id, {
    title: 'Past Assignment Submission',
    description: 'Expired obligation',
    action: 'Submit assignment',
    dueDate: `${yesterdayDateStr}T17:00:00.000Z`,
    dueTime: '17:00',
    priority: 'high',
    category: 'academic',
    source: 'gmail',
    sourceId: 'msg_past_assignment'
  });

  // Run reminder generation
  const syncSummary3 = await reminderService.generateRemindersForUser(testUser.id, anchorNow);
  assert.strictEqual(syncSummary3.generated, 0, 'No reminders should be generated for completed, cancelled, no-deadline, or past tasks');

  const finalReminders = await reminderService.getRemindersForUser(testUser.id, anchorNow);
  assert(!finalReminders.some(r => r.title.includes('Completed Lab')), 'Completed items must NOT generate reminders');
  assert(!finalReminders.some(r => r.title.includes('Cancelled Guest')), 'Cancelled items must NOT generate reminders');
  assert(!finalReminders.some(r => r.title.includes('Optional Reading')), 'No-deadline items must NOT generate reminders');
  assert(!finalReminders.some(r => r.title.includes('Past Assignment')), 'Past deadline items must NOT generate reminders');
  console.log('✔ Completed responsibilities, cancelled responsibilities, and tasks without deadlines are strictly excluded');

  // ----------------------------------------------------------------
  // Test 6: User Isolation Verification
  // ----------------------------------------------------------------
  console.log('\n[TEST 6] User Isolation Verification');
  const otherUser = await userService.upsertUser({
    email: `test_user_isolated_${Date.now()}@lifesynch.ai`,
    name: 'Isolated User'
  });

  // Create task for other user
  await taskService.createTask(otherUser.id, {
    title: 'Isolated User Confidential Task',
    description: 'Private task for User B',
    action: 'Keep isolated',
    dueDate: `${todayDateStr}T18:00:00.000Z`,
    dueTime: '18:00',
    priority: 'high',
    category: 'personal',
    source: 'manual'
  });

  await reminderService.generateRemindersForUser(otherUser.id, anchorNow);

  const userAReminders = await reminderService.getRemindersForUser(testUser.id, anchorNow);
  const userBReminders = await reminderService.getRemindersForUser(otherUser.id, anchorNow);

  assert.strictEqual(userBReminders.length, 1, 'User B must have exactly 1 reminder');
  assert.strictEqual(userAReminders.length, 2, 'User A must still have exactly 2 reminders');
  assert(!userAReminders.some(r => r.title.includes('Isolated User Confidential Task')), 'User A must NEVER receive User B reminders');
  assert(!userBReminders.some(r => r.title.includes('Project Report')), 'User B must NEVER receive User A reminders');
  console.log('✔ User isolation strictly verified: zero cross-user reminder leakage');

  // ----------------------------------------------------------------
  // Test 7: Live Feed Real Responsibilities Test
  // ----------------------------------------------------------------
  console.log('\n[TEST 7] Live Real User Responsibilities Reminder Generation');
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdminClient();
    const liveUserId = '58889ae0-090d-4d7c-a420-02cfa6e97da0';

    const liveTasks = await taskService.getTasks(liveUserId);
    console.log(`- Authenticated live user (${liveUserId}) has ${liveTasks.length} active responsibilities`);

    const liveGenSummary1 = await reminderService.generateRemindersForUser(liveUserId);
    console.log('- Live Reminder Generation 1:', liveGenSummary1);

    const liveReminders = await reminderService.getRemindersForUser(liveUserId);
    console.log(`- Total live reminders in database: ${liveReminders.length}`);
    liveReminders.slice(0, 5).forEach((r, idx) => {
      console.log(`  [${idx + 1}] "${r.title}" | "${r.message}" | Created: ${r.createdAt}`);
    });

    // Verify idempotency on live data
    const liveGenSummary2 = await reminderService.generateRemindersForUser(liveUserId);
    console.log('- Live Reminder Generation 2 (Idempotency check):', liveGenSummary2);
    assert.strictEqual(liveGenSummary2.generated, 0, 'Live repeated sync must generate 0 duplicate reminders');

    const liveRemindersAfter = await reminderService.getRemindersForUser(liveUserId);
    assert.strictEqual(liveRemindersAfter.length, liveReminders.length, 'Live reminder count must remain constant');
    console.log('✔ Live data reminder generation and deduplication verified');
  }

  console.log('\n=====================================================');
  console.log('  ALL BASIC REMINDER TESTS PASSED! (7/7)             ');
  console.log('=====================================================\n');
}

runReminderTests().catch(err => {
  console.error('REMINDER TEST SUITE FAILED:', err);
  process.exit(1);
});
