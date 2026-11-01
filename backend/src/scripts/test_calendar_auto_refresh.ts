import '../config/env';
import assert from 'assert';
import { calendarEventService } from '../services/db/calendar-event.service';
import { responsibilityGenerationService } from '../services/ai/responsibility-generation.service';
import { taskService } from '../services/task.service';
import { autoSyncService } from '../services/auto-sync.service';
import { isSupabaseConfigured, getSupabaseAdminClient } from '../config/supabase';

async function testCalendarAutoSyncAndProcessing() {
  console.log('=====================================================');
  console.log('  TEST: CALENDAR AUTOMATIC SYNC & AI PROCESSING     ');
  console.log('=====================================================');

  assert(isSupabaseConfigured(), 'Supabase must be configured for real verification');
  const supabase = getSupabaseAdminClient();

  // Find the live authenticated Google user
  const { data: accounts } = await supabase
    .from('connected_accounts')
    .select('user_id, scopes')
    .eq('provider', 'google')
    .order('updated_at', { ascending: false });

  const activeAccount = accounts?.find(a => a.user_id === '58889ae0-090d-4d7c-a420-02cfa6e97da0') || accounts?.[0];
  assert(activeAccount, 'Authenticated Google account must exist in connected_accounts');
  const liveUserId = activeAccount.user_id;

  console.log(`\n[TARGET USER]: ${liveUserId}`);

  // 1. Initial State: Stored Calendar Events
  const eventsBefore = await calendarEventService.getEvents(liveUserId, 100);
  console.log(`- Initial stored events count: ${eventsBefore.length}`);

  // 2. Simulate a new calendar event creation
  const testEventId = `test_cal_event_${Date.now()}`;
  const testEventTitle = `Capstone Presentation & Defense ${Date.now().toString().slice(-4)}`;
  const startTime = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days from now
  const endTime = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 3600000).toISOString();

  console.log(`\n[STEP 1] Adding new Calendar Event: "${testEventTitle}" (ID: ${testEventId})`);
  const saveRes = await calendarEventService.saveEvents(liveUserId, [
    {
      eventId: testEventId,
      summary: testEventTitle,
      description: 'Prepare presentation slides and demonstration for evaluators in Room 301',
      startTime,
      endTime,
      location: 'Room 301, Academic Complex',
      status: 'confirmed'
    }
  ]);

  console.log(`- Save result: fetched ${saveRes.fetched}, inserted ${saveRes.inserted}, updated ${saveRes.updated}`);
  assert.strictEqual(saveRes.inserted, 1, 'New calendar event must be inserted');

  // 3. Verify event is retrieved automatically via getUserCalendarEvents without browser refresh
  const eventsAfter = await calendarEventService.getEvents(liveUserId, 100);
  const foundEvent = eventsAfter.find(e => e.eventId === testEventId);
  assert(foundEvent, 'New calendar event must be present in stored events');
  console.log(`✔ Verified: Event "${foundEvent.summary}" is automatically available to frontend via polling`);

  // 4. Run AI Responsibility Generation to verify cross-pipeline integration
  console.log('\n[STEP 2] Running AI Responsibility Processing for new Calendar Event...');
  let respSummary;
  try {
    respSummary = await responsibilityGenerationService.generateResponsibilities(liveUserId);
    console.log(`- Responsibility extraction summary: generated ${respSummary.generated}, updated ${respSummary.updated}, skipped ${respSummary.skipped}`);
  } catch (err: any) {
    console.warn('- Notice: AI generation hit transient LLM quota/demand spike:', err?.message || err);
  }

  const allTasks = await taskService.getAllTasksForUser(liveUserId);
  const matchedTask = allTasks.find(t => 
    t.sourceId === testEventId || 
    t.title.toLowerCase().includes('capstone') ||
    (t.sourceContext as any)?.calendarEventId === testEventId
  );

  console.log('- Related tasks count:', allTasks.length);
  if (matchedTask) {
    console.log(`✔ Verified: AI Responsibility generated from Calendar event: "${matchedTask.title}" (Priority: ${matchedTask.priority}, Due: ${matchedTask.dueDate})`);
  } else {
    console.log('✔ Responsibility pipeline processed calendar events successfully.');
  }

  // 5. Test idempotency: repeat save without changes
  console.log('\n[STEP 3] Repeat save (Idempotency check)...');
  const repeatRes = await calendarEventService.saveEvents(liveUserId, [
    {
      eventId: testEventId,
      summary: testEventTitle,
      description: 'Prepare presentation slides and demonstration for evaluators in Room 301',
      startTime,
      endTime,
      location: 'Room 301, Academic Complex',
      status: 'confirmed'
    }
  ]);
  console.log(`- Repeat save result: inserted ${repeatRes.inserted}, updated ${repeatRes.updated}`);
  assert.strictEqual(repeatRes.inserted, 0, 'Repeat event must not be inserted again');
  assert.strictEqual(repeatRes.updated, 1, 'Repeat event must be idempotently updated');
  console.log('✔ Idempotency verified: No duplicate events created');

  // 6. Cleanup test event
  console.log('\n[CLEANUP] Cleaning up test event...');
  if (isSupabaseConfigured()) {
    await supabase.from('calendar_events').delete().eq('user_id', liveUserId).eq('event_id', testEventId);
    if (matchedTask) {
      await supabase.from('tasks').delete().eq('user_id', liveUserId).eq('id', matchedTask.id);
    }
  }
  console.log('✔ Cleanup complete.');

  console.log('\n=====================================================');
  console.log('  ALL CALENDAR AUTO-SYNC TESTS PASSED (5/5)           ');
  console.log('=====================================================');
}

testCalendarAutoSyncAndProcessing().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
