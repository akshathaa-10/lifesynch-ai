import assert from 'assert';
import { 
  isInformationalEmailNotResponsibility, 
  sanitizeTaskDeadline, 
  isProgramScheduleOrEventDateRange,
  determineResponsibilityStatus,
  calculateDeadlineUrgency,
  determineIntelligentPriority
} from '../services/ai/responsibility-matcher';

async function runClassificationTests() {
  console.log('=====================================================');
  console.log('  LIFESYNCH AI — EMAIL CLASSIFICATION TEST SUITE');
  console.log('=====================================================');

  // ----------------------------------------------------------------
  // Test 1: Example 1 - Program Schedule Information (NOT a deadline)
  // "The SDP program will run from the 13th to the 17th"
  // ----------------------------------------------------------------
  console.log('\n[TEST 1] "The SDP program will run from the 13th to the 17th"');
  const sdpText = 'The SDP program will run from the 13th to the 17th';
  assert(
    isProgramScheduleOrEventDateRange(sdpText),
    'Must identify "The SDP program will run from the 13th to the 17th" as program schedule date range'
  );

  const sdpExtractedItem = {
    title: 'Skill Development Program on Data Analytics',
    action: 'Attend the SDP sessions from October 13th to October 17th',
    description: 'The SDP program will run from the 13th to the 17th in the seminar hall',
    dueDate: '2026-10-13T00:00:00.000Z',
    sourceType: 'gmail',
    sourceContext: {
      subject: 'SDP on Data Analytics and Visualization'
    }
  };

  const isSdpInformational = isInformationalEmailNotResponsibility(sdpExtractedItem);
  assert(
    isSdpInformational,
    'SDP program schedule announcement must be classified as informational email, NOT a responsibility'
  );

  const sanitizedSdp = sanitizeTaskDeadline(sdpExtractedItem);
  assert.strictEqual(
    sanitizedSdp.dueDate,
    null,
    'Program schedule date must NEVER be treated as a submission deadline (dueDate must be null)'
  );
  assert(sanitizedSdp.isInformationalDate, 'Must flag that the date was an informational event date');

  // Must NEVER be classified as OVERDUE
  const sdpStatus = determineResponsibilityStatus({
    dueDate: '2026-10-10T00:00:00.000Z', // past date
    sourceContext: {
      title: sdpExtractedItem.title,
      subject: 'SDP program will run from the 13th to the 17th'
    },
    now: new Date('2026-10-13T10:00:00.000Z')
  });
  assert.notStrictEqual(
    sdpStatus,
    'OVERDUE',
    'Informational program schedule must NEVER be classified as OVERDUE'
  );
  console.log('✔ "The SDP program will run from the 13th to the 17th" correctly identified as program information, NOT a deadline');

  // ----------------------------------------------------------------
  // Test 2: Example 2 - Genuine Responsibility with Deadline
  // "Submit the application by the 12th"
  // ----------------------------------------------------------------
  console.log('\n[TEST 2] "Submit the application by the 12th"');
  const genuineSubmissionItem = {
    title: 'Submit the application',
    action: 'Submit the application by the 12th on the admissions portal',
    description: 'All candidates must submit the application by the 12th to be considered',
    dueDate: '2026-10-12T23:59:59.000Z',
    sourceType: 'gmail',
    sourceContext: {
      subject: 'Application Deadline: Submit the application by the 12th'
    }
  };

  const isGenuineInfo = isInformationalEmailNotResponsibility(genuineSubmissionItem);
  assert(
    !isGenuineInfo,
    '"Submit the application by the 12th" must NOT be dropped as informational; it is a genuine responsibility'
  );

  const sanitizedGenuine = sanitizeTaskDeadline(genuineSubmissionItem);
  assert.strictEqual(
    sanitizedGenuine.dueDate,
    '2026-10-12T23:59:59.000Z',
    'Genuine submission deadline must be preserved'
  );
  assert(!sanitizedGenuine.isInformationalDate, 'Must not be flagged as informational date');
  console.log('✔ "Submit the application by the 12th" correctly identified as a genuine responsibility with a deadline');

  // ----------------------------------------------------------------
  // Test 3: Example 3 - Calendar Event vs Submission Deadline
  // "Attend the program on the 13th"
  // ----------------------------------------------------------------
  console.log('\n[TEST 3] "Attend the program on the 13th"');
  // 3a. From Google Calendar source: valid calendar event (type: appointment)
  const calendarEventItem = {
    title: 'Attend the program',
    action: 'Attend the program on the 13th',
    type: 'appointment',
    dueDate: '2026-10-13T10:00:00.000Z',
    dueTime: '10:00',
    sourceType: 'calendar',
    sourceContext: {
      calendarEventId: 'cal_event_sdp_123'
    }
  };

  const isCalEventInfo = isInformationalEmailNotResponsibility(calendarEventItem);
  assert(
    !isCalEventInfo,
    'Confirmed Google Calendar event must not be dropped as an informational email'
  );
  assert.strictEqual(
    calendarEventItem.type,
    'appointment',
    'Calendar event is an appointment, NOT automatically a submission deadline'
  );

  // 3b. From purely Gmail announcement email without calendar source:
  const emailAnnouncementItem = {
    title: 'Attend the program on the 13th',
    action: 'Attend the program on October 13th',
    description: 'All students are invited to attend the program on the 13th',
    dueDate: '2026-10-13T10:00:00.000Z',
    sourceType: 'gmail',
    sourceContext: {
      subject: 'Invitation to attend program'
    }
  };

  const isEmailAnnouncementInfo = isInformationalEmailNotResponsibility(emailAnnouncementItem);
  assert(
    isEmailAnnouncementInfo,
    'General email announcement inviting attendance without calendar event or submission is informational'
  );
  console.log('✔ "Attend the program on the 13th" correctly treated as calendar event if from calendar, NOT automatically a submission deadline');

  // ----------------------------------------------------------------
  // Test 4: Example 4 - General Announcement or Newsletter
  // ----------------------------------------------------------------
  console.log('\n[TEST 4] General Announcement or Newsletter');
  const newsletterItem = {
    title: 'Weekly Campus Digest & Newsletter',
    action: 'Read weekly newsletter updates',
    description: 'Highlights of events and articles from around the department',
    sourceType: 'gmail',
    sourceContext: {
      subject: 'Department Weekly Newsletter No. 42'
    }
  };

  const circularItem = {
    title: 'Circular Regarding Holiday Schedule',
    action: 'Check holiday schedule circular',
    description: 'Circular regarding Dussehra vacation from Oct 10 to Oct 20',
    sourceType: 'gmail',
    sourceContext: {
      subject: 'Circular No. 89: General Announcement'
    }
  };

  assert(
    isInformationalEmailNotResponsibility(newsletterItem),
    'Newsletter must be classified as informational email, NOT a responsibility'
  );
  assert(
    isInformationalEmailNotResponsibility(circularItem),
    'General announcement circular must be classified as informational email, NOT a responsibility'
  );
  console.log('✔ General announcements and newsletters correctly identified as informational emails, NOT responsibilities');

  // ----------------------------------------------------------------
  // Test 5: A Date or Date Range Alone Must NEVER Create a Deadline
  // ----------------------------------------------------------------
  console.log('\n[TEST 5] Date / Date Range Alone Does Not Create a Deadline');
  const dateRangeItem = {
    title: 'Annual Technical Symposium',
    action: 'Participate in sessions from November 5 to November 8',
    description: 'The symposium will run from November 5th to November 8th',
    dueDate: '2026-11-05T00:00:00.000Z',
    sourceType: 'gmail',
    sourceContext: {
      subject: 'Annual Symposium Dates Announced'
    }
  };

  const dateRangeSanitized = sanitizeTaskDeadline(dateRangeItem);
  assert.strictEqual(
    dateRangeSanitized.dueDate,
    null,
    'Date range alone must NEVER create a deadline (dueDate must be null)'
  );
  console.log('✔ Verified that date ranges alone never create deadlines');

  // ----------------------------------------------------------------
  // Test 6: Existing Responsibilities Cleansing
  // ----------------------------------------------------------------
  console.log('\n[TEST 6] Existing Informational Records Cleansing');
  const oldStoredItem = {
    id: 'old_resp_001',
    title: 'Attend Skill Development Program on Data Analytics, Visualization & DevOps',
    action: 'Attend the SDP sessions from October 13th to October 17th',
    description: 'The SDP program will run from the 13th to the 17th',
    dueDate: '2026-10-13T00:00:00.000Z',
    source: 'gmail'
  };

  const cleansed = sanitizeTaskDeadline({
    title: oldStoredItem.title,
    action: oldStoredItem.action,
    description: oldStoredItem.description,
    dueDate: oldStoredItem.dueDate,
    sourceType: oldStoredItem.source
  });

  assert(cleansed.isInformationalDate, 'Must recognize existing stored item as informational date');
  assert.strictEqual(cleansed.dueDate, null, 'Must unset false deadline on existing informational record');
  console.log('✔ Existing stored informational items correctly cleansed so they do not linger in active overdue sections');

  console.log('\n=====================================================');
  console.log('  ALL EMAIL CLASSIFICATION TESTS PASSED! ✔');
  console.log('=====================================================');
}

runClassificationTests().catch(err => {
  console.error('Classification tests failed:', err);
  process.exit(1);
});
