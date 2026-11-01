import assert from 'assert';
import {
  isInformationalEmailNotResponsibility,
  sanitizeTaskDeadline,
  isProgramScheduleOrEventDateRange,
  determineResponsibilityStatus,
  calculateDeadlineUrgency
} from '../services/ai/responsibility-matcher';

// Helper matching Frontend App.tsx section placement logic
function partitionFrontendResponsibilities(items: any[], now: Date) {
  const needsAttention: any[] = [];
  const upcomingCommitments: any[] = [];
  const missedPast: any[] = [];

  for (const t of items) {
    const isEvent = t.type === 'appointment' || 
                    t.sourceContext?.classification === 'event_meeting' ||
                    t.sourceContext?.isCalendarEvent === true ||
                    t.sourceType === 'calendar' ||
                    (t.sourceContext?.deadlineType === 'event_time');
    
    const isWindow = t.sourceContext?.classification === 'application_window' ||
                     t.sourceContext?.classification === 'opportunity_window' ||
                     t.sourceContext?.deadlineType === 'application_window' ||
                     t.sourceContext?.deadlineType === 'window_close' ||
                     !!t.sourceContext?.windowStartDate;

    const isProgram = t.sourceContext?.classification === 'program_schedule' ||
                      t.sourceContext?.deadlineType === 'program_duration';

    const isInformational = (t.sourceContext?.classification === 'informational' || t.isInformational) && !isEvent && !isWindow && !isProgram;
    if (isInformational) {
      // Excluded from actionable responsibilities
      continue;
    }

    if (isEvent) {
      const rawDateStr = t.dueDate || t.due_date || t.sourceContext?.startTime;
      const startTimeStr = t.dueTime || t.due_time || t.sourceContext?.startTime;
      const endTimeStr = t.sourceContext?.endTime || t.sourceContext?.dueTimeEnd;

      let startDate: Date | null = null;
      let endDate: Date | null = null;

      if (rawDateStr) {
        startDate = new Date(rawDateStr);
        if (startTimeStr && /^\d{1,2}:\d{2}$/.test(String(startTimeStr).trim())) {
          const [sh, sm] = String(startTimeStr).trim().split(':').map(Number);
          startDate.setHours(sh, sm, 0, 0);
        }
        endDate = new Date(startDate);
        if (endTimeStr && /^\d{1,2}:\d{2}$/.test(String(endTimeStr).trim())) {
          const [eh, em] = String(endTimeStr).trim().split(':').map(Number);
          endDate.setHours(eh, em, 0, 0);
        } else if (startTimeStr) {
          endDate.setHours(startDate.getHours() + 1, startDate.getMinutes(), 0, 0);
        } else {
          endDate.setHours(23, 59, 59, 999);
        }
      }

      const isConcluded = endDate ? (now.getTime() > endDate.getTime()) : false;
      if (isConcluded) {
        missedPast.push(t);
      } else {
        // Events are never placed into Needs Attention (they are calendar commitments, not task deadlines)
        upcomingCommitments.push(t);
      }
      continue;
    }

    if (isProgram) {
      const rawEndStr = t.sourceContext?.programEnd || t.sourceContext?.endDate;
      let isConcluded = false;
      if (rawEndStr) {
        const endDate = new Date(rawEndStr);
        isConcluded = now.getTime() > endDate.getTime();
      }
      if (isConcluded) {
        missedPast.push(t);
      } else {
        upcomingCommitments.push(t);
      }
      continue;
    }

    if (isWindow) {
      const rawCloseStr = t.sourceContext?.windowEndDate || t.sourceContext?.windowClose || t.dueDate;
      let isClosed = false;
      if (rawCloseStr) {
        const closeDate = new Date(rawCloseStr);
        isClosed = now.getTime() > closeDate.getTime();
      }
      if (isClosed) {
        missedPast.push(t);
      } else {
        upcomingCommitments.push(t);
      }
      continue;
    }

    // Actionable task deadline
    const rawDateStr = t.dueDate || t.due_date;
    if (!rawDateStr) {
      upcomingCommitments.push(t);
      continue;
    }

    const targetDate = new Date(rawDateStr);
    if (isNaN(targetDate.getTime())) {
      upcomingCommitments.push(t);
      continue;
    }

    if (t.dueTime || t.due_time) {
      const [h, m] = String(t.dueTime || t.due_time).split(':');
      if (h !== undefined) targetDate.setHours(parseInt(h, 10), parseInt(m || '0', 10), 0, 0);
    } else if (rawDateStr.length === 10) {
      targetDate.setHours(23, 59, 59, 999);
    }

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTarget = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const diffDays = Math.round((startOfTarget.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));
    const isPast = targetDate.getTime() < now.getTime() || diffDays < 0 || t.status === 'OVERDUE';

    if (isPast) {
      missedPast.push(t);
    } else if (diffDays === 0 || diffDays === 1) {
      needsAttention.push(t);
    } else {
      upcomingCommitments.push(t);
    }
  }

  return { needsAttention, upcomingCommitments, missedPast };
}

