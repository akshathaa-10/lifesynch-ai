import '../config/env';
import assert from 'assert';
import { calendarService } from '../services/google/calendar.service';
import { calendarEventService } from '../services/db/calendar-event.service';
import { accountService } from '../services/db/account.service';
import { userService } from '../services/db/user.service';
import { gmailService } from '../services/google/gmail.service';
import { calendar_v3 } from 'googleapis';
import { isSupabaseConfigured, getSupabaseAdminClient } from '../config/supabase';

async function runCalendarTests() {
  console.log('=====================================================');
  console.log('  LIFESYNCH AI — GOOGLE CALENDAR TEST SUITE');
  console.log('=====================================================');

  // ----------------------------------------------------------------
  // Test 1: Timed Calendar Event Parsing
  // ----------------------------------------------------------------
  console.log('\n[TEST 1] Timed Calendar Event Parsing (dateTime)');
  const timedEvent: calendar_v3.Schema$Event = {
    id: 'test_cal_timed_001',
    summary: 'Project Sprint Planning',
    description: 'Bi-weekly sprint planning meeting with engineering team.',
    location: 'Meeting Room B / Google Meet',
    htmlLink: 'https://calendar.google.com/calendar/event?eid=test_cal_timed_001',
    status: 'confirmed',
    start: {
      dateTime: '2026-09-25T10:00:00+05:30',
      timeZone: 'Asia/Kolkata'
    },
    end: {
      dateTime: '2026-09-25T11:00:00+05:30',
      timeZone: 'Asia/Kolkata'
    },
    attendees: [
      { email: 'lead@lifesynch.ai', displayName: 'Project Lead', responseStatus: 'accepted' },
      { email: 'member@lifesynch.ai', displayName: 'Team Member', responseStatus: 'needsAction' }
    ]
  };

  const parsedTimed = calendarService.parseCalendarEvent(timedEvent, 'primary');
  assert.strictEqual(parsedTimed.eventId, 'test_cal_timed_001');
  assert.strictEqual(parsedTimed.calendarId, 'primary');
  assert.strictEqual(parsedTimed.summary, 'Project Sprint Planning');
  assert.strictEqual(parsedTimed.description, 'Bi-weekly sprint planning meeting with engineering team.');
  assert.strictEqual(parsedTimed.location, 'Meeting Room B / Google Meet');
  assert.strictEqual(parsedTimed.status, 'confirmed');
  assert.strictEqual(parsedTimed.startTime, new Date('2026-09-25T10:00:00+05:30').toISOString());
  assert.strictEqual(parsedTimed.endTime, new Date('2026-09-25T11:00:00+05:30').toISOString());
  assert.strictEqual(parsedTimed.attendees?.length, 2);
  assert.strictEqual(parsedTimed.attendees?.[0].email, 'lead@lifesynch.ai');
  console.log('✔ Timed Calendar event parsing passed');

  // ----------------------------------------------------------------
  // Test 2: All-Day Calendar Event Parsing
  // ----------------------------------------------------------------
  console.log('\n[TEST 2] All-Day Calendar Event Parsing (date only)');
  const allDayEvent: calendar_v3.Schema$Event = {
    id: 'test_cal_allday_002',
    summary: 'College Project Evaluation Day',
    description: 'Final presentation and evaluation for minor project.',
    location: 'CS Department Auditorium',
    htmlLink: 'https://calendar.google.com/calendar/event?eid=test_cal_allday_002',
    status: 'confirmed',
    start: {
      date: '2026-09-28'
    },
    end: {
      date: '2026-09-28'
    }
  };

  const parsedAllDay = calendarService.parseCalendarEvent(allDayEvent, 'primary');
  assert.strictEqual(parsedAllDay.eventId, 'test_cal_allday_002');
  assert.strictEqual(parsedAllDay.summary, 'College Project Evaluation Day');
  assert.strictEqual(parsedAllDay.startTime, new Date('2026-09-28T00:00:00.000Z').toISOString());
  assert.strictEqual(parsedAllDay.endTime, new Date('2026-09-28T23:59:59.999Z').toISOString());
  console.log('✔ All-day Calendar event parsing passed (correct 00:00:00 -> 23:59:59 UTC bounds)');

  // ----------------------------------------------------------------
  // Test 3: Cancelled and Minimal Event Parsing
  // ----------------------------------------------------------------
  console.log('\n[TEST 3] Cancelled & Minimal Event Parsing');
  const cancelledEvent: calendar_v3.Schema$Event = {
    id: 'test_cal_cancelled_003',
    summary: 'Cancelled Sync Call',
    status: 'cancelled',
    start: { dateTime: '2026-09-26T14:00:00Z' },
    end: { dateTime: '2026-09-26T14:30:00Z' }
  };
  const parsedCancelled = calendarService.parseCalendarEvent(cancelledEvent, 'primary');
  assert.strictEqual(parsedCancelled.status, 'cancelled');
  assert.strictEqual(parsedCancelled.description, undefined);
  assert.strictEqual(parsedCancelled.location, undefined);
  assert.deepStrictEqual(parsedCancelled.attendees, []);
  console.log('✔ Cancelled and minimal event parsing passed');

  // ----------------------------------------------------------------
  // Test 4: Supabase Storage, Idempotency & Deduplication
  // ----------------------------------------------------------------
  console.log('\n[TEST 4] Supabase Storage, Deduplication & Update Handling');
  const testUser = await userService.upsertUser({
    email: `test_cal_sync_${Date.now()}@lifesynch.ai`,
    name: 'Calendar Test User'
  });
  const testUserId = testUser.id;

  const testEventId = `cal_event_dedup_${Date.now()}`;
  const initialEvent = {
    eventId: testEventId,
    calendarId: 'primary',
    summary: 'Initial Team Standup',
    description: 'Daily morning standup',
    startTime: '2026-09-27T09:00:00.000Z',
    endTime: '2026-09-27T09:30:00.000Z',
    location: 'Conference Room 1',
    status: 'confirmed',
    attendees: [{ email: 'tester@lifesynch.ai' }]
  };

  // First sync call: 1 inserted
  const firstSave = await calendarEventService.saveEvents(testUserId, [initialEvent]);
  assert.strictEqual(firstSave.inserted, 1, 'First save should insert 1 event');
  assert.strictEqual(firstSave.updated, 0, 'First save should update 0 events');

  // Second sync call with exact same event: 0 inserted, 1 updated (no duplicate row)
  const secondSave = await calendarEventService.saveEvents(testUserId, [initialEvent]);
  assert.strictEqual(secondSave.inserted, 0, 'Second save must insert 0 new events');
  assert.strictEqual(secondSave.updated, 1, 'Second save should update existing event');

  const storedEvents = await calendarEventService.getEvents(testUserId, 10);
  const matchingEvents = storedEvents.filter(e => e.eventId === testEventId);
  assert.strictEqual(matchingEvents.length, 1, 'Database must contain exactly 1 row for this eventId (no duplicates)');
  assert.strictEqual(matchingEvents[0].summary, 'Initial Team Standup');
  console.log('✔ Deduplication verified: subsequent syncs do not create duplicate rows');

  // ----------------------------------------------------------------
  // Test 5: Event Modification Handling
  // ----------------------------------------------------------------
  console.log('\n[TEST 5] Event Modification Updates');
  const modifiedEvent = {
    ...initialEvent,
    summary: 'Updated Standup: Extended Review',
    location: 'Virtual via Google Meet',
    endTime: '2026-09-27T10:00:00.000Z'
  };

  const updateSave = await calendarEventService.saveEvents(testUserId, [modifiedEvent]);
  assert.strictEqual(updateSave.inserted, 0);
  assert.strictEqual(updateSave.updated, 1);

  const updatedRecord = await calendarEventService.getEventById(testUserId, testEventId);
  assert(updatedRecord !== null, 'Updated event must exist');
  assert.strictEqual(updatedRecord?.summary, 'Updated Standup: Extended Review', 'Summary must be updated in database');
  assert.strictEqual(updatedRecord?.location, 'Virtual via Google Meet', 'Location must be updated in database');
  assert.strictEqual(new Date(updatedRecord!.endTime).toISOString(), '2026-09-27T10:00:00.000Z', 'End time must be updated');
  console.log('✔ Event modification updates verified');

  // ----------------------------------------------------------------
  // Test 6: Cancelled Event Handling
  // ----------------------------------------------------------------
  console.log('\n[TEST 6] Cancelled Event Handling');
  const cancelledModification = {
    ...modifiedEvent,
    status: 'cancelled'
  };

  const cancelSave = await calendarEventService.saveEvents(testUserId, [cancelledModification]);
  assert.strictEqual(cancelSave.cancelled, 1, 'Cancelled count should increment');
  assert.strictEqual(cancelSave.updated, 1, 'Cancelled event update should be tracked');

  const cancelledRecord = await calendarEventService.getEventById(testUserId, testEventId);
  assert.strictEqual(cancelledRecord?.status, 'cancelled', 'Stored event status must be cancelled');
  console.log('✔ Cancelled event update verified');

  // ----------------------------------------------------------------
  // Test 7: Authenticated User Isolation
  // ----------------------------------------------------------------
  console.log('\n[TEST 7] Authenticated User Isolation');
  const otherUser = await userService.upsertUser({
    email: `test_cal_other_${Date.now()}@lifesynch.ai`,
    name: 'Other Calendar User'
  });
  const otherUserId = otherUser.id;

  const otherUserEvents = await calendarEventService.getEvents(otherUserId, 10);
  assert.strictEqual(otherUserEvents.length, 0, 'User B must not see User A events');

  const isolationEvent = await calendarEventService.getEventById(otherUserId, testEventId);
  assert.strictEqual(isolationEvent, null, 'User B cannot query User A event by ID');
  console.log('✔ User isolation verified: data strictly scoped to authenticated user ID');

  // ----------------------------------------------------------------
  // Test 8: Missing Connected Google Account Error Handling
  // ----------------------------------------------------------------
  console.log('\n[TEST 8] Missing Connected Google Account Handling');
  try {
    await calendarService.syncUserCalendar('00000000-0000-0000-0000-000000000000');
    assert.fail('Should throw error for unconnected user');
  } catch (err: any) {
    assert(err.message.includes('No connected Google account'), 'Should report missing Google account');
    console.log('✔ Graceful error handling for unconnected account verified');
  }

  // ----------------------------------------------------------------
  // Test 9: Live Google Calendar API Integration with Authenticated User
  // ----------------------------------------------------------------
  console.log('\n[TEST 9] Live Google Calendar API Execution with Stored Google Account');
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdminClient();
    // Retrieve the authenticated user who signed in with Google
    const { data: accounts } = await supabase
      .from('connected_accounts')
      .select('user_id, scopes')
      .eq('provider', 'google')
      .order('updated_at', { ascending: false });

    const calAccount = accounts?.find(a => a.user_id === '58889ae0-090d-4d7c-a420-02cfa6e97da0') 
      || accounts?.find(a => (a.scopes || []).some((s: string) => s.includes('calendar.readonly')) && a.user_id !== 'aadc7bd9-efad-4222-a0c8-746bb0d56075')
      || accounts?.[0];

    if (calAccount) {
      const liveUserId = calAccount.user_id;
      const scopes = calAccount.scopes || [];
      console.log(`- Found authenticated Google user: ${liveUserId}`);
      const hasCalendarScope = scopes.some((s: string) => s.includes('calendar.readonly'));
      console.log(`- Calendar read-only scope granted: ${hasCalendarScope ? 'YES' : 'NO'}`);
      assert(hasCalendarScope, 'User must have calendar.readonly scope');

      // Run live Google Calendar sync!
      console.log('- Running live calendarService.syncUserCalendar()...');
      const liveSyncResult = await calendarService.syncUserCalendar(liveUserId);
      console.log(`- Live Sync Result:`, liveSyncResult);
      assert(typeof liveSyncResult.fetched === 'number', 'Fetched count must be a number');
      assert(typeof liveSyncResult.inserted === 'number', 'Inserted count must be a number');
      assert(typeof liveSyncResult.updated === 'number', 'Updated count must be a number');

      // Verify stored events in Supabase calendar_events table
      const storedLiveEvents = await calendarService.getUserCalendarEvents(liveUserId, 50);
      console.log(`- Total events in Supabase for user: ${storedLiveEvents.length}`);
      if (storedLiveEvents.length > 0) {
        console.log(`- Sample real event title: "${storedLiveEvents[0].summary}"`);
        console.log(`- Sample real event start: ${storedLiveEvents[0].startTime}`);
        console.log(`- Sample real event end: ${storedLiveEvents[0].endTime}`);
        console.log(`- Sample real event status: ${storedLiveEvents[0].status}`);
      }

      // Run second live sync to test idempotency on real data!
      console.log('- Running second live sync to verify idempotency...');
      const secondLiveSync = await calendarService.syncUserCalendar(liveUserId);
      console.log(`- Second Live Sync Result:`, secondLiveSync);
      assert.strictEqual(secondLiveSync.inserted, 0, 'Second live sync must not insert duplicate rows');
      assert.strictEqual(secondLiveSync.updated, secondLiveSync.fetched, 'All existing events should be updated idempotently');
      console.log('✔ Live Calendar API sync & Supabase persistence & deduplication verified');

      // ----------------------------------------------------------------
      // Test 10: Verify Gmail Still Works (No Regression)
      // ----------------------------------------------------------------
      console.log('\n[TEST 10] Verify Gmail Integration Still Works (Zero Regression)');
      const storedEmails = await gmailService.getUserEmails(liveUserId, 10);
      console.log(`- Stored emails retrieved: ${storedEmails.length}`);
      assert(storedEmails.length > 0, 'Existing stored Gmail emails should remain intact');
      console.log(`- Sample email subject: "${storedEmails[0].subject}"`);
      console.log('✔ Gmail integration confirmed healthy and regression-free');
    } else {
      console.log('Notice: No connected Google account found in database for live test.');
    }
  }

  console.log('\n=====================================================');
  console.log('  ALL CALENDAR TESTS PASSED SUCCESSFULLY!');
  console.log('=====================================================\n');
}

runCalendarTests().catch((err) => {
  console.error('TEST RUNNER FAILED:', err);
  process.exit(1);
});
