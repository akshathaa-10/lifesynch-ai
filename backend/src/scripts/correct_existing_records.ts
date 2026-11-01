import '../config/env';
import { getSupabaseAdminClient } from '../config/supabase';
import { taskService } from '../services/task.service';
import { Responsibility } from '@lifesynch/shared';

async function main() {
  console.log('=====================================================');
  console.log('  LIFESYNCH AI — EXISTING RECORDS MIGRATION & RECLASSIFICATION');
  console.log('=====================================================');

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from('responsibilities').select('*');
  if (error || !data) {
    console.error('Error querying responsibilities:', error);
    process.exit(1);
  }

  console.log(`Inspecting ${data.length} records in database...`);

  let updatedCount = 0;
  let cleansedProgramSchedules = 0;
  let cleansedCirculars = 0;
  let classifiedAppWindows = 0;
  let classifiedEvents = 0;
  let archivedCancelled = 0;

  for (const raw of data) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: Responsibility = (taskService as any).mapSupabaseRecord(raw);
    const { needsDbUpdate, updateFields } = taskService.correctRecord(r);

    if (needsDbUpdate) {
      updatedCount++;
      const meta = (updateFields.metadata as any) || {};
      const cls = meta.classification || meta.sourceContext?.classification;
      if (cls === 'program_schedule') cleansedProgramSchedules++;
      if (cls === 'informational') cleansedCirculars++;
      if (cls === 'opportunity_window') classifiedAppWindows++;
      if (cls === 'event_meeting') classifiedEvents++;
      if (updateFields.is_archived) archivedCancelled++;

      updateFields.updated_at = new Date().toISOString();
      const { error: updErr } = await supabase
        .from('responsibilities')
        .update(updateFields)
        .eq('id', r.id);

      if (updErr) {
        console.warn(`Failed to update ${r.id}:`, updErr.message);
      }
    }
  }

  console.log('\n--- Migration Results ---');
  console.log(`Total inspected: ${data.length}`);
  console.log(`Total records corrected: ${updatedCount}`);
  console.log(`- Program schedules corrected (deadlines unset): ${cleansedProgramSchedules}`);
  console.log(`- Informational circulars/announcements corrected: ${cleansedCirculars}`);
  console.log(`- Application windows classified: ${classifiedAppWindows}`);
  console.log(`- Meetings/events classified: ${classifiedEvents}`);
  console.log(`- Obsolete/cancelled records archived: ${archivedCancelled}`);
  console.log('=====================================================');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
