import { z } from 'zod';

export const ResponsibilityTypeEnum = z.enum([
  'task',
  'deadline',
  'appointment',
  'reminder',
  'other'
]);

export const KNOWN_RESPONSIBILITY_TYPE_VARIATIONS: Record<string, z.infer<typeof ResponsibilityTypeEnum>> = {
  // Appointment variations
  meeting: 'appointment',
  event: 'appointment',
  session: 'appointment',
  interview: 'appointment',
  call: 'appointment',
  webinar: 'appointment',
  conference: 'appointment',
  discussion: 'appointment',
  event_meeting: 'appointment',

  // Task variations (including category leakage / action terms)
  academic: 'task',
  work: 'task',
  personal: 'task',
  finance: 'task',
  general: 'task',
  admin: 'task',
  todo: 'task',
  action: 'task',
  assignment: 'task',
  homework: 'task',
  project: 'task',
  lab: 'task',
  action_required: 'task',

  // Deadline variations
  submission: 'deadline',
  due_date: 'deadline',
  due: 'deadline',
  cutoff: 'deadline',
  strict_deadline: 'deadline',
  application_window: 'deadline',

  // Reminder variations
  follow_up: 'reminder',
  followup: 'reminder',
  alert: 'reminder',
  notification: 'reminder',
  notice: 'reminder',

  // Other variations
  misc: 'other',
  miscellaneous: 'other',
  informational: 'other'
};

/**
 * Normalizes raw responsibility types from AI responses or client input.
 * Maps known variations (e.g. 'academic', 'meeting', 'event') to valid ResponsibilityTypeEnum values.
 * Returns valid supported types, maps known variations, and preserves unrecognized values
 * so downstream schema validation can reject genuinely invalid inputs.
 */
export function normalizeResponsibilityType(raw: unknown): unknown {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }

  if (typeof raw !== 'string') {
    return raw;
  }

  const cleaned = raw.trim().toLowerCase();

  // If already a valid ResponsibilityTypeEnum value
  if (
    cleaned === 'task' ||
    cleaned === 'deadline' ||
    cleaned === 'appointment' ||
    cleaned === 'reminder' ||
    cleaned === 'other'
  ) {
    return cleaned;
  }

  // Check known variations
  if (cleaned in KNOWN_RESPONSIBILITY_TYPE_VARIATIONS) {
    return KNOWN_RESPONSIBILITY_TYPE_VARIATIONS[cleaned];
  }

  // Return unmapped string as-is so Zod will reject genuinely invalid types
  return raw;
}

/**
 * Pre-validation normalization helper for raw LLM extracted tasks payloads.
 * Walks tasks array and normalizes recoverable type variations.
 */
export function normalizeRawExtractedTasks(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const record = payload as Record<string, unknown>;
  if (!Array.isArray(record.tasks)) {
    return payload;
  }

  const normalizedTasks = record.tasks.map((task) => {
    if (!task || typeof task !== 'object') {
      return task;
    }
    const taskObj = { ...(task as Record<string, unknown>) };
    if ('type' in taskObj) {
      taskObj.type = normalizeResponsibilityType(taskObj.type);
    }
    return taskObj;
  });

  return {
    ...record,
    tasks: normalizedTasks
  };
}

export const TaskPriorityEnum = z.enum(['urgent', 'high', 'medium', 'low']);
export const TaskStatusEnum = z.enum([
  'UPCOMING',
  'DUE_TODAY',
  'OVERDUE',
  'COMPLETED',
  'CANCELLED',
  'pending',
  'in_progress',
  'completed',
  'dismissed',
  'upcoming',
  'due_today',
  'overdue',
  'cancelled'
]);
export const TaskCategoryEnum = z.enum([
  'academic',
  'work',
  'personal',
  'finance',
  'meeting',
  'deadline',
  'general'
]);
export const TaskSourceEnum = z.enum(['gmail', 'calendar', 'both', 'manual', 'extension']);

// Schema used for LLM structured output extraction from emails or calendar events
export const ExtractedTaskSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters long').max(200),
  description: z.string().max(1000).optional().default(''),
  type: z.preprocess(normalizeResponsibilityType, ResponsibilityTypeEnum).default('task'),
  priority: TaskPriorityEnum.default('medium'),
  category: TaskCategoryEnum.default('general'),
  action: z.string().max(500).optional().default(''),
  dueDate: z.string().nullable().optional(),
  dueTime: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).default(0.85),
  confidenceScore: z.number().min(0).max(1).optional(),
  sourceType: TaskSourceEnum.default('gmail'),
  sources: z.array(z.string()).nullable().optional(),
  sourceId: z.string().nullable().optional(),
  secondarySourceId: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  actionRequired: z.boolean().default(true),
  responsibleParty: z.enum(['user', 'other', 'unassigned']).default('user').optional(),
  classification: z.enum(['action_required', 'opportunity_window', 'event_meeting', 'program_schedule', 'informational', 'ambiguous']).default('action_required').optional(),
  deadlineType: z.enum(['strict_deadline', 'application_window', 'event_time', 'program_duration', 'none']).default('none').optional(),
  nextStep: z.string().max(500).optional(),
  windowStartDate: z.string().nullable().optional(),
  windowEndDate: z.string().nullable().optional(),
  reasoning: z.string().optional()
});

export const ExtractedTasksListSchema = z.object({
  tasks: z.array(ExtractedTaskSchema),
  hasActionableContent: z.boolean(),
  summary: z.string().optional()
});

// Schema for manual task creation API endpoint
export const CreateTaskInputSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  type: z.preprocess(normalizeResponsibilityType, ResponsibilityTypeEnum).optional().default('task'),
  priority: TaskPriorityEnum.optional().default('medium'),
  status: TaskStatusEnum.optional(),
  category: TaskCategoryEnum.optional().default('general'),
  dueDate: z.string().datetime().optional(),
  source: TaskSourceEnum.optional().default('manual'),
  sourceId: z.string().optional(),
  confidence: z.number().min(0).max(1).optional().default(1.0),
  tags: z.array(z.string()).optional().default([]),
  metadata: z.record(z.unknown()).optional()
});

// Schema for task updates
export const UpdateTaskInputSchema = CreateTaskInputSchema.partial().extend({
  status: TaskStatusEnum.optional(),
  isArchived: z.boolean().optional()
});

export type ExtractedTask = z.infer<typeof ExtractedTaskSchema>;
export type ExtractedTasksList = z.infer<typeof ExtractedTasksListSchema>;
export type CreateTaskInput = z.infer<typeof CreateTaskInputSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskInputSchema>;
