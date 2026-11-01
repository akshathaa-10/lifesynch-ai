import fs from 'fs';
import path from 'path';
import http from 'http';
import assert from 'assert';
import { createApp } from '../app';
import { userService } from '../services/db/user.service';
import { taskService } from '../services/task.service';
import { signUserToken } from '../utils/jwt';

async function runExtensionTestSuite() {
  console.log('================================================================');
  console.log('  LIFESYNCH AI — FINAL FEATURE 2: CHROME EXTENSION TEST SUITE  ');
  console.log('================================================================\n');

  let passedAll = true;

  // 1. EXTENSION FILES & MANIFEST V3 VERIFICATION
  console.log('[TEST 1] Extension Manifest and Assets Verification');
  const extDir = path.resolve(__dirname, '../../../extension');
  const manifestPath = path.join(extDir, 'manifest.json');

  assert(fs.existsSync(manifestPath), 'manifest.json does not exist');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.strictEqual(manifest.manifest_version, 3, 'Manifest must be version 3');
  assert.strictEqual(manifest.action.default_popup, 'popup.html', 'Action popup must be popup.html');
  assert(manifest.permissions.includes('storage'), 'Storage permission required');

  const requiredFiles = [
    'popup.html',
    'popup.css',
    'popup.js',
    'background.js',
    'content.js',
    'overlay.css',
    'icons/icon16.png',
    'icons/icon48.png',
    'icons/icon128.png'
  ];

  for (const relFile of requiredFiles) {
    const fullPath = path.join(extDir, relFile);
    assert(fs.existsSync(fullPath), `Required extension asset missing: ${relFile}`);
  }
  console.log('✔ Manifest V3 valid, popup, background, content scripts, and icons all exist');

  // Start temporary backend server for live HTTP testing
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api/v1`;
  console.log(`[TEST SERVER] Running ephemeral backend at ${baseUrl}`);

  try {
    // 2. UNHOOKED / UNAUTHENTICATED STATE
    console.log('\n[TEST 2] Unauthenticated State Handling');
    const unauthRes = await fetch(`${baseUrl}/tasks`);
    assert.strictEqual(unauthRes.status, 401, 'Unauthenticated /tasks must return 401');

    const unauthAskRes = await fetch(`${baseUrl}/assistant/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'What should I focus on today?' })
    });
    assert.strictEqual(unauthAskRes.status, 401, 'Unauthenticated /assistant/ask must return 401');
    console.log('✔ Unauthenticated requests are rejected with 401');

    // 3. AUTHENTICATION & USER SETUP
    console.log('\n[TEST 3] Extension Authentication Flow & Real User Data');
    const timestamp = Date.now();
    const userA = await userService.upsertUser({
      email: `ext_user_a_${timestamp}@lifesynch.ai`,
      name: 'Extension Test Student'
    });
    const tokenA = signUserToken({ id: userA.id, email: userA.email });

    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.strictEqual(meRes.status, 200, '/auth/me must return 200 for authenticated user');
    const meData = await meRes.json();
    assert.strictEqual(meData.data.email, userA.email, 'User email matches');
    assert.strictEqual(meData.data.name, 'Extension Test Student', 'User name matches');
    console.log('✔ Authenticated /auth/me returns real user identity');

    // 4. REAL RESPONSIBILITIES, PRIORITY & DEADLINE
    console.log('\n[TEST 4] Real Responsibilities, Priorities & Deadlines');
    const todayStr = new Date().toISOString().split('T')[0];

    const task1 = await taskService.createTask(userA.id, {
      title: 'Project Report Submission',
      description: 'Submit report to coordinator before the deadline.',
      priority: 'high',
      dueDate: todayStr,
      dueTime: '17:00',
      action: 'Submit report to coordinator',
      category: 'academic',
      source: 'gmail',
      sourceContext: { sender: 'coordinator@university.edu' }
    });

    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];

    const task2 = await taskService.createTask(userA.id, {
      title: 'Read Chapter 4 Notes',
      description: 'Review lecture reading material.',
      priority: 'medium',
      dueDate: nextWeekStr,
      dueTime: '10:00',
      action: 'Read chapter notes',
      category: 'academic',
      source: 'calendar'
    });

    const tasksRes = await fetch(`${baseUrl}/tasks`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.strictEqual(tasksRes.status, 200);
    const tasksJson = await tasksRes.json();
    const userTasks = tasksJson.data;

    assert(Array.isArray(userTasks), 'Tasks response data must be array');
    const foundTask1 = userTasks.find((t: any) => t.id === task1.id);
    const foundTask2 = userTasks.find((t: any) => t.id === task2.id);

    assert(foundTask1, 'Task 1 found in real user responsibilities');
    assert.strictEqual(foundTask1.priority, 'high', 'Priority is high');
    assert.strictEqual(foundTask1.dueTime, '17:00', 'Due time is 17:00');
    assert(foundTask1.dueDate.startsWith(todayStr), 'Due date is today');

    assert(foundTask2, 'Task 2 found in real user responsibilities');
    assert.strictEqual(foundTask2.priority, 'medium', 'Priority is medium');
    assert.strictEqual(foundTask2.dueTime, '10:00', 'Due time is 10:00');
    assert(foundTask2.dueDate.startsWith(nextWeekStr), 'Due date is next week');
    console.log('✔ Real responsibilities fetched with accurate priority (high, medium) and deadlines');

    // 5. EXTENSION ASSISTANT INTEGRATION
    console.log('\n[TEST 5] Conversational Assistant Integration');
    const askRes = await fetch(`${baseUrl}/assistant/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        question: 'What should I focus on today?'
      })
    });

    assert.strictEqual(askRes.status, 200);
    const askJson = await askRes.json();
    assert(askJson.success, 'Assistant response successful');
    assert(askJson.data.answer, 'Assistant response contains answer');
    console.log(`Assistant Answer: "${askJson.data.answer.substring(0, 120)}..."`);
    assert(
      askJson.data.answer.includes('Project Report') || askJson.data.answer.includes('Submission'),
      'Assistant answer must reference real responsibilities'
    );
    console.log('✔ Assistant answered questions grounded in user’s real obligations');

    // 6. USER ISOLATION
    console.log('\n[TEST 6] Strict User Isolation');
    const userB = await userService.upsertUser({
      email: `ext_user_b_${timestamp}@lifesynch.ai`,
      name: 'User B Person'
    });
    const tokenB = signUserToken({ id: userB.id, email: userB.email });

    // User B fetches their tasks
    const tasksResB = await fetch(`${baseUrl}/tasks`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    const tasksJsonB = await tasksResB.json();
    const tasksB = tasksJsonB.data;

    // User B should NOT see User A's tasks
    const leakedTask = tasksB.find((t: any) => t.id === task1.id || t.id === task2.id);
    assert(!leakedTask, 'User B must NOT see User A tasks');

    // User B asks assistant about tasks
    const askResB = await fetch(`${baseUrl}/assistant/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`
      },
      body: JSON.stringify({ question: 'What should I focus on today?' })
    });
    const askJsonB = await askResB.json();
    assert(!askJsonB.data.answer.includes('Project Report Submission'), 'User B assistant must never mention User A obligations');
    console.log('✔ Strict User Isolation confirmed across responsibilities and assistant queries');

    // 7. SENSITIVE TOKEN EXPOSURE CHECK
    console.log('\n[TEST 7] Zero Sensitive Token Exposure');
    const serializedResponses = [
      JSON.stringify(meData),
      JSON.stringify(tasksJson),
      JSON.stringify(askJson)
    ];

    for (const jsonStr of serializedResponses) {
      assert(!jsonStr.includes('ya29.'), 'No Google access tokens exposed');
      assert(!jsonStr.includes('1//'), 'No Google refresh tokens exposed');
      assert(!jsonStr.includes('service_role'), 'No Supabase service role key exposed');
      assert(!jsonStr.includes('SUPABASE_SERVICE_ROLE_KEY'), 'No Supabase service key exposed');
      assert(!jsonStr.includes('password'), 'No passwords exposed');
    }
    console.log('✔ Zero sensitive tokens or credentials exposed');

    // 8. CORS SECURITY FOR CHROME EXTENSION
    console.log('\n[TEST 8] CORS Policy for Chrome Extensions');
    const extensionOrigin = 'chrome-extension://lifesynch-ai-test-extension';
    const corsRes = await fetch(`${baseUrl}/tasks`, {
      method: 'OPTIONS',
      headers: {
        Origin: extensionOrigin,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Authorization'
      }
    });

    const allowedOrigin = corsRes.headers.get('access-control-allow-origin');
    assert.strictEqual(allowedOrigin, extensionOrigin, 'CORS must allow chrome-extension:// origins');

    // Verify untrusted web origin is blocked
    const badCorsRes = await fetch(`${baseUrl}/tasks`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://evil-phishing-site.com',
        'Access-Control-Request-Method': 'GET'
      }
    });
    const badAllowedOrigin = badCorsRes.headers.get('access-control-allow-origin');
    assert.notStrictEqual(badAllowedOrigin, 'https://evil-phishing-site.com', 'CORS must block untrusted web origins');
    console.log('✔ CORS safely accepts chrome-extension:// while blocking untrusted web origins');

  } catch (err) {
    console.error('Test failed with error:', err);
    passedAll = false;
  } finally {
    if (typeof (server as any).closeAllConnections === 'function') {
      (server as any).closeAllConnections();
    }
    server.close();
  }

  console.log('\n================================================================');
  if (passedAll) {
    console.log('  ✔ ALL CHROME EXTENSION VERIFICATION TESTS PASSED SUCCESSFULLY ');
    console.log('================================================================\n');
    process.exit(0);
  } else {
    console.error('  ❌ SOME TESTS FAILED ');
    console.log('================================================================\n');
    process.exit(1);
  }
}

runExtensionTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
