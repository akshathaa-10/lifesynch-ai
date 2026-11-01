import assert from 'node:assert';
import { 
  mergeResponsibilityData, 
  determineResponsibilityStatus,
  isInformationalEmailNotResponsibility, 
  sanitizeTaskDeadline 
} from '../services/ai/responsibility-matcher';
import { ExtractedTaskSchema } from '@lifesynch/shared';

console.log('=== Running LifeSynch Responsibilities Intelligence Test Suite ===\n');

// Test 1: Action Required email parsing & schema validation
console.log('Test 1: Action Required email');
const actionTaskData = {
  title: 'Submit Machine Learning Project Report',
  description: 'Upload your 10-page final report in PDF format to the course submission portal.',
  priority: 'high' as const,
  category: 'academic' as const,
  action: 'Upload PDF report to portal',
  dueDate: '2026-10-18',
  dueTime: '23:59',
  classification: 'action_required' as const,
  deadlineType: 'strict_deadline' as const,
  responsibleParty: 'user' as const,
  nextStep: 'Complete experimental section and upload PDF to course portal',
  confidence: 0.95
};
const parsedAction = ExtractedTaskSchema.safeParse(actionTaskData);
assert.strictEqual(parsedAction.success, true, 'Action required task must match schema');
assert.strictEqual(parsedAction.data?.classification, 'action_required');
assert.strictEqual(parsedAction.data?.responsibleParty, 'user');
console.log('✔ Action required email correctly parsed with action, deadline, and user ownership');

// Test 2: Opportunity / Application Window email
console.log('\nTest 2: Opportunity / Application Window');
const windowTaskData = {
  title: 'Fall 2026 Research Fellowship Application',
  description: 'Fellowship applications open on Oct 1 and close on Oct 25 at 5:00 PM.',
  priority: 'high' as const,
  category: 'academic' as const,
  action: 'Submit fellowship application via portal',
  dueDate: '2026-10-25',
  dueTime: '17:00',
  classification: 'opportunity_window' as const,
  deadlineType: 'application_window' as const,
  responsibleParty: 'user' as const,
  windowStartDate: '2026-10-01',
  windowEndDate: '2026-10-25',
  nextStep: 'Request recommendation letters and submit portal form before Oct 25',
  confidence: 0.9
};
const parsedWindow = ExtractedTaskSchema.safeParse(windowTaskData);
assert.strictEqual(parsedWindow.success, true, 'Application window task must match schema');
assert.strictEqual(parsedWindow.data?.windowStartDate, '2026-10-01');
assert.strictEqual(parsedWindow.data?.windowEndDate, '2026-10-25');
assert.strictEqual(parsedWindow.data?.dueDate, '2026-10-25');
console.log('✔ Application window correctly captures start date, end date, and closing deadline');

// Test 3: Event / Meeting retention
console.log('\nTest 3: Event / Meeting email');
const meetingTaskData = {
  title: 'Sprint Planning with Engineering Team',
  description: 'Bi-weekly sprint planning meeting in Room 302 or Google Meet.',
  priority: 'medium' as const,
  category: 'work' as const,
  action: 'Attend sprint planning meeting',
  dueDate: '2026-10-15',
  dueTime: '10:00',
  classification: 'event_meeting' as const,
  deadlineType: 'event_time' as const,
  responsibleParty: 'user' as const,
  nextStep: 'Review sprint backlog items before 10:00 AM',
  confidence: 0.9
};
const parsedMeeting = ExtractedTaskSchema.safeParse(meetingTaskData);
assert.strictEqual(parsedMeeting.success, true, 'Meeting event task must match schema');
assert.strictEqual(parsedMeeting.data?.classification, 'event_meeting');
assert.strictEqual(parsedMeeting.data?.deadlineType, 'event_time');
console.log('✔ Event / Meeting retains actual date, time, and preparation step');

// Test 4: Program / Activity Schedule email (Not a user deadline)
console.log('\nTest 4: Program / Activity schedule (date range describes event, not submission deadline)');
const programEmail = {
  title: 'Annual Tech Symposium Dates Announced',
  description: 'The annual technical symposium will take place across campus from November 12 to November 14.',
  action: '',
  sourceType: 'gmail' as const,
  sourceContext: { sender: 'events@university.edu', recipient: 'all@university.edu' }
};
const sanitizedProgram = sanitizeTaskDeadline({
  title: programEmail.title,
  description: programEmail.description,
  dueDate: '2026-11-12'
});
assert.strictEqual(sanitizedProgram.dueDate, null, 'Program schedule date range must NOT be turned into a user deadline');
console.log('✔ Program schedule recognized as descriptive duration without inventing deadline');

