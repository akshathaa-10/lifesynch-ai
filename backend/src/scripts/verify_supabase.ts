import { env, validateRequiredEnv, REQUIRED_BACKEND_ENV_VARS } from '../config/env';
import { isSupabaseConfigured, getSupabaseClient, getSupabaseAdminClient } from '../config/supabase';
import http from 'http';
import { createApp } from '../app';

async function runComprehensiveVerification() {
  console.log('=====================================================');
  console.log('  LIFESYNCH AI — SUPABASE VERIFICATION SUITE');
  console.log('=====================================================');

  // 1. Environment Loading & Required Variables Check
  const envValidation = validateRequiredEnv();
  const allRequiredPresent = envValidation.valid;
  console.log('1. Required Variables Validation:');
  for (const v of REQUIRED_BACKEND_ENV_VARS) {
    const isPresent = Boolean(env[v as keyof typeof env] && String(env[v as keyof typeof env]).trim().length > 0);
    console.log(`   - ${v}: ${isPresent ? 'PRESENT' : 'MISSING'}`);
  }

  // 2. Supabase Configuration Check
  const configured = isSupabaseConfigured();
  console.log(`2. Supabase Configured Flag: ${configured ? 'TRUE' : 'FALSE'}`);
  console.log(`   In-Memory Fallback: ${configured ? 'DISABLED' : 'ENABLED'}`);

  // 3. Database Connectivity Check
  const adminClient = getSupabaseAdminClient();
  const publicClient = getSupabaseClient();

  // 4. Verify 7 Tables
  const requiredTables = [
    'users',
    'connected_accounts',
    'emails',
    'responsibilities',
    'calendar_events',
    'notifications',
    'sync_state'
  ] as const;

  console.log('3. Verifying 7 Tables in Supabase:');
  const tableResults: Record<string, boolean> = {};
  for (const table of requiredTables) {
    const { error, status } = await adminClient.from(table).select('*').limit(1);
    const ok = status >= 200 && status < 300 && !error;
    tableResults[table] = ok;
    console.log(`   - Table '${table}': ${ok ? 'VERIFIED (HTTP ' + status + ')' : 'FAIL (' + error?.message + ')'}`);
  }
  const allTablesVerified = Object.values(tableResults).every(Boolean);

  // 5. Verify Specific Columns
  console.log('4. Verifying Required Columns:');
  const { error: emailColErr } = await adminClient.from('emails').select('labels').limit(1);
  const emailLabelsVerified = !emailColErr;
  console.log(`   - emails.labels: ${emailLabelsVerified ? 'VERIFIED' : 'FAIL: ' + emailColErr?.message}`);

  const { error: calColErr } = await adminClient.from('calendar_events').select('calendar_id, status').limit(1);
  const calColsVerified = !calColErr;
  console.log(`   - calendar_events.calendar_id & status: ${calColsVerified ? 'VERIFIED' : 'FAIL: ' + calColErr?.message}`);

  // 6. Verify Row Level Security (RLS)
  console.log('5. Verifying Row Level Security (RLS):');
  // With public/anon key, selecting users should either return 0 rows or respect RLS policy
  const { data: anonData, error: anonErr, status: anonStatus } = await publicClient.from('users').select('*');
  const rlsActive = anonStatus >= 200 && anonStatus < 300 && (!anonData || anonData.length === 0);
  console.log(`   - Public/Anon access control: ${rlsActive ? 'VERIFIED (RLS Active, no unauthorized leak)' : 'Status ' + anonStatus + ' ' + anonErr?.message}`);

  // 7. Verify Server & Health Endpoint
  console.log('6. Testing Express Server & /api/v1/health:');
  const app = createApp();
  const testServer = http.createServer(app);
  await new Promise<void>((resolve) => testServer.listen(5098, resolve));

  try {
    const res = await fetch('http://localhost:5098/api/v1/health');
    const healthJson = await res.json() as any;
    console.log(`   - Health check status: ${res.status}`);
    console.log(`   - Database service reported: ${healthJson.data?.services?.database}`);
    console.log(`   - Google Auth service reported: ${healthJson.data?.services?.googleAuth}`);
  } finally {
    testServer.close();
  }

  console.log('=====================================================');
  console.log('SUMMARY:');
  console.log(`- Supabase URL: ${env.SUPABASE_URL ? 'PASS' : 'FAIL'}`);
  console.log(`- Supabase Credentials: ${allRequiredPresent ? 'PRESENT' : 'MISSING'}`);
  console.log(`- 7 Tables: ${allTablesVerified ? 'VERIFIED' : 'FAIL'}`);
  console.log(`- Required Columns: ${emailLabelsVerified && calColsVerified ? 'VERIFIED' : 'FAIL'}`);
  console.log(`- RLS: ${rlsActive ? 'VERIFIED' : 'FAIL'}`);
  console.log(`- In-Memory Fallback: ${configured ? 'DISABLED' : 'ENABLED'}`);
  console.log('=====================================================');
}

runComprehensiveVerification().catch((e) => {
  console.error('VERIFICATION ERROR:', e);
  process.exit(1);
});
