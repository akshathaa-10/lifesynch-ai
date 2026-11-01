export type ResponsibilityType =
  | 'task'
  | 'deadline'
  | 'appointment'
  | 'reminder'
  | 'other';

export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';

export type TaskStatus =
  | 'UPCOMING'
  | 'DUE_TODAY'
  | 'OVERDUE'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'dismissed'
  | 'upcoming'
  | 'due_today'
  | 'overdue'
  | 'cancelled';

export type TaskCategory =
  | 'academic'
  | 'work'
  | 'personal'
  | 'finance'
  | 'meeting'
  | 'deadline'
  | 'general';

export type TaskSourceType = 'gmail' | 'calendar' | 'both' | 'manual' | 'extension';

export interface Responsibility {
  id: string;
  userId: string;
  title: string;
  description?: string;
  type: ResponsibilityType;
  priority: TaskPriority;
  status: TaskStatus;
  category: TaskCategory;
  dueDate?: string;
  dueTime?: string;
  action?: string;
  source: TaskSourceType;
  sources?: TaskSourceType[];
  sourceDisplay?: 'Gmail' | 'Calendar' | 'both';
  sourceId?: string | null;
  secondarySourceId?: string | null;
  sourceContext?: {
    sender?: string;
    subject?: string;
    snippet?: string;
    receivedAt?: string;
    calendarEventId?: string;
    location?: string;
    threadId?: string;
    attachments?: string[];
    responsibleParty?: 'user' | 'other' | 'unassigned';
    classification?: 'action_required' | 'opportunity_window' | 'event_meeting' | 'program_schedule' | 'informational' | 'ambiguous';
    deadlineType?: 'strict_deadline' | 'application_window' | 'event_time' | 'program_duration' | 'none';
    nextStep?: string;
    windowStartDate?: string;
    windowEndDate?: string;
    [key: string]: unknown;
  };
  confidence: number; // 0.0 to 1.0 from AI extraction
  confidenceScore?: number; // backward compatibility alias
  tags: string[];
  metadata?: Record<string, unknown>;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export function getSourceDisplay(task: { source?: TaskSourceType; sources?: TaskSourceType[] }): 'Gmail' | 'Calendar' | 'both' {
  const isBoth = task.source === 'both' || (task.sources && task.sources.includes('gmail') && task.sources.includes('calendar'));
  if (isBoth) return 'both';
  if (task.source === 'calendar' || (task.sources && task.sources.includes('calendar') && !task.sources.includes('gmail'))) {
    return 'Calendar';
  }
  return 'Gmail';
}

// Alias for Task
export type Task = Responsibility;

export interface ResponsibilitySyncSummary {
  generated: number;
  updated: number;
  skipped: number;
  totalResponsibilities: number;
}

export interface CreateTaskDTO {
  title: string;
  description?: string;
  type?: ResponsibilityType;
  priority?: TaskPriority;
  status?: TaskStatus;
  category?: TaskCategory;
  dueDate?: string;
  dueTime?: string;
  action?: string;
  source?: TaskSourceType;
  sources?: TaskSourceType[];
  sourceId?: string | null;
  secondarySourceId?: string | null;
  sourceContext?: Responsibility['sourceContext'];
  confidence?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export type CreateResponsibilityDTO = CreateTaskDTO;

export interface UpdateTaskDTO extends Partial<CreateTaskDTO> {
  status?: TaskStatus;
  isArchived?: boolean;
}

export type UpdateResponsibilityDTO = UpdateTaskDTO;
