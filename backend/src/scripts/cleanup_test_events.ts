import '../config/env';
import { isSupabaseConfigured, getSupabaseAdminClient } from '../config/supabase';

async function cleanupTestEvents() {
  console.log('Checking for test events in database...');
  if (!isSupabaseConfigured()) {
    console.log('Supabase not configured.');
    return;
  }

  const supabase = getSupabaseAdminClient();

  // Find calendar_events matching test patterns
  const { data: testEvents, error: evErr } = await supabase
    .from('calendar_events')
    .select('id, user_id, event_id, summary')
    .or('event_id.ilike.%test%,summary.ilike.%test%,summary.ilike.%Capstone Presentation%');

  if (evErr) {
    console.error('Error searching calendar events:', evErr.message);
  } else {
    console.log(`Found ${testEvents?.length || 0} test calendar events:`);
    for (const ev of testEvents || []) {
      console.log(`- [${ev.id}] "${ev.summary}" (event_id: ${ev.event_id})`);
    }

    if (testEvents && testEvents.length > 0) {
      const idsToDelete = testEvents.map(e => e.id);
      const { error: delEvErr } = await supabase
        .from('calendar_events')
        .delete()
        .in('id', idsToDelete);

      if (delEvErr) {
        console.error('Error deleting test calendar events:', delEvErr.message);
      } else {
        console.log(`✔ Deleted ${idsToDelete.length} test calendar events.`);
      }
    }
  }

  // Find responsibilities matching test patterns
  const { data: testTasks, error: taskErr } = await supabase
    .from('responsibilities')
    .select('id, user_id, title, source_id')
    .or('source_id.ilike.%test%,title.ilike.%test%,title.ilike.%Capstone Presentation%');

  if (taskErr) {
    console.error('Error searching test responsibilities:', taskErr.message);
  } else {
    console.log(`Found ${testTasks?.length || 0} test responsibilities:`);
    for (const t of testTasks || []) {
      console.log(`- [${t.id}] "${t.title}" (source_id: ${t.source_id})`);
    }

    if (testTasks && testTasks.length > 0) {
      const idsToDelete = testTasks.map(t => t.id);
      const { error: delTaskErr } = await supabase
        .from('responsibilities')
        .delete()
        .in('id', idsToDelete);

      if (delTaskErr) {
        console.error('Error deleting test responsibilities:', delTaskErr.message);
      } else {
        console.log(`✔ Deleted ${idsToDelete.length} test responsibilities.`);
      }
    }
  }
}

cleanupTestEvents().catch(err => {
  console.error('Cleanup script error:', err);
  process.exit(1);
});
