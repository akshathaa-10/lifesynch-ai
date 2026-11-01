import assert from 'assert';
import { gmailService } from '../services/google/gmail.service';
import { emailService } from '../services/db/email.service';
import { accountService } from '../services/db/account.service';
import { userService } from '../services/db/user.service';
import { gmail_v1 } from 'googleapis';

async function runGmailTests() {
  console.log('=====================================================');
  console.log('  LIFESYNCH AI — GMAIL INGESTION TEST SUITE');
  console.log('=====================================================');

  // ----------------------------------------------------------------
  // Test 1: Plain-Text Email MIME Parsing
  // ----------------------------------------------------------------
  console.log('\n[TEST 1] Plain-text MIME Parsing');
  const plainTextBody = 'Hello, please submit your minor project report by Friday at 5 PM.';
  const encodedPlain = Buffer.from(plainTextBody).toString('base64url');

  const plainMessage: gmail_v1.Schema$Message = {
    id: 'test_msg_plain_001',
    threadId: 'thread_001',
    internalDate: String(Date.now()),
    snippet: 'Hello, please submit your report...',
    labelIds: ['INBOX', 'IMPORTANT'],
    payload: {
      headers: [
        { name: 'Subject', value: 'Minor Project Report Deadline' },
        { name: 'From', value: 'professor@university.edu' },
        { name: 'To', value: 'student@lifesynch.ai' },
        { name: 'Date', value: new Date().toUTCString() }
      ],
      mimeType: 'text/plain',
      body: {
        data: encodedPlain
      }
    }
  };

  const parsedPlain = gmailService.parseGmailMessage(plainMessage);
  assert.strictEqual(parsedPlain.subject, 'Minor Project Report Deadline', 'Subject should match');
  assert.strictEqual(parsedPlain.sender, 'professor@university.edu', 'Sender should match');
  assert.strictEqual(parsedPlain.recipient, 'student@lifesynch.ai', 'Recipient should match');
  assert.strictEqual(parsedPlain.bodyText, plainTextBody, 'Decoded body text should match');
  assert.deepStrictEqual(parsedPlain.labels, ['INBOX', 'IMPORTANT'], 'Labels should match');
  console.log('✔ Plain-text MIME parsing passed');

  // ----------------------------------------------------------------
  // Test 2: HTML Email MIME Parsing & HTML-to-Text conversion
  // ----------------------------------------------------------------
  console.log('\n[TEST 2] HTML Email MIME Parsing');
  const htmlBody = '<div><h2>Team Meeting</h2><p>Our sync is scheduled for <strong>Monday at 10 AM</strong>.</p></div>';
  const encodedHtml = Buffer.from(htmlBody).toString('base64url');

  const htmlMessage: gmail_v1.Schema$Message = {
    id: 'test_msg_html_002',
    threadId: 'thread_002',
    internalDate: String(Date.now()),
    snippet: 'Team Meeting Our sync is scheduled...',
    labelIds: ['INBOX'],
    payload: {
      headers: [
        { name: 'Subject', value: 'Team Sync Meeting' },
        { name: 'From', value: 'lead@company.com' },
        { name: 'To', value: 'student@lifesynch.ai' }
      ],
      mimeType: 'text/html',
      body: {
        data: encodedHtml
      }
    }
  };

  const parsedHtml = gmailService.parseGmailMessage(htmlMessage);
  assert.strictEqual(parsedHtml.subject, 'Team Sync Meeting');
  assert.strictEqual(parsedHtml.bodyHtml, htmlBody, 'Original HTML should be preserved');
  assert(parsedHtml.bodyText.includes('Team Meeting'), 'Plain text extract should include Team Meeting');
  assert(parsedHtml.bodyText.includes('Monday at 10 AM'), 'Plain text extract should include date info');
  assert(!parsedHtml.bodyText.includes('<h2>'), 'Plain text extract must strip HTML tags');
  console.log('✔ HTML email MIME parsing and plain text extraction passed');

  // ----------------------------------------------------------------
  // Test 3: Multipart/Alternative Email
  // ----------------------------------------------------------------
  console.log('\n[TEST 3] Multipart/Alternative Email');
  const altPlain = 'Plain version of newsletter';
  const altHtml = '<b>HTML version of newsletter</b>';

  const multipartAltMessage: gmail_v1.Schema$Message = {
    id: 'test_msg_alt_003',
    threadId: 'thread_003',
    internalDate: String(Date.now()),
    payload: {
      headers: [
        { name: 'Subject', value: 'Weekly Engineering Newsletter' },
        { name: 'From', value: 'newsletter@tech.io' }
      ],
      mimeType: 'multipart/alternative',
      parts: [
        {
          mimeType: 'text/plain',
          body: { data: Buffer.from(altPlain).toString('base64url') }
        },
        {
          mimeType: 'text/html',
          body: { data: Buffer.from(altHtml).toString('base64url') }
        }
      ]
    }
  };

  const parsedAlt = gmailService.parseGmailMessage(multipartAltMessage);
  assert.strictEqual(parsedAlt.bodyText, altPlain, 'Should extract plain text');
  assert.strictEqual(parsedAlt.bodyHtml, altHtml, 'Should extract HTML');
  console.log('✔ Multipart/alternative email parsing passed');

  // ----------------------------------------------------------------
  // Test 4: Nested Multipart/Mixed with Binary Attachment
  // ----------------------------------------------------------------
  console.log('\n[TEST 4] Nested Multipart/Mixed with Attachment Handling');
  const nestedMessage: gmail_v1.Schema$Message = {
    id: 'test_msg_nested_004',
    threadId: 'thread_004',
    internalDate: String(Date.now()),
    payload: {
      headers: [
        { name: 'Subject', value: 'Invoice Attached' },
        { name: 'From', value: 'billing@service.com' }
      ],
      mimeType: 'multipart/mixed',
      parts: [
        {
          mimeType: 'multipart/alternative',
          parts: [
            {
              mimeType: 'text/plain',
              body: { data: Buffer.from('Please find invoice attached.').toString('base64url') }
            },
            {
              mimeType: 'text/html',
              body: { data: Buffer.from('<p>Please find invoice attached.</p>').toString('base64url') }
            }
          ]
        },
        {
          mimeType: 'application/pdf',
          filename: 'invoice_2026.pdf',
          body: {
            attachmentId: 'att_blob_123',
            size: 204850
          }
        }
      ]
    }
  };

  const parsedNested = gmailService.parseGmailMessage(nestedMessage);
  assert(parsedNested.bodyText.includes('Please find invoice attached.'), 'Should extract nested text');
  console.log('✔ Nested multipart parsing with binary attachments passed without crashing');

  // ----------------------------------------------------------------
  // Test 5: Database Deduplication & Persistence
  // ----------------------------------------------------------------
  console.log('\n[TEST 5] Deduplication and Idempotent Storage');
  const testUser = await userService.upsertUser({
    email: `test_gmail_suite_${Date.now()}@lifesynch.ai`,
    name: 'Gmail Test Suite User'
  });
  const testUserId = testUser.id;
  const testMessageId = `gmail_msg_unique_${Date.now()}`;

  const emailBatch = [
    {
      messageId: testMessageId,
      threadId: 'thread_dedup',
      sender: 'test@lifesynch.ai',
      recipient: 'user@lifesynch.ai',
      subject: 'Deduplication Test Email',
      snippet: 'Testing that duplicate sync does not duplicate rows',
      bodyText: 'This email is tested for idempotency.',
      labels: ['INBOX'],
      receivedAt: new Date().toISOString()
    }
  ];

  // First sync call
  const initialResult = await emailService.saveEmails(testUserId, emailBatch);
  assert.strictEqual(initialResult.inserted, 1, 'First save should insert 1 email');
  assert.strictEqual(initialResult.updated, 0, 'First save should update 0 emails');

  // Second sync call with exact same message
  const secondResult = await emailService.saveEmails(testUserId, emailBatch);
  assert.strictEqual(secondResult.inserted, 0, 'Second save must insert 0 new emails');
  assert.strictEqual(secondResult.updated, 1, 'Second save should update existing email without duplicates');

  const storedEmails = await emailService.getEmails(testUserId, 10);
  const matchingEmails = storedEmails.filter(e => e.messageId === testMessageId);
  assert.strictEqual(matchingEmails.length, 1, 'Database must contain exactly 1 row for this messageId');
  console.log('✔ Deduplication verified: subsequent syncs update rather than create duplicate rows');

  // ----------------------------------------------------------------
  // Test 6: Authenticated User Isolation
  // ----------------------------------------------------------------
  console.log('\n[TEST 6] Authenticated User Isolation');
  const otherUser = await userService.upsertUser({
    email: `test_other_${Date.now()}@lifesynch.ai`,
    name: 'Other Test User'
  });
  const otherUserId = otherUser.id;
  const otherUserEmails = await emailService.getEmails(otherUserId, 10);
  assert.strictEqual(otherUserEmails.length, 0, 'User B must not see User A emails');

  const isolationEmail = await emailService.getEmailById(otherUserId, testMessageId);
  assert.strictEqual(isolationEmail, null, 'User B cannot query User A email by ID');
  console.log('✔ User isolation verified: data strictly scoped to authenticated user ID');

  // ----------------------------------------------------------------
  // Test 7: Missing Google Account Handling
  // ----------------------------------------------------------------
  console.log('\n[TEST 7] Missing Connected Google Account Error Handling');
  try {
    await gmailService.syncUserEmails('00000000-0000-0000-0000-000000000000');
    assert.fail('Should throw error for unconnected user');
  } catch (err: any) {
    assert(err.message.includes('No connected Google account'), 'Should report missing Google account');
    console.log('✔ Graceful error handling for unconnected account verified');
  }

  // ----------------------------------------------------------------
  // Test 8: Token Refresh Architecture
  // ----------------------------------------------------------------
  console.log('\n[TEST 8] Token Refresh Handling');
  const dummyUser = await userService.upsertUser({
    email: `test_refresh_${Date.now()}@lifesynch.ai`,
    name: 'Refresh Test User'
  });
  const dummyUserId = dummyUser.id;
  await accountService.saveConnectedAccount({
    userId: dummyUserId,
    provider: 'google',
    providerAccountId: 'google_dummy_123',
    accessToken: 'test_old_access_token',
    refreshToken: 'test_refresh_token',
    scopes: ['openid', 'email', 'https://www.googleapis.com/auth/gmail.readonly']
  });

  await accountService.updateTokens(dummyUserId, 'google', {
    accessToken: 'test_new_access_token'
  });

  const updatedAccount = await accountService.getAccount(dummyUserId, 'google');
  assert.strictEqual(updatedAccount.access_token, 'test_new_access_token', 'Access token should be updated');
  assert.strictEqual(updatedAccount.refresh_token, 'test_refresh_token', 'Refresh token should remain preserved');
  console.log('✔ Token refresh update mechanics verified');

  console.log('\n=====================================================');
  console.log('  ALL GMAIL INGESTION TESTS PASSED SUCCESSFULLY! (8/8)');
  console.log('=====================================================\n');
}

runGmailTests().catch(err => {
  console.error('TEST RUNNER FAILED:', err);
  process.exit(1);
});
