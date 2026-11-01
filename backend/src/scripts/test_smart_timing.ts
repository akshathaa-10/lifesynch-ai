import assert from 'assert';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { reminderService } from '../services/reminder.service';
import { taskService } from '../services/task.service';
import { userService } from '../services/db/user.service';
import { isSupabaseConfigured } from '../config/supabase';

async function runSmartTimingTests() {
  console.log('=====================================================');
  console.log('  LIFESYNCH AI — PHASE 6.3: SMART REMINDER TIMING    ');
  console.log('=====================================================\n');

  const anchorNow = new Date('2026-09-26T12:00:00.000Z');

  // ----------------------------------------------------------------
  // Test 1: Smart Reminder Timing Logic (Condition & Message Format)
  // ----------------------------------------------------------------
  console.log('[TEST 1] Smart Timing Condition & Message Evaluation');

  // 1a. Due Today (same day or within 24h)
  const condToday = reminderService.getReminderTimingCondition('2026-09-26T17:00:00.000Z', '17:00', anchorNow);
  assert.strictEqual(condToday, 'due_today', 'Deadline within 5h on same calendar day must be due_today');
  const msgToday = reminderService.formatReminderMessage('Project Report', '2026-09-26T17:00:00.000Z', '17:00', anchorNow);
  assert.strictEqual(msgToday, 'Project Report is due today at 5:00 PM.');

  // 1b. Due Tomorrow (next calendar day or within 24h-48h)
  const condTomorrow = reminderService.getReminderTimingCondition('2026-09-27T10:00:00.000Z', '10:00', anchorNow);
  assert.strictEqual(condTomorrow, 'due_tomorrow', 'Deadline on next day must be due_tomorrow');
  const msgTomorrow = reminderService.formatReminderMessage('Pitch Deck', '2026-09-27T10:00:00.000Z', '10:00', anchorNow);
  assert.strictEqual(msgTomorrow, 'Pitch Deck is due tomorrow at 10:00 AM.');

  // 1c. Approaching Deadline (2 to 3 days away)
  const condApproaching = reminderService.getReminderTimingCondition('2026-09-29T14:00:00.000Z', '14:00', anchorNow);
  assert.strictEqual(condApproaching, 'approaching', 'Deadline 3 days away must be approaching');
  const msgApproaching = reminderService.formatReminderMessage('AI Research Paper', '2026-09-29T14:00:00.000Z', '14:00', anchorNow);
  assert.strictEqual(msgApproaching, 'AI Research Paper deadline is approaching on September 29 at 2:00 PM.');

  // 1d. Distant Deadline (> 3 days away, e.g. 15 days): Must NOT generate reminders continuously
  const condDistant = reminderService.getReminderTimingCondition('2026-10-15T09:00:00.000Z', '09:00', anchorNow);
  assert.strictEqual(condDistant, null, 'Distant deadline (> 3 days) must return null to prevent continuous reminder spam');

  // 1e. Obsolete past deadline: Must NOT generate reminders
  const condPast = reminderService.getReminderTimingCondition('2026-09-20T10:00:00.000Z', '10:00', anchorNow);
  assert.strictEqual(condPast, null, 'Obsolete past deadline must return null');

  console.log('✔ Smart timing accurately detects due_today, due_tomorrow, and approaching deadlines');
  console.log('✔ Distant and obsolete deadlines correctly suppressed from continuous generation');

  // ----------------------------------------------------------------
  // Test 2: Real Database User Setup
  // ----------------------------------------------------------------
  console.log('\n[TEST 2] Setting up real test user and responsibilities');
  const testUser = await userService.upsertUser({
    email: `smart_timing_${Date.now()}@lifesynch.ai`,
    name: 'Smart Timing Test User'
  });
  console.log(`- Created test user: ${testUser.id}`);

  // Create Due-Tomorrow Item
  const taskTomorrow = await taskService.createTask(testUser.id, {
    title: 'Assignment 4 Submission',
    description: 'Operating systems lab assignment',
    action: 'Submit zip archive to portal',
    dueDate: '2026-09-27T18:00:00.000Z',
    dueTime: '18:00',
    priority: 'high',
    category: 'academic',
    source: 'gmail',
    sourceId: 'msg_assign_4'
  });

  // Create Due-Today Item
  const taskToday = await taskService.createTask(testUser.id, {
    title: 'SIH Final Pitch Deck',
    description: 'Hackathon round 2 deck',
    action: 'Finalize slides with team',
    dueDate: '2026-09-26T17:00:00.000Z',
    dueTime: '17:00',
    priority: 'high',
    category: 'academic',
    source: 'calendar',
    sourceId: 'evt_sih_pitch'
  });

  // Create Approaching Item (3 days away)
  const taskApproaching = await taskService.createTask(testUser.id, {
    title: 'Mid-term Viva Exam',
    description: 'Database management systems oral exam',
    action: 'Review ER modeling and SQL queries',
    dueDate: '2026-09-29T10:00:00.000Z',
    dueTime: '10:00',
    priority: 'medium',
    category: 'academic',
    source: 'calendar',
    sourceId: 'evt_db_viva'
  });

  // Create Distant Item (16 days away)
  const taskDistant = await taskService.createTask(testUser.id, {
    title: 'Annual Campus Placement Registration',
    description: 'Placement cell portal registration',
    action: 'Fill profile information',
    dueDate: '2026-10-12T23:59:00.000Z',
    priority: 'low',
    category: 'general',
    source: 'gmail',
    sourceId: 'msg_placement_distant'
  });

  // ----------------------------------------------------------------
  // Test 3: Generate Reminders & Verify Useful Points
  // ----------------------------------------------------------------
  console.log('\n[TEST 3] Generation at Useful Timing Points');
  const gen1 = await reminderService.generateRemindersForUser(testUser.id, anchorNow);
  console.log('- Sync 1 Summary:', gen1);
  assert.strictEqual(gen1.generated, 3, 'Must generate exactly 3 reminders (due today, due tomorrow, approaching)');

  const userReminders = await reminderService.getRemindersForUser(testUser.id);
  assert.strictEqual(userReminders.length, 3, 'Must have exactly 3 active reminders stored');

  const remToday = userReminders.find(r => r.responsibilityId === taskToday.id || r.title.includes('SIH Final Pitch Deck'));
  assert(remToday !== undefined, 'Due-today reminder must exist');
  assert.strictEqual(remToday?.message, 'SIH Final Pitch Deck is due today at 5:00 PM.');

  const remTomorrow = userReminders.find(r => r.responsibilityId === taskTomorrow.id || r.title.includes('Assignment 4'));
  assert(remTomorrow !== undefined, 'Due-tomorrow reminder must exist');
  assert.strictEqual(remTomorrow?.message, 'Assignment 4 Submission is due tomorrow at 6:00 PM.');

  const remApproaching = userReminders.find(r => r.responsibilityId === taskApproaching.id || r.title.includes('Mid-term Viva'));
  assert(remApproaching !== undefined, 'Approaching reminder must exist');
  assert.strictEqual(remApproaching?.message, 'Mid-term Viva Exam deadline is approaching on September 29 at 10:00 AM.');

  assert(!userReminders.some(r => r.title.includes('Placement Registration')), 'Distant item (> 3 days away) must NOT generate reminder');
  console.log('✔ Due-today item received correct reminder');
  console.log('✔ Due-tomorrow item received correct reminder');
  console.log('✔ Approaching item received correct reminder');
  console.log('✔ Distant item was appropriately suppressed from premature generation');

  // ----------------------------------------------------------------
  // Test 4: Repeated Automatic Syncs (NO NOTIFICATION SPAM)
  // ----------------------------------------------------------------
  console.log('\n[TEST 4] Repeated Automatic Syncs — Spam Prevention');
  for (let i = 2; i <= 4; i++) {
    const repeatSync = await reminderService.generateRemindersForUser(testUser.id, anchorNow);
    console.log(`- Repeated Sync ${i}: generated=${repeatSync.generated}, skipped=${repeatSync.skipped}`);
    assert.strictEqual(repeatSync.generated, 0, `Sync ${i} must generate 0 duplicate reminders`);
    assert(repeatSync.skipped >= 3, `Sync ${i} must skip already notified conditions`);
  }

  const remindersAfterRepeat = await reminderService.getRemindersForUser(testUser.id);
  assert.strictEqual(remindersAfterRepeat.length, 3, 'Reminder count must remain strictly constant after repeated syncs');
  console.log('✔ Zero notification spam: repeated automatic syncs create NO duplicate reminders');

  // ----------------------------------------------------------------
  // Test 5: Condition Transition (Due Tomorrow -> Due Today)
  // ----------------------------------------------------------------
  console.log('\n[TEST 5] Condition Transition (Due Tomorrow -> Due Today)');
  // Advance time to next day (2026-09-27 12:00 UTC)
  const nextDayNow = new Date('2026-09-27T12:00:00.000Z');

  // taskTomorrow ('Assignment 4 Submission') is now due TODAY!
  const transitionSync1 = await reminderService.generateRemindersForUser(testUser.id, nextDayNow);
  console.log('- Day 2 Sync 1 Summary:', transitionSync1);
  assert.strictEqual(transitionSync1.generated, 1, 'Should generate exactly 1 new reminder for the newly reached due_today condition');

  const remindersDay2 = await reminderService.getRemindersForUser(testUser.id);
  const updatedRemToday = remindersDay2.find(r => (r.responsibilityId === taskTomorrow.id || r.title.includes('Assignment 4')) && r.message.includes('due today'));
  assert(updatedRemToday !== undefined, 'Due-today reminder must exist for Assignment 4 on Day 2');
  assert.strictEqual(updatedRemToday?.message, 'Assignment 4 Submission is due today at 6:00 PM.');

  // Repeated sync on Day 2 must NOT duplicate
  const transitionSync2 = await reminderService.generateRemindersForUser(testUser.id, nextDayNow);
  assert.strictEqual(transitionSync2.generated, 0, 'Repeated sync on Day 2 must generate 0 duplicate reminders');
  console.log('✔ Clean condition transition from due-tomorrow to due-today without notification spam');

  // ----------------------------------------------------------------
  // Test 6: Completed and Cancelled Items Excluded
  // ----------------------------------------------------------------
  console.log('\n[TEST 6] Status Check: Completed and Cancelled Items Excluded');
  
  // 6a. Already completed task creates zero reminders
  const completedTask = await taskService.createTask(testUser.id, {
    title: 'Completed Machine Learning Quiz',
    description: 'Submitted and graded',
    action: 'Already submitted',
    dueDate: '2026-09-27T17:00:00.000Z',
    status: 'COMPLETED'
  });

  // 6b. Already cancelled task creates zero reminders
  const cancelledTask = await taskService.createTask(testUser.id, {
    title: 'Cancelled Guest Speaker Lecture',
    description: 'Event cancelled',
    action: 'None',
    dueDate: '2026-09-27T17:00:00.000Z',
    status: 'CANCELLED'
  });

  const syncAfterInactive = await reminderService.generateRemindersForUser(testUser.id, nextDayNow);
  assert.strictEqual(syncAfterInactive.generated, 0, 'No reminders should be generated for completed or cancelled tasks');

  const remindersList = await reminderService.getRemindersForUser(testUser.id);
  assert(!remindersList.some(r => r.title.includes('Completed Machine Learning')), 'Completed task must NOT show reminder');
  assert(!remindersList.some(r => r.title.includes('Cancelled Guest Speaker')), 'Cancelled task must NOT show reminder');

  // 6c. Dynamically completing an active responsibility removes it from active reminders
  await taskService.updateTask(taskTomorrow.id, { status: 'COMPLETED' });
  const remindersAfterCompletingTomorrow = await reminderService.getRemindersForUser(testUser.id);
  assert(!remindersAfterCompletingTomorrow.some(r => r.title.includes('Assignment 4')), 'Dynamically completed task must NOT show active reminder');

  // 6d. Dynamically cancelling an active responsibility removes it from active reminders
  await taskService.updateTask(taskApproaching.id, { status: 'CANCELLED' });
  const remindersAfterCancellingApproaching = await reminderService.getRemindersForUser(testUser.id);
  assert(!remindersAfterCancellingApproaching.some(r => r.title.includes('Mid-term Viva')), 'Dynamically cancelled task must NOT show active reminder');

  console.log('✔ Completed tasks are strictly excluded from generating reminders');
  console.log('✔ Cancelled tasks are strictly excluded from generating reminders');
  console.log('✔ Dynamically completed/cancelled items are immediately hidden from active reminders');

  // ----------------------------------------------------------------
  // Test 7: Live User Idempotency Check
  // ----------------------------------------------------------------
  console.log('\n[TEST 7] Live User Idempotency & Zero Spam Verification');
  if (isSupabaseConfigured()) {
    const liveUserId = '58889ae0-090d-4d7c-a420-02cfa6e97da0';
    const liveRemindersBefore = await reminderService.getRemindersForUser(liveUserId);
    console.log(`- Authenticated live user has ${liveRemindersBefore.length} active reminders`);

    const liveSync1 = await reminderService.generateRemindersForUser(liveUserId);
    console.log('- Live Sync 1:', liveSync1);
    assert.strictEqual(liveSync1.generated, 0, 'Live repeated sync must generate 0 duplicate reminders');

    const liveSync2 = await reminderService.generateRemindersForUser(liveUserId);
    console.log('- Live Sync 2:', liveSync2);
    assert.strictEqual(liveSync2.generated, 0, 'Live repeated sync 2 must generate 0 duplicate reminders');

    const liveRemindersAfter = await reminderService.getRemindersForUser(liveUserId);
    assert.strictEqual(liveRemindersAfter.length, liveRemindersBefore.length, 'Live reminder count must remain constant');
    console.log('✔ Live user repeated sync generates ZERO duplicate reminders');
  }

  console.log('\n=====================================================');
  console.log(' ALL SMART REMINDER TIMING TESTS PASSED! (7/7)       ');
  console.log('=====================================================\n');
}

runSmartTimingTests().catch(err => {
  console.error('SMART TIMING TEST SUITE FAILED:', err);
  process.exit(1);
});