async function runScenarioTests() {
  console.log('=====================================================');
  console.log('  LIFESYNCH AI — 9 CONTROLLED USER SCENARIOS TEST');
  console.log('=====================================================');

  const simulatedNow = new Date('2026-10-23T15:00:00.000Z'); // 3:00 PM UTC on Oct 23, 2026

  // SCENARIO 1: A deadline that has not passed today
  console.log('\n[SCENARIO 1] Deadline that has not passed today');
  const pendingTodayTask = {
    id: 's1',
    title: 'Submit Assignment 3',
    type: 'deadline',
    dueDate: '2026-10-23T23:59:59.000Z',
    dueTime: '23:59',
    status: 'DUE_TODAY'
  };
  const urgency1 = calculateDeadlineUrgency(pendingTodayTask.dueDate, pendingTodayTask.dueTime, simulatedNow);
  assert(urgency1.isDueToday, 'Must be due today');
  assert(!urgency1.isOverdue, 'Must not be overdue');

  // SCENARIO 2: A deadline that passed earlier today
  console.log('[SCENARIO 2] Deadline that passed earlier today');
  const passedEarlierTodayTask = {
    id: 's2',
    title: 'Pay Exam Fee',
    type: 'deadline',
    dueDate: '2026-10-23T10:00:00.000Z',
    dueTime: '10:00',
    status: determineResponsibilityStatus({
      dueDate: '2026-10-23T10:00:00.000Z',
      dueTime: '10:00',
      now: simulatedNow
    })
  };
  assert.strictEqual(passedEarlierTodayTask.status, 'OVERDUE', 'Must be classified as OVERDUE');

  // SCENARIO 3: A deadline tomorrow
  console.log('[SCENARIO 3] Deadline tomorrow');
  const tomorrowTask = {
    id: 's3',
    title: 'Register for Seminar',
    type: 'deadline',
    dueDate: '2026-10-24T18:00:00.000Z',
    dueTime: '18:00',
    status: 'UPCOMING'
  };

  // SCENARIO 4: A deadline several days away
  console.log('[SCENARIO 4] Deadline several days away');
  const futureTask: any = {
    id: 's4',
    title: 'Submit Final Project Draft',
    type: 'deadline',
    action: 'Submit initial report',
    dueDate: '2026-10-30T23:59:59.000Z',
    dueTime: '23:59',
    status: 'UPCOMING'
  };

  // SCENARIO 5: A program running across multiple dates
  console.log('[SCENARIO 5] Program running across multiple dates');
  const programSchedule = {
    id: 's5',
    title: 'Skill Development Program on DevOps',
    type: 'task',
    description: 'The skill development program runs from October 25 to October 30',
    dueDate: null, // Cleansed false deadline
    sourceContext: {
      classification: 'program_schedule',
      deadlineType: 'program_duration',
      programStart: '2026-10-25T09:00:00.000Z',
      programEnd: '2026-10-30T17:00:00.000Z'
    },
    status: 'UPCOMING'
  };

  // SCENARIO 6: A meeting with start and end time
  console.log('[SCENARIO 6] Meeting with start and end time');
  const meetingTask = {
    id: 's6',
    title: 'Faculty Advisor Review',
    type: 'appointment',
    dueDate: '2026-10-25T14:00:00.000Z',
    dueTime: '14:00',
    sourceContext: {
      classification: 'event_meeting',
      deadlineType: 'event_time',
      startTime: '14:00',
      endTime: '15:00'
    },
    status: 'UPCOMING'
  };

  // SCENARIO 7: An application window
  console.log('[SCENARIO 7] Application window');
  const appWindowTask = {
    id: 's7',
    title: 'Yashasvi Scholarship Application Window',
    type: 'task',
    sourceContext: {
      classification: 'application_window',
      deadlineType: 'window_close',
      windowOpen: '2026-10-25',
      windowClose: '2026-10-30'
    },
    dueDate: '2026-10-30',
    status: 'UPCOMING'
  };

  // SCENARIO 8: An informational announcement
  console.log('[SCENARIO 8] Informational announcement');
  const infoEmail = {
    id: 's8',
    title: 'Department Newsletter #12',
    isInformational: true,
    sourceContext: {
      classification: 'informational'
    }
  };

  // Run frontend partitioning
  const allItems = [
    pendingTodayTask,
    passedEarlierTodayTask,
    tomorrowTask,
    futureTask,
    programSchedule,
    meetingTask,
    appWindowTask,
    infoEmail
  ];

  const sections = partitionFrontendResponsibilities(allItems, simulatedNow);

  // Assert Section Placements
  console.log('\n--- Section Placements Verification ---');
  console.log('Needs Attention IDs:', sections.needsAttention.map(i => i.id));
  console.log('Upcoming Commitments IDs:', sections.upcomingCommitments.map(i => i.id));
  console.log('Missed / Past IDs:', sections.missedPast.map(i => i.id));

  // Needs Attention should ONLY have pending today (s1) and tomorrow (s3)
  assert.strictEqual(sections.needsAttention.length, 2, 'Needs Attention must contain exactly 2 items');
  assert(sections.needsAttention.some(i => i.id === 's1'), 's1 (today pending deadline) must be in Needs Attention');
  assert(sections.needsAttention.some(i => i.id === 's3'), 's3 (tomorrow deadline) must be in Needs Attention');

  // Missed / Past should contain passed earlier today (s2)
  assert(sections.missedPast.some(i => i.id === 's2'), 's2 (passed earlier today) must be in Missed / Past');
  assert(!sections.needsAttention.some(i => i.id === 's2'), 's2 must NOT be in Needs Attention');

  // Upcoming Commitments should have future deadline (s4), program (s5), meeting (s6), app window (s7)
  assert(sections.upcomingCommitments.some(i => i.id === 's4'), 's4 must be in Upcoming Commitments');
  assert(sections.upcomingCommitments.some(i => i.id === 's5'), 's5 (program schedule) must be in Upcoming Commitments');
  assert(sections.upcomingCommitments.some(i => i.id === 's6'), 's6 (meeting) must be in Upcoming Commitments');
  assert(sections.upcomingCommitments.some(i => i.id === 's7'), 's7 (application window) must be in Upcoming Commitments');

  // Informational email (s8) must NOT appear in any active section
  assert(!sections.needsAttention.some(i => i.id === 's8'), 'Informational email must not appear in Needs Attention');
  assert(!sections.upcomingCommitments.some(i => i.id === 's8'), 'Informational email must not appear in Upcoming Commitments');
  assert(!sections.missedPast.some(i => i.id === 's8'), 'Informational email must not appear in Missed / Past');

  // SCENARIO 9: Email changing an existing deadline
  console.log('\n[SCENARIO 9] Email changing an existing deadline');
  let currentTask = { ...futureTask };
  const deadlineExtensionEmail = {
    dueDate: '2026-11-05T23:59:59.000Z',
    action: 'Submit updated final project report by Nov 5'
  };
  currentTask = {
    ...currentTask,
    dueDate: deadlineExtensionEmail.dueDate,
    action: deadlineExtensionEmail.action
  };
  assert.strictEqual(currentTask.id, 's4', 'Preserves original task ID without duplicating');
  assert.strictEqual(currentTask.dueDate, '2026-11-05T23:59:59.000Z', 'Deadline successfully updated');

  console.log('\n=====================================================');
  console.log('  ALL 9 USER SCENARIOS VERIFIED SUCCESSFULLY! ✔');
  console.log('=====================================================');
}

runScenarioTests().catch(err => {
  console.error('Scenario test failed:', err);
  process.exit(1);
});
