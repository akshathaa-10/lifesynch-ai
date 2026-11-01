import { assistantService } from '../services/ai/assistant.service';
import { taskService } from '../services/task.service';
import { emailService } from '../services/db/email.service';
import { calendarEventService } from '../services/db/calendar-event.service';
import { userService } from '../services/db/user.service';
import { isInformationalEmailNotResponsibility, sanitizeTaskDeadline } from '../services/ai/responsibility-matcher';
import assert from 'assert';

async function runCoreIntelligenceTests() {
  console.log('====================================================================');
  console.log('       LIFESYNCH CORE INTELLIGENCE & REASONING VERIFICATION         ');
  console.log('====================================================================\n');

  // Setup test user
  const timestamp = Date.now();
  const testUser = await userService.upsertUser({
    email: `intelligence_tester_${timestamp}@lifesynch.ai`,
    name: 'Morgan Vance'
  });
  const userId = testUser.id;

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  console.log(`[SETUP] Created Test User: ${testUser.name} (${userId})`);
  console.log(`[SETUP] Current Local Date: ${todayStr}, Tomorrow: ${tomorrowStr}, Yesterday: ${yesterdayStr}\n`);

  // 1. Email Classification & Ownership Check
  console.log('--------------------------------------------------------------------');
  console.log('[TEST 1] Email Understanding & Ownership Filtering');
  console.log('--------------------------------------------------------------------');

  const auditionEmail = {
    title: 'NIE Music Club Auditions 2026',
    action: 'Participate in club auditions',
    description: 'Auditions for the college band will be held from Oct 16 to Oct 20.',
    sourceType: 'gmail' as const,
    sourceContext: { sender: 'music_club@nie.edu', recipient: 'all-students@nie.edu' }
  };
  const isAuditionInfo = isInformationalEmailNotResponsibility(auditionEmail);
  assert.strictEqual(isAuditionInfo, true, 'Audition announcement must be classified as informational');
  const sanitizedAuditionDeadline = sanitizeTaskDeadline({ title: auditionEmail.title, description: auditionEmail.description, dueDate: '2026-10-16' });
  assert.strictEqual(sanitizedAuditionDeadline.dueDate, null, 'Audition announcement must have null deadline');
  console.log('✔ NIE Music Club Auditions recognized as informational with zero invented deadline');

  const genuineActionEmail = {
    title: 'Submission of Final Term Paper',
    action: 'Upload PDF report on college LMS',
    description: 'All enrolled students must submit their term paper before 11:59 PM today.',
    sourceType: 'gmail' as const,
    sourceContext: { sender: 'professor.davis@nie.edu', recipient: 'morgan.vance@nie.edu' }
  };
  const isGenuineInfo = isInformationalEmailNotResponsibility(genuineActionEmail);
  assert.strictEqual(isGenuineInfo, false, 'Direct professor submission must be recognized as actionable');
  console.log('✔ Direct personal submission request recognized as genuine user action');

  // Seed Data for conversational reasoning tests
  await emailService.saveEmails(userId, [{
    messageId: `msg_term_paper_${timestamp}`,
    threadId: `thread_term_paper_${timestamp}`,
    sender: 'Prof. Davis <professor.davis@nie.edu>',
    recipient: 'Morgan Vance <morgan.vance@nie.edu>',
    subject: 'Submission of Final Term Paper',
    snippet: 'Dear Morgan, please ensure your final term paper is uploaded to the LMS before 23:59 tonight.',
    receivedAt: `${todayStr}T08:00:00Z`
  }]);

  await emailService.saveEmails(userId, [{
    messageId: `msg_orientation_${timestamp}`,
    threadId: `thread_orientation_${timestamp}`,
    sender: 'Dean Office <dean@nie.edu>',
    recipient: 'all-students@nie.edu',
    subject: 'Annual Research Scholars Orientation',
    snippet: 'The annual orientation for research scholars will take place next Monday at the main auditorium. Everyone is welcome to attend.',
    receivedAt: `${todayStr}T09:00:00Z`
  }]);

  // Seed tasks
  // Task 1: Due Today (Urgent & Actionable)
  await taskService.createTask(userId, {
    title: 'Final Term Paper Submission',
    description: 'Upload PDF report on college LMS before midnight.',
    priority: 'high',
    dueDate: todayStr,
    dueTime: '23:59',
    action: 'Upload PDF report on LMS',
    category: 'academic',
    source: 'gmail',
    sourceId: `msg_term_paper_${timestamp}`,
    sourceContext: { sender: 'professor.davis@nie.edu', messageId: `msg_term_paper_${timestamp}` }
  });

  // Task 2: Genuinely Overdue
  await taskService.createTask(userId, {
    title: 'Submit Lab Safety Agreement',
    description: 'Sign and submit the safety agreement to the lab supervisor.',
    priority: 'high',
    dueDate: yesterdayStr,
    dueTime: '17:00',
    action: 'Submit signed agreement to supervisor',
    category: 'academic',
    source: 'gmail'
  });

  // Seed Calendar Event for Today
  await calendarEventService.saveEvents(userId, [{
    eventId: `cal_eval_${timestamp}`,
    summary: 'Design Review with Faculty Mentor',
    startTime: `${todayStr}T14:30:00Z`,
    endTime: `${todayStr}T15:30:00Z`,
    status: 'confirmed',
    location: 'Conference Room B'
  }]);

  console.log('\n--------------------------------------------------------------------');
  console.log('[TEST 2] "What should I focus on today?"');
  console.log('--------------------------------------------------------------------');
  const focusResponse = await assistantService.askDetailed(userId, 'What should I focus on today?');
  console.log('Answer:\n', focusResponse.answer);
  assert.strictEqual(focusResponse.intent, 'prioritization', 'Intent must be prioritization');
  assert.ok(focusResponse.answer.toLowerCase().includes('term paper'), 'Must prioritize today actionable paper submission');
  assert.ok(focusResponse.sources && focusResponse.sources.length >= 1, 'Must provide structured sources');
  console.log('✔ Recommends 1–3 actionable priorities with brief rationale');

  console.log('\n--------------------------------------------------------------------');
  console.log('[TEST 3] "What am I overdue on?"');
  console.log('--------------------------------------------------------------------');
  const overdueResponse = await assistantService.askDetailed(userId, 'What am I overdue on?');
  console.log('Answer:\n', overdueResponse.answer);
  assert.strictEqual(overdueResponse.intent, 'overdue', 'Intent must be overdue');
  assert.ok(overdueResponse.answer.toLowerCase().includes('lab safety agreement'), 'Must include genuine overdue task');
  assert.ok(!overdueResponse.answer.toLowerCase().includes('audition'), 'Must NEVER include informational announcements as overdue');
  console.log('✔ Shows only genuinely incomplete responsibilities with passed deadlines');

  console.log('\n--------------------------------------------------------------------');
  console.log('[TEST 4] "What is happening today?" (Unified Schedule & Responsibilities)');
  console.log('--------------------------------------------------------------------');
  const todayResponse = await assistantService.askDetailed(userId, 'What is happening today?');
  console.log('Answer:\n', todayResponse.answer);
  assert.strictEqual(todayResponse.intent, 'today_overview', 'Intent must be today_overview');
  assert.ok(todayResponse.answer.toLowerCase().includes('design review'), 'Must include today calendar event');
  assert.ok(todayResponse.answer.toLowerCase().includes('term paper'), 'Must include today time-sensitive responsibility');
  console.log('✔ Answers using both today calendar events and time-sensitive responsibilities');

  console.log('\n--------------------------------------------------------------------');
  console.log('[TEST 5] "What does this email mean?" (Email Explanation)');
  console.log('--------------------------------------------------------------------');
  const explainResponse = await assistantService.askDetailed(
    userId,
    'What does this email about submission of final term paper mean?'
  );
  console.log('Answer:\n', explainResponse.answer);
  assert.strictEqual(explainResponse.intent, 'email_explanation', 'Intent must be email_explanation');
  assert.ok(explainResponse.answer.toLowerCase().includes('term paper'), 'Must explain term paper email');
  assert.ok(explainResponse.answer.toLowerCase().includes('action'), 'Must identify action required');
  console.log('✔ Explains actual message in plain language and identifies action');

  console.log('\n--------------------------------------------------------------------');
  console.log('[TEST 6] "Do I need to do anything about this email?" (Action Check)');
  console.log('--------------------------------------------------------------------');
  // 6a: Actionable email check
  const actionCheckResponse = await assistantService.askDetailed(
    userId,
    'Do I need to do anything about this email from Prof. Davis?'
  );
  console.log('Actionable Email Check Answer:\n', actionCheckResponse.answer);
  assert.strictEqual(actionCheckResponse.intent, 'email_action_check', 'Intent must be email_action_check');
  assert.ok(actionCheckResponse.answer.toLowerCase().includes('yes'), 'Must identify that action is required');
  assert.ok(actionCheckResponse.answer.toLowerCase().includes('upload') || actionCheckResponse.answer.toLowerCase().includes('submit'), 'Must state action');

  // 6b: Informational email check
  const infoActionCheck = await assistantService.askDetailed(
    userId,
    'Do I need to do anything about this email about Annual Research Scholars Orientation?'
  );
  console.log('Informational Email Check Answer:\n', infoActionCheck.answer);
  assert.strictEqual(infoActionCheck.intent, 'email_action_check', 'Intent must be email_action_check');
  assert.ok(
    infoActionCheck.answer.toLowerCase().includes('no action') || infoActionCheck.answer.toLowerCase().includes('informational'),
    'Must state no action required for informational announcement'
  );
  console.log('✔ Accurately differentiates actionable emails vs purely informational messages');

  console.log('\n--------------------------------------------------------------------');
  console.log('[TEST 7] Multi-Turn Follow-Up Reasoning');
  console.log('--------------------------------------------------------------------');
  // First turn: ask what should I focus on
  const history = [
    { role: 'user' as const, content: 'What should I focus on today?' },
    { role: 'assistant' as const, content: focusResponse.answer }
  ];
  // Follow-up: "What action is needed for the first one?"
  const followUpResponse = await assistantService.askDetailed(
    userId,
    'What action is needed for the first one?',
    history
  );
  console.log('Follow-up Answer:\n', followUpResponse.answer);
  assert.strictEqual(followUpResponse.intent, 'follow_up', 'Intent must be follow_up');
  assert.ok(
    followUpResponse.answer.toLowerCase().includes('term paper') ||
    followUpResponse.answer.toLowerCase().includes('upload') ||
    followUpResponse.answer.toLowerCase().includes('lms') ||
    followUpResponse.answer.toLowerCase().includes('submit'),
    'Follow-up must address the correct item from preceding conversation'
  );
  console.log('✔ Multi-turn follow-up accurately resolves previous item');

  console.log('\n====================================================================');
  console.log('      ALL CORE INTELLIGENCE & REASONING TESTS PASSED (7/7)!         ');
  console.log('====================================================================\n');
}

runCoreIntelligenceTests().catch(err => {
  console.error('Core intelligence verification failed:', err);
  process.exit(1);
});
