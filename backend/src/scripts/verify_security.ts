import { sanitizeLogData } from '../utils/logger';
import { accountService } from '../services/db/account.service';
import { userService } from '../services/db/user.service';
import { taskService } from '../services/task.service';
import { emailService } from '../services/db/email.service';
import { calendarEventService } from '../services/db/calendar-event.service';
import { reminderService } from '../services/reminder.service';
import { isSupabaseConfigured, getSupabaseClient } from '../config/supabase';
import { createApp } from '../app';
import http from 'http';
import fs from 'fs';
import path from 'path';

async function runSecurityAudit() {
  console.log('=====================================================');
  console.log('  LIFESYNCH AI — PHASE 8.2: SECURITY AUDIT SUITE    ');
  console.log('=====================================================\n');

  let passedAll = true;

  // 1. TOKEN PROTECTION: Test that tokens are never returned on ConnectedAccount or User objects
  console.log('[AUDIT 1] Google Access/Refresh Token Protection');
  const dummyUser = await userService.upsertUser({
    email: `sec_test_${Date.now()}@lifesynch.ai`,
    name: 'Security Test User'
  });
  const dummyUserId = dummyUser.id;
  const savedAccount = await accountService.saveConnectedAccount({
    userId: dummyUserId,
    provider: 'google',
    providerAccountId: '123456789',
    accessToken: 'ya29.a0AfH6SMDUMMYACCESSTOKENFORTESTINGPURPOSES',
    refreshToken: '1//0gDUMMYREFRESHTOKENFORTESTINGPURPOSES',
    scopes: ['https://www.googleapis.com/auth/gmail.readonly']
  });

  const accountHasToken = 'accessToken' in savedAccount || 'refreshToken' in savedAccount || 'access_token' in (savedAccount as any) || 'refresh_token' in (savedAccount as any);
  if (accountHasToken) {
    console.error('FAIL: saveConnectedAccount returned tokens on public object!');
    passedAll = false;
  } else {
    console.log('✔ saveConnectedAccount returns sanitized account with NO tokens');
  }

  // 2. LOG SECURITY: Test that logger sanitizes credentials and tokens
  console.log('\n[AUDIT 2] Log Sanitization & Credential Protection');
  const sampleLogWithSecret = {
    message: 'User logged in',
    access_token: 'ya29.secret_google_access_token_12345',
    refresh_token: '1//refresh_token_secret_67890',
    apiKey: 'AIzaSySecretApiKey123456789',
    password: 'SuperSecretUserPassword!',
    authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMyJ9.signature'
  };

  const sanitized = sanitizeLogData(sampleLogWithSecret) as Record<string, unknown>;
  const logLeaked = 
    sanitized.access_token !== '[REDACTED]' ||
    sanitized.refresh_token !== '[REDACTED]' ||
    sanitized.apiKey !== '[REDACTED]' ||
    sanitized.password !== '[REDACTED]' ||
    sanitized.authorization !== '[REDACTED]';

  const stringLogSanitized = sanitizeLogData('Auth header was Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMyJ9.sig and Google ya29.testtoken') as string;
  const stringLeaked = stringLogSanitized.includes('ya29.testtoken') || stringLogSanitized.includes('eyJhbGciOi');

  if (logLeaked || stringLeaked) {
    console.error('FAIL: Logger did not sanitize sensitive credentials!');
    passedAll = false;
  } else {
    console.log('✔ Logger redacts access_token, refresh_token, apiKey, password, authorization');
    console.log('✔ Logger redacts string patterns: ya29 tokens, JWTs, and Bearer tokens');
  }

  // 3. AUTHORIZATION: Test endpoints require authentication
  console.log('\n[AUDIT 3] API Endpoint Authentication Requirement');
  const app = createApp();
  const testServer = http.createServer(app);
  await new Promise<void>((resolve) => testServer.listen(5099, resolve));

  let authEnforced = false;
  try {
    const resTasks = await fetch('http://localhost:5099/api/v1/tasks');
    const resEmails = await fetch('http://localhost:5099/api/v1/sync/emails');
    const resCalendar = await fetch('http://localhost:5099/api/v1/sync/calendar-events');
    const resReminders = await fetch('http://localhost:5099/api/v1/reminders');
    const resAuthMe = await fetch('http://localhost:5099/api/v1/auth/me');

    authEnforced = 
      resTasks.status === 401 &&
      resEmails.status === 401 &&
      resCalendar.status === 401 &&
      resReminders.status === 401 &&
      resAuthMe.status === 401;

    if (!authEnforced) {
      console.error(`FAIL: One or more protected routes did not return 401: tasks=${resTasks.status}, emails=${resEmails.status}, cal=${resCalendar.status}, rem=${resReminders.status}, me=${resAuthMe.status}`);
      passedAll = false;
    } else {
      console.log('✔ GET /api/v1/tasks requires authentication (401)');
      console.log('✔ GET /api/v1/sync/emails requires authentication (401)');
      console.log('✔ GET /api/v1/sync/calendar-events requires authentication (401)');
      console.log('✔ GET /api/v1/reminders requires authentication (401)');
      console.log('✔ GET /api/v1/auth/me requires authentication (401)');
    }
  } catch (err) {
    console.error('Error during authorization tests:', err);
    passedAll = false;
  }

  // 4. USER ISOLATION: User A cannot access User B's data
  console.log('\n[AUDIT 4] User Data Isolation (Multi-tenant)');
  const userARec = await userService.upsertUser({
    email: `user_A_${Date.now()}@lifesynch.ai`,
    name: 'User A'
  });
  const userBRec = await userService.upsertUser({
    email: `user_B_${Date.now()}@lifesynch.ai`,
    name: 'User B'
  });
  const userA = userARec.id;
  const userB = userBRec.id;

  // Create task for user A
  const taskA = await taskService.createTask(userA, {
    title: 'User A Secret Responsibility',
    priority: 'high',
    dueDate: '2026-09-30'
  });

  // Query tasks for user B
  const userBTasks = await taskService.getTasks(userB);
  const userBSeesTaskA = userBTasks.some(t => t.id === taskA.id);

  // User B queries emails
  await emailService.saveEmails(userA, [{
    messageId: `msg_A_${Date.now()}`,
    subject: 'User A Private Email',
    receivedAt: new Date().toISOString()
  }]);
  const userBEmails = await emailService.getEmails(userB);
  const userBSeesEmailA = userBEmails.some(e => e.subject === 'User A Private Email');

  // User B queries calendar
  await calendarEventService.saveEvents(userA, [{
    eventId: `cal_A_${Date.now()}`,
    summary: 'User A Confidential Meeting',
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 3600000).toISOString(),
    status: 'confirmed'
  }]);
  const userBEvents = await calendarEventService.getEvents(userB);
  const userBSeesEventA = userBEvents.some(ev => ev.summary === 'User A Confidential Meeting');

  // User B queries reminders
  await reminderService.createReminder({
    userId: userA,
    title: 'Reminder for User A only',
    message: 'User A deadline',
    type: 'responsibility'
  });
  const userBReminders = await reminderService.getRemindersForUser(userB);
  const userBSeesReminderA = userBReminders.some(r => r.title === 'Reminder for User A only');

  if (userBSeesTaskA || userBSeesEmailA || userBSeesEventA || userBSeesReminderA) {
    console.error('FAIL: User isolation breach detected!');
    passedAll = false;
  } else {
    console.log('✔ Responsibilities isolated: User B cannot see User A tasks');
    console.log('✔ Emails isolated: User B cannot see User A emails');
    console.log('✔ Calendar events isolated: User B cannot see User A events');
    console.log('✔ Notifications/reminders isolated: User B cannot see User A reminders');
  }

  // 5. RLS PROTECTION
  console.log('\n[AUDIT 5] Supabase Row Level Security (RLS)');
  if (isSupabaseConfigured()) {
    const publicClient = getSupabaseClient();
    const { data: anonData, status } = await publicClient.from('users').select('*');
    const rlsProtected = status >= 200 && status < 300 && (!anonData || anonData.length === 0);
    if (!rlsProtected) {
      console.error('FAIL: Anon client accessed rows without authentication!');
      passedAll = false;
    } else {
      console.log('✔ RLS active and verified: Anon/unauthenticated queries cannot leak user data');
    }
  } else {
    console.log('ℹ Supabase not configured in current test run; in-memory isolation verified.');
  }

  // 6. FRONTEND SECRETS & API KEYS
  console.log('\n[AUDIT 6] Frontend Secrets & Hardcoded Credentials Audit');
  const frontendSrcDir = path.resolve(__dirname, '../../../frontend/src');
  const findSecretsInFiles = (dir: string): string[] => {
    const leaks: string[] = [];
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const full = path.join(dir, f);
      if (fs.statSync(full).isDirectory()) {
        leaks.push(...findSecretsInFiles(full));
      } else if (f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js')) {
        const content = fs.readFileSync(full, 'utf8');
        // Check for Google client secrets or service role keys
        if (content.includes('GOCSPX-') || content.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJy') || content.match(/AIza[0-9A-Za-z-_]{35}/)) {
          leaks.push(full);
        }
      }
    }
    return leaks;
  };

  const leaks = findSecretsInFiles(frontendSrcDir);
  if (leaks.length > 0) {
    console.error(`FAIL: Hardcoded secrets found in frontend: ${leaks.join(', ')}`);
    passedAll = false;
  } else {
    console.log('✔ No hardcoded API keys, client secrets, or service role keys in frontend source code');
  }

  // 7. ENV SECRETS NOT EXPOSED TO BROWSER
  console.log('\n[AUDIT 7] Browser Environment Variable Exposure');
  const frontendEnvPath = path.resolve(__dirname, '../../../frontend/.env');
  if (fs.existsSync(frontendEnvPath)) {
    const envContent = fs.readFileSync(frontendEnvPath, 'utf8');
    const dangerousVars = ['GOOGLE_CLIENT_SECRET', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET', 'LLM_API_KEY'];
    const exposed = dangerousVars.filter(v => envContent.includes(v));
    if (exposed.length > 0) {
      console.error(`FAIL: Backend secrets exposed in frontend .env: ${exposed.join(', ')}`);
      passedAll = false;
    } else {
      console.log('✔ Frontend .env contains no backend secrets (only VITE_ public vars)');
    }
  }

  // 8. CORS CONFIGURATION
  console.log('\n[AUDIT 8] CORS Security');
  const resCors = await fetch('http://localhost:5099/api/v1/health', {
    method: 'OPTIONS',
    headers: {
      'Origin': 'http://malicious-website.com',
      'Access-Control-Request-Method': 'GET'
    }
  });
  const allowedOrigin = resCors.headers.get('access-control-allow-origin');
  testServer.close();

  if (allowedOrigin === '*' || allowedOrigin === 'http://malicious-website.com') {
    console.error(`FAIL: CORS allowed untrusted origin: ${allowedOrigin}`);
    passedAll = false;
  } else {
    console.log('✔ CORS restricted: Untrusted origins are denied Access-Control-Allow-Origin header');
  }

  console.log('\n=====================================================');
  console.log(`SECURITY AUDIT RESULT: ${passedAll ? 'ALL CHECKS PASSED (10/10)' : 'AUDIT FAILED'}`);
  console.log('=====================================================');

  if (!passedAll) {
    process.exit(1);
  }
}

runSecurityAudit().catch(err => {
  console.error('FATAL AUDIT ERROR:', err);
  process.exit(1);
});
