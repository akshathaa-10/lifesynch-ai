import assert from 'assert';
import { 
  ExtractedTaskSchema, 
  ExtractedTasksListSchema, 
  Responsibility, 
  ResponsibilitySyncSummary,
  normalizeResponsibilityType,
  normalizeRawExtractedTasks
} from '@lifesynch/shared';
import { taskService } from '../services/task.service';
import { userService } from '../services/db/user.service';
import { emailService } from '../services/db/email.service';
import { calendarEventService } from '../services/db/calendar-event.service';
import { responsibilityGenerationService } from '../services/ai/responsibility-generation.service';
import { env } from '../config/env';
import { isSupabaseConfigured, getSupabaseAdminClient } from '../config/supabase';

async function runResponsibilityTests() {
  console.log('=====================================================');
  console.log('  LIFESYNCH AI — AI RESPONSIBILITY TEST SUITE');
  console.log('=====================================================');

  // ----------------------------------------------------------------
  // Test 1: Structured AI Output Schema Validation
  // ----------------------------------------------------------------
  console.log('\n[TEST 1] Structured Output Zod Validation');
  const validAiPayload = {
    tasks: [
      {
        title: 'Final SIH 2026 Submission',
        description: 'Submit the final project presentation and prototype link for SIH evaluation.',
        category: 'academic',
        type: 'deadline',
        priority: 'urgent',
        action: 'Upload code archive and submit presentation deck before deadline',
        dueDate: '2026-09-28T17:00:00.000Z',
        dueTime: '17:00',
        confidence: 0.95,
        sourceType: 'gmail',
        sourceId: 'msg_sih_001',
        tags: ['academic', 'sih', 'submission'],
        actionRequired: true,
        reasoning: 'Explicit submission deadline mentioned with critical urgency.'
      },
      {
        title: 'NPTEL Exam Attendance',
        description: 'Attend the scheduled morning NPTEL examination slot.',
        category: 'academic',
        type: 'appointment',
        priority: 'high',
        action: 'Report to examination hall with hall ticket at 9 AM',
        dueDate: '2026-09-24T11:00:00.000Z',
        dueTime: '09:00',
        confidence: 0.92,
        sourceType: 'calendar',
        sourceId: 'evt_nptel_002',
        tags: ['exam', 'academic'],
        actionRequired: true,
        reasoning: 'Confirmed exam appointment on calendar requiring personal presence.'
      }
    ],
    hasActionableContent: true,
    summary: 'Identified 2 critical academic responsibilities.'
  };

  const validation = ExtractedTasksListSchema.safeParse(validAiPayload);
  assert(validation.success, 'Valid AI output must pass schema validation');
  assert.strictEqual(validation.data.tasks.length, 2);
  assert.strictEqual(validation.data.tasks[0].title, 'Final SIH 2026 Submission');
  assert.strictEqual(validation.data.tasks[0].action, 'Upload code archive and submit presentation deck before deadline');
  assert.strictEqual(validation.data.tasks[0].category, 'academic');
  assert.strictEqual(validation.data.tasks[0].priority, 'urgent');
  assert.strictEqual(validation.data.tasks[1].sourceType, 'calendar');
  console.log('✔ Structured AI Output Zod validation passed');

  // Verify all supported responsibility types directly and with case variations
  const supportedTypes = ['task', 'deadline', 'appointment', 'reminder', 'other'];
  for (const t of supportedTypes) {
    assert.strictEqual(normalizeResponsibilityType(t), t, `Supported type "${t}" should remain "${t}"`);
    assert.strictEqual(normalizeResponsibilityType(t.toUpperCase()), t, `Uppercase "${t.toUpperCase()}" should normalize to "${t}"`);
  }
  console.log('✔ All supported responsibility type enum values verified');

  // ----------------------------------------------------------------
  // Test 1B: Safe Normalization of Common LLM Type Variations
  // ----------------------------------------------------------------
  console.log('\n[TEST 1B] Responsibility Type Variation Normalization');
  const variationsPayload = {
    tasks: [
      {
        title: 'Attend Machine Learning Seminar',
        description: 'Weekly seminar session in Hall 4.',
        category: 'academic',
        type: 'meeting', // LLM returned 'meeting' instead of 'appointment'
        priority: 'medium',
        action: 'Join seminar and sign attendance sheet',
        dueDate: '2026-10-15T14:00:00.000Z',
        sourceType: 'calendar',
        actionRequired: true
      },
      {
        title: 'Department Tech Symposium',
        description: 'Annual department exhibition event.',
        category: 'academic',
        type: 'event', // LLM returned 'event' instead of 'appointment'
        priority: 'medium',
        action: 'Coordinate project booth demonstration',
        dueDate: '2026-10-20T09:00:00.000Z',
        sourceType: 'calendar',
        actionRequired: true
      },
      {
        title: 'Complete Operating Systems Lab Assignment',
        description: 'Implement pthread producer-consumer problem.',
        category: 'academic',
        type: 'academic', // LLM returned 'academic' instead of 'task'
        priority: 'high',
        action: 'Write C implementation and lab report',
        dueDate: '2026-10-18T23:59:00.000Z',
        sourceType: 'gmail',
        actionRequired: true
      },
      {
        title: 'Submit Gate Pass Request',
        description: 'Submit campus hostel leave request form.',
        category: 'personal',
        type: 'work', // LLM returned 'work' instead of 'task'
        priority: 'low',
        action: 'Fill online portal form',
        sourceType: 'gmail',
        actionRequired: true
      },
      {
        title: 'Project Proposal Due Date',
        description: 'Submit project abstract and group details.',
        category: 'academic',
        type: 'submission', // LLM returned 'submission' instead of 'deadline'
        priority: 'high',
        action: 'Upload PDF to classroom portal',
        dueDate: '2026-10-25T17:00:00.000Z',
        sourceType: 'gmail',
        actionRequired: true
      },
      {
        title: 'Check Application Status Alert',
        description: 'Follow up on scholarship verification status.',
        category: 'general',
        type: 'follow_up', // LLM returned 'follow_up' instead of 'reminder'
        priority: 'medium',
        action: 'Log in to scholarship portal and verify document status',
        sourceType: 'gmail',
        actionRequired: true
      }
    ],
    hasActionableContent: true,
    summary: 'Payload with common LLM type variations'
  };

  // Step 1: Pre-validation normalization step (mirrors service flow)
  const normalizedVariations = normalizeRawExtractedTasks(variationsPayload) as typeof variationsPayload;
  assert.strictEqual(normalizedVariations.tasks[0].type, 'appointment', "'meeting' must normalize to 'appointment'");
  assert.strictEqual(normalizedVariations.tasks[1].type, 'appointment', "'event' must normalize to 'appointment'");
  assert.strictEqual(normalizedVariations.tasks[2].type, 'task', "'academic' must normalize to 'task'");
  assert.strictEqual(normalizedVariations.tasks[3].type, 'task', "'work' must normalize to 'task'");
  assert.strictEqual(normalizedVariations.tasks[4].type, 'deadline', "'submission' must normalize to 'deadline'");
  assert.strictEqual(normalizedVariations.tasks[5].type, 'reminder', "'follow_up' must normalize to 'reminder'");

  // Step 2: Zod schema validation passes cleanly without LLM_SCHEMA_INVALID
  const variationsValidation = ExtractedTasksListSchema.safeParse(normalizedVariations);
  assert(variationsValidation.success, 'Normalized payload must pass Zod schema validation cleanly');
  assert.strictEqual(variationsValidation.data.tasks.length, 6);

  // Step 3: Verify existing attributes (due dates, actions, titles) are completely preserved without invention
  assert.strictEqual(variationsValidation.data.tasks[0].dueDate, '2026-10-15T14:00:00.000Z');
  assert.strictEqual(variationsValidation.data.tasks[0].action, 'Join seminar and sign attendance sheet');
  assert.strictEqual(variationsValidation.data.tasks[3].dueDate, undefined, 'No false deadline invented for task without due date');
  console.log('✔ Common type variations (meeting, event, academic, work, submission, follow_up) safely normalized and verified');

  // ----------------------------------------------------------------
  // Test 2: Genuinely Invalid Output Schema Rejection (No Arbitrary Values)
  // ----------------------------------------------------------------
  console.log('\n[TEST 2] Genuinely Invalid Output Schema Rejection');
  const invalidTypePayload = {
    tasks: [
      {
        title: 'Invalid Arbitrary Type Task',
        type: 'banana', // Genuinely invalid type string
        priority: 'medium',
        actionRequired: true
      }
    ],
    hasActionableContent: true
  };

  const normalizedInvalidPayload = normalizeRawExtractedTasks(invalidTypePayload);
  const invalidTypeResult = ExtractedTasksListSchema.safeParse(normalizedInvalidPayload);
  assert(!invalidTypeResult.success, 'Arbitrary unknown type like "banana" must NOT be accepted');
  
  // Verify diagnostic information extraction is safe (path, code, message) without leaking sensitive fields
  const safeDiagnostics = invalidTypeResult.error.issues.map(issue => ({
    path: issue.path.join('.'),
    code: issue.code,
    message: issue.message
  }));
  assert(safeDiagnostics.length > 0);
  assert.strictEqual(safeDiagnostics[0].path, 'tasks.0.type');
  assert.strictEqual(safeDiagnostics[0].code, 'invalid_enum_value');
  console.log('✔ Genuinely invalid type ("banana") rejected and safe diagnostics produced:', safeDiagnostics[0]);

  const malformedPayload = {
    tasks: [
      {
        title: 'X', // Too short (< 2 chars)
        priority: 'super-urgent' // Invalid priority enum
      }
    ],
    hasActionableContent: true
  };
  const malformedResult = ExtractedTasksListSchema.safeParse(normalizeRawExtractedTasks(malformedPayload));
  assert(!malformedResult.success, 'Malformed schema structure must fail validation');
  console.log('✔ Malformed AI outputs correctly rejected after normalization');

  // ----------------------------------------------------------------
  // Test 3: Supabase Storage, Category & Action Mapping
  // ----------------------------------------------------------------
  console.log('\n[TEST 3] Responsibility Storage & Metadata Mapping');
  const testUser = await userService.upsertUser({
    email: `test_resp_user_${Date.now()}@lifesynch.ai`,
    name: 'AI Test User'
  });
  const testUserId = testUser.id;

  const testRespId = `resp_test_${Date.now()}`;
  const createdResp = await taskService.createTask(testUserId, {
    title: 'Project Viva Presentation',
    description: 'Final semester viva presentation before external committee',
    action: 'Present live architecture slides and demonstrate working software',
    category: 'academic',
    type: 'appointment',
    priority: 'high',
    dueDate: '2026-09-30T10:00:00.000Z',
    dueTime: '10:00',
    source: 'calendar',
    sourceId: testRespId,
    confidence: 0.94,
    tags: ['viva', 'final-year']
  });

  assert(createdResp.id, 'Created responsibility must have an ID');
  assert.strictEqual(createdResp.title, 'Project Viva Presentation');
  assert.strictEqual(createdResp.action, 'Present live architecture slides and demonstrate working software');
  assert.strictEqual(createdResp.category, 'academic');
  assert.strictEqual(createdResp.priority, 'high');
  assert.strictEqual(createdResp.source, 'calendar');
  console.log('✔ Responsibility creation and metadata mapping verified');

  // ----------------------------------------------------------------
  // Test 4: Deduplication & Update Handling
  // ----------------------------------------------------------------
  console.log('\n[TEST 4] Deduplication and Idempotent Updates');
  const updatedResp = await taskService.updateTask(createdResp.id, {
    action: 'Present updated slides and revised demo URL',
    priority: 'urgent',
    dueDate: '2026-09-30T11:00:00.000Z'
  });

  assert.strictEqual(updatedResp.action, 'Present updated slides and revised demo URL');
  assert.strictEqual(updatedResp.priority, 'high'); // Phase 5 normalizes 'urgent' -> 'high'

  const allUserTasks = await taskService.getTasks(testUserId);
  const matchingTasks = allUserTasks.filter(t => t.id === createdResp.id || t.sourceId === testRespId);
  assert.strictEqual(matchingTasks.length, 1, 'There must be exactly 1 responsibility row (no duplicate)');
  console.log('✔ Deduplication and modification updates verified');

  // ----------------------------------------------------------------
  // Test 5: Authenticated User Isolation
  // ----------------------------------------------------------------
  console.log('\n[TEST 5] Authenticated User Isolation');
  const otherUser = await userService.upsertUser({
    email: `test_other_resp_${Date.now()}@lifesynch.ai`,
    name: 'Other AI User'
  });
  const otherUserId = otherUser.id;

  const otherUserTasks = await taskService.getTasks(otherUserId);
  assert.strictEqual(otherUserTasks.length, 0, 'User B must not see User A responsibilities');

  const crossUserTask = await taskService.getTaskById(createdResp.id);
  assert(crossUserTask !== null);
  assert.strictEqual(crossUserTask?.userId, testUserId);
  console.log('✔ Authenticated user isolation verified: responsibilities strictly scoped to user_id');

  // ----------------------------------------------------------------
  // Test 6: Missing LLM Key Graceful Error Handling
  // ----------------------------------------------------------------
  console.log('\n[TEST 6] Missing LLM Key Configuration Handling');
  if (!env.LLM_API_KEY) {
    try {
      await responsibilityGenerationService.generateResponsibilities(testUserId);
      assert.fail('Should throw error when LLM_API_KEY is not configured');
    } catch (err: any) {
      assert(err.message.includes('LLM_API_KEY'), 'Must provide clear guidance for missing LLM_API_KEY');
      console.log('✔ Missing LLM API key correctly triggers clean error message');
    }
  } else {
    console.log('- LLM_API_KEY is configured. Proceeding to live AI extraction test...');
  }

  // ----------------------------------------------------------------
  // Test 7: Live AI Extraction with Real Google Feeds (when key is active)
  // ----------------------------------------------------------------
  console.log('\n[TEST 7] Live AI Responsibility Generation with Real Stored Feeds');
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdminClient();
    const { data: accounts } = await supabase
      .from('connected_accounts')
      .select('user_id, scopes')
      .eq('provider', 'google')
      .order('updated_at', { ascending: false });

    const liveAccount = accounts?.find(a => (a.scopes || []).some((s: string) => s.includes('calendar.readonly')) && a.user_id !== 'aadc7bd9-efad-4222-a0c8-746bb0d56075') || accounts?.[0];

    if (liveAccount) {
      const liveUserId = liveAccount.user_id;
      const storedEmails = await emailService.getEmails(liveUserId, 10);
      const storedEvents = await calendarEventService.getEvents(liveUserId, 10);
      console.log(`- Real authorized user (${liveUserId}) has ${storedEmails.length} stored emails and ${storedEvents.length} calendar events in Supabase.`);

      if (env.LLM_API_KEY) {
        console.log('- Running live responsibilityGenerationService.generateResponsibilities()...');
        const syncSummary = await responsibilityGenerationService.generateResponsibilities(liveUserId);
        console.log('- AI Extraction Summary:', syncSummary);
        assert(typeof syncSummary.generated === 'number');
        assert(typeof syncSummary.updated === 'number');
        assert(typeof syncSummary.skipped === 'number');

        // Verify stored responsibilities
        const generatedTasks = await taskService.getTasks(liveUserId);
        console.log(`- Stored responsibilities in Supabase: ${generatedTasks.length}`);
        if (generatedTasks.length > 0) {
          console.log(`- Sample Responsibility:`, {
            title: generatedTasks[0].title,
            priority: generatedTasks[0].priority,
            category: generatedTasks[0].category,
            action: generatedTasks[0].action,
            dueDate: generatedTasks[0].dueDate,
            source: generatedTasks[0].source
          });
        }

        // Test second sync idempotency / deduplication
        console.log('- Running second AI sync to verify deduplication on live feeds...');
        const secondSync = await responsibilityGenerationService.generateResponsibilities(liveUserId);
        console.log('- Second AI Sync Summary:', secondSync);
        assert.strictEqual(secondSync.generated, 0, 'Second sync must not create duplicate responsibilities');
        console.log('✔ Live AI extraction, Supabase storage & deduplication verified');
      } else {
        console.log('Notice: LLM_API_KEY not yet set in backend/.env. Add key to run live Gemini extraction.');
      }
    }
  }

  console.log('\n=====================================================');
  console.log('  ALL RESPONSIBILITY TESTS PASSED SUCCESSFULLY!');
  console.log('=====================================================\n');
}

runResponsibilityTests().catch((err) => {
  console.error('TEST RUNNER FAILED:', err);
  process.exit(1);
});