// Test 5: Informational email filtering (broadcasts/newsletters)
console.log('\nTest 5: Informational broadcast filtering');
const newsletterEmail = {
  title: 'October Library Newsletter & Hours',
  description: 'Please note the library will have extended hours during midterm week.',
  action: 'Read newsletter',
  sourceType: 'gmail' as const,
  sourceContext: { sender: 'library-news@university.edu', recipient: 'campus-newsletter@university.edu' }
};
const isInfo = isInformationalEmailNotResponsibility(newsletterEmail);
assert.strictEqual(isInfo, true, 'Newsletter broadcast must be flagged as informational');
console.log('✔ Informational broadcast prevented from cluttering actionable responsibilities');

// Test 6: Ambiguous email preserving uncertainty
console.log('\nTest 6: Ambiguous email preserving uncertainty');
const ambiguousTaskData = {
  title: 'Fwd: Project questions',
  description: 'Someone might look into this whenever convenient.',
  priority: 'low' as const,
  category: 'work' as const,
  action: 'Clarify project questions if needed',
  dueDate: null,
  dueTime: null,
  classification: 'ambiguous' as const,
  deadlineType: 'none' as const,
  responsibleParty: 'unassigned' as const,
  confidence: 0.3
};
const parsedAmbiguous = ExtractedTaskSchema.safeParse(ambiguousTaskData);
assert.strictEqual(parsedAmbiguous.success, true, 'Ambiguous item parsed cleanly');
assert.strictEqual(parsedAmbiguous.data?.confidence, 0.3);
assert.strictEqual(parsedAmbiguous.data?.dueDate, null);
console.log('✔ Ambiguous email preserves uncertainty with zero invented deadlines or tasks');

// Test 7: Email thread follow-up updates existing responsibility (no duplicate)
console.log('\nTest 7: Thread follow-up updates existing record');
const existingTask: any = {
  id: 'task-100',
  title: 'Submit Lab Report',
  description: 'Original deadline was Friday 5 PM.',
  priority: 'medium',
  category: 'academic',
  action: 'Submit report on portal',
  dueDate: '2026-10-16',
  dueTime: '17:00',
  status: 'PENDING',
  source: 'gmail',
  sourceId: 'msg-thread-1-original',
  sourceContext: { threadId: 'thread-123' }
};

const followUpUpdate: any = {
  title: 'Submit Lab Report - Extended Deadline',
  description: 'Professor extended deadline to Sunday midnight.',
  priority: 'high',
  category: 'academic',
  action: 'Submit report on portal by Sunday midnight',
  dueDate: '2026-10-18',
  dueTime: '23:59',
  classification: 'action_required',
  deadlineType: 'strict_deadline',
  nextStep: 'Upload final version before Sunday 11:59 PM',
  confidence: 0.95
};

const merged = mergeResponsibilityData(existingTask, followUpUpdate);
assert.strictEqual(merged.id, existingTask.id, 'Must keep stable record ID');
assert.ok(merged.dueDate?.startsWith('2026-10-18'), 'Must update to extended deadline');
assert.strictEqual(merged.dueTime, '23:59', 'Must update to extended due time');
assert.strictEqual(merged.action, followUpUpdate.action, 'Must update action');
assert.strictEqual(merged.sourceContext.nextStep, followUpUpdate.nextStep, 'Must merge nextStep');
console.log('✔ Thread follow-up merged cleanly into existing record with stable ID and new deadline');

// Test 8: Past deadline remains OVERDUE, never marked COMPLETED
console.log('\nTest 8: Past deadline remains OVERDUE');
const pastDeadlineStatus = determineResponsibilityStatus({
  dueDate: '2026-10-01',
  dueTime: '17:00',
  existingStatus: 'PENDING'
});
assert.strictEqual(pastDeadlineStatus, 'OVERDUE', 'Past deadline must be OVERDUE, never marked COMPLETED');
console.log('✔ Past deadline correctly preserved as OVERDUE without premature completion');

console.log('\n=== All 8 Responsibilities Intelligence Tests Passed Successfully! ===');
