import { 
  ReminderNotification, 
  ReminderSyncSummary, 
  formatClockTime, 
  formatDateDisplay 
} from '@lifesynch/shared';
import { isSupabaseConfigured, getSupabaseAdminClient } from '../config/supabase';
import { logger } from '../utils/logger';
import { taskService } from './task.service';
import { calculateDeadlineUrgency } from './ai/responsibility-matcher';

export interface CreateReminderInput {
  userId: string;
  responsibilityId?: string;
  title: string;
  message: string;
  type?: 'responsibility' | 'info' | 'warning' | 'alert';
  dueDate?: string;
  dueTime?: string;
}

export type ReminderTimingCondition = 'due_today' | 'due_tomorrow' | 'approaching';

export class ReminderService {
  // In-memory fallback for offline/development mode
  private inMemoryReminders: Map<string, ReminderNotification> = new Map();

  /**
   * Evaluates the smart reminder timing condition for an obligation:
   * - 'due_today': Due today (<= 24h or same calendar day)
   * - 'due_tomorrow': Due tomorrow (24h - 48h or next calendar day)
   * - 'approaching': Approaching deadline (within 2-3 calendar days or 48h-72h)
   * - null: If no deadline, distant deadline (>3 days away), overdue, or obsolete.
   * Ensures reminders are created only at useful, high-value timing points without continuous spam.
   */
  public getReminderTimingCondition(
    dueDate?: string | null,
    dueTime?: string | null,
    now?: Date
  ): ReminderTimingCondition | null {
    if (!dueDate) return null;

    const urgency = calculateDeadlineUrgency(dueDate, dueTime, now);
    if (!urgency.hasDeadline) return null;

    // Do not remind for obsolete or past deadlines
    if (urgency.isOverdue || (urgency.dayDiff !== null && urgency.dayDiff < 0)) {
      return null;
    }

    // 1. Due Today (same calendar day or within 24h of today)
    if (urgency.dayDiff === 0 || (urgency.dayDiff === null && urgency.isDueToday)) {
      return 'due_today';
    }

    // 2. Due Tomorrow (next calendar day)
    if (urgency.dayDiff === 1 || (urgency.dayDiff === null && urgency.isDueTomorrow)) {
      return 'due_tomorrow';
    }

    // 3. Approaching Deadline (2 to 3 days away)
    if (
      (urgency.dayDiff !== null && urgency.dayDiff >= 2 && urgency.dayDiff <= 3) ||
      (urgency.diffHours !== null && urgency.diffHours > 48 && urgency.diffHours <= 72)
    ) {
      return 'approaching';
    }

    // Distant obligations (>3 days away): Do not generate reminders continuously
    return null;
  }

  /**
   * Formats a clear deadline reminder message reflecting real date/time and timing condition.
   * Examples:
   * - "Project Report is due today at 5:00 PM."
   * - "Project Report is due tomorrow."
   * - "Project Report deadline is approaching on September 29 at 5:00 PM."
   */
  public formatReminderMessage(
    title: string,
    dueDate?: string | null,
    dueTime?: string | null,
    now?: Date,
    condition?: ReminderTimingCondition
  ): string | null {
    if (!dueDate) return null;

    const timing = condition || this.getReminderTimingCondition(dueDate, dueTime, now);
    if (!timing) return null;

    const formattedTime = dueTime ? formatClockTime(dueTime) : null;
    const formattedDate = formatDateDisplay(dueDate);

    if (timing === 'due_today') {
      return formattedTime 
        ? `${title} is due today at ${formattedTime}.`
        : `${title} is due today.`;
    }

    if (timing === 'due_tomorrow') {
      return formattedTime 
        ? `${title} is due tomorrow at ${formattedTime}.`
        : `${title} is due tomorrow.`;
    }

    if (timing === 'approaching') {
      return formattedTime 
        ? `${title} deadline is approaching on ${formattedDate} at ${formattedTime}.`
        : `${title} deadline is approaching on ${formattedDate}.`;
    }

    return null;
  }

  /**
   * Generates smart deadline reminders for active responsibilities at useful points.
   * Guarantees:
   * - Supported timing points: 'due_today', 'due_tomorrow', 'approaching'
   * - Completed, cancelled, and obsolete responsibilities strictly excluded
   * - No notification spam: repeated automatic syncs never create duplicate reminders
   * - A reminder is created only when that reminder condition has not already been notified
   * - Strictly user-isolated
   */
  public async generateRemindersForUser(userId: string, now?: Date): Promise<ReminderSyncSummary> {
    logger.info(`Generating smart deadline reminders for user: ${userId}`);

    // 1. Fetch active tasks for user (getTasks strictly excludes completed/cancelled)
    const activeTasks = await taskService.getTasks(userId);

    // 2. Fetch existing reminders for user to prevent duplicate creation
    const existingReminders = await this.getRemindersForUser(userId);

    let generated = 0;
    let skipped = 0;

    for (const task of activeTasks) {
      // Rule 1: Exclude completed responsibilities
      if (
        task.status === 'COMPLETED' || 
        task.status === 'completed' || 
        (task.metadata as any)?.lifecycleStatus === 'COMPLETED'
      ) {
        continue;
      }

      // Rule 2: Exclude cancelled responsibilities
      if (
        task.status === 'CANCELLED' || 
        task.status === 'cancelled' || 
        task.status === 'dismissed' || 
        task.isArchived || 
        (task.metadata as any)?.lifecycleStatus === 'CANCELLED'
      ) {
        continue;
      }

      // Rule 3: Exclude responsibilities without a known deadline
      if (!task.dueDate) {
        continue;
      }

      // Rule 4: Exclude obsolete responsibilities (past deadlines, overdue without updates)
      const urgency = calculateDeadlineUrgency(task.dueDate, task.dueTime, now);
      if (urgency.isOverdue || (urgency.dayDiff !== null && urgency.dayDiff < 0)) {
        continue;
      }

      // Rule 5: Smart timing check - only trigger at useful points (due_today, due_tomorrow, approaching)
      const timingCondition = this.getReminderTimingCondition(task.dueDate, task.dueTime, now);
      if (!timingCondition) {
        // Distant deadlines (>3 days) or non-timing items are not generated continuously
        continue;
      }

      const reminderMessage = this.formatReminderMessage(task.title, task.dueDate, task.dueTime, now, timingCondition);
      if (!reminderMessage) {
        continue;
      }

      const reminderTitle = `Reminder: ${task.title}`;

      // Rule 6: No Notification Spam Check
      // A reminder should be created ONLY when that reminder condition has not already been notified.
      const alreadyNotified = existingReminders.some(r => {
        const isSameTask = 
          r.responsibilityId === task.id ||
          r.title === reminderTitle ||
          r.title === task.title ||
          r.title.toLowerCase().trim() === task.title.toLowerCase().trim() ||
          r.title.toLowerCase().includes(task.title.toLowerCase().trim()) ||
          r.message.toLowerCase().includes(task.title.toLowerCase().trim());

        if (!isSameTask) return false;

        // Check if THIS specific condition was already notified
        const msgLow = r.message.toLowerCase();
        if (timingCondition === 'due_today') {
          return msgLow.includes('due today');
        }
        if (timingCondition === 'due_tomorrow') {
          return msgLow.includes('due tomorrow');
        }
        if (timingCondition === 'approaching') {
          return msgLow.includes('approaching');
        }
        return r.message === reminderMessage;
      });

      // Also check task metadata for remindedConditions
      const remindedConditions: string[] = (task.metadata as any)?.remindedConditions || [];
      const alreadyNotifiedInMetadata = remindedConditions.includes(timingCondition);

      if (alreadyNotified || alreadyNotifiedInMetadata) {
        skipped++;
        continue;
      }

      // Create reminder
      await this.createReminder({
        userId,
        responsibilityId: task.id,
        title: reminderTitle,
        message: reminderMessage,
        type: 'responsibility',
        dueDate: task.dueDate,
        dueTime: task.dueTime
      });

      // Record this reminder condition in task metadata
      const updatedConditions = Array.from(new Set([...remindedConditions, timingCondition]));
      if (isSupabaseConfigured()) {
        const supabase = getSupabaseAdminClient();
        Promise.resolve(
          supabase
            .from('responsibilities')
            .update({
              metadata: {
                ...(task.metadata || {}),
                remindedConditions: updatedConditions,
                lastRemindedAt: new Date().toISOString()
              }
            })
            .eq('id', task.id)
        ).catch(err => logger.warn(`Failed to update reminder metadata for task ${task.id}:`, err));
      }
      task.metadata = {
        ...(task.metadata || {}),
        remindedConditions: updatedConditions,
        lastRemindedAt: new Date().toISOString()
      };

      generated++;
    }

    const totalReminders = (await this.getRemindersForUser(userId)).length;
    logger.info(`Smart reminder generation for user ${userId} complete: generated ${generated}, skipped ${skipped}, total ${totalReminders}`);

    return {
      generated,
      skipped,
      totalReminders
    };
  }

  /**
   * Retrieves all reminders for a specific user, strictly user-isolated.
   */
  public async getRemindersForUser(userId: string): Promise<ReminderNotification[]> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'responsibility')
        .order('created_at', { ascending: false });

      if (error) {
        logger.error(`Error querying notifications for user ${userId}:`, error.message);
        throw error;
      }

      // Rule: Completed and cancelled responsibilities must not show active reminders
      const { data: allTasks } = await supabase
        .from('responsibilities')
        .select('id, title, status, is_archived')
        .eq('user_id', userId);

      const inactiveTitles = (allTasks || [])
        .filter(t => 
          t.status === 'completed' || 
          t.status === 'COMPLETED' || 
          t.status === 'dismissed' || 
          t.status === 'CANCELLED' || 
          t.status === 'cancelled' || 
          Boolean(t.is_archived)
        )
        .map(t => t.title.toLowerCase().trim())
        .filter(Boolean);

      const reminders = (data || []).map(record => this.mapRecordToReminder(record));

      if (inactiveTitles.length === 0) {
        return reminders;
      }

      return reminders.filter(r => {
        const cleanTitle = r.title.replace(/^Reminder:\s*/i, '').toLowerCase().trim();
        return !inactiveTitles.some(inact => inact === cleanTitle || r.message.toLowerCase().includes(inact));
      });
    }

    // In-memory fallback
    const allMemReminders = Array.from(this.inMemoryReminders.values())
      .filter(r => r.userId === userId && r.type === 'responsibility')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const activeTasks = await taskService.getTasks(userId);
    const activeTitles = new Set(activeTasks.map(t => t.title.toLowerCase().trim()));
    const activeIds = new Set(activeTasks.map(t => t.id));

    if (activeTasks.length > 0) {
      return allMemReminders.filter(r => {
        if (r.responsibilityId && !activeIds.has(r.responsibilityId)) {
          return false;
        }
        const cleanTitle = r.title.replace(/^Reminder:\s*/i, '').toLowerCase().trim();
        return activeTitles.has(cleanTitle) || activeTasks.some(at => r.message.toLowerCase().includes(at.title.toLowerCase().trim()));
      });
    }

    return allMemReminders;
  }

  /**
   * Creates a single reminder notification.
   */
  public async createReminder(input: CreateReminderInput): Promise<ReminderNotification> {
    const id = `rem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const nowIso = new Date().toISOString();

    const reminder: ReminderNotification = {
      id,
      userId: input.userId,
      responsibilityId: input.responsibilityId,
      title: input.title,
      message: input.message,
      type: input.type || 'responsibility',
      isRead: false,
      dueDate: input.dueDate,
      dueTime: input.dueTime,
      createdAt: nowIso
    };

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      // Insert into existing notifications table (fields: user_id, title, message, type, is_read, created_at)
      const payload: Record<string, unknown> = {
        user_id: input.userId,
        title: input.title,
        message: input.message,
        type: input.type || 'responsibility',
        is_read: false,
        created_at: nowIso
      };

      const { data, error } = await supabase
        .from('notifications')
        .insert(payload)
        .select()
        .single();

      if (error) {
        logger.error(`Error creating notification in Supabase:`, error.message);
        throw error;
      }

      return this.mapRecordToReminder(data, input.responsibilityId, input.dueDate, input.dueTime);
    }

    this.inMemoryReminders.set(id, reminder);
    return reminder;
  }

  /**
   * Marks a reminder as read, strictly user-isolated.
   */
  public async markAsRead(id: string, userId: string): Promise<void> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        logger.error(`Error marking notification ${id} as read:`, error.message);
        throw error;
      }
      return;
    }

    const mem = this.inMemoryReminders.get(id);
    if (mem && mem.userId === userId) {
      mem.isRead = true;
    }
  }

  private mapRecordToReminder(
    record: any, 
    responsibilityId?: string, 
    dueDate?: string, 
    dueTime?: string
  ): ReminderNotification {
    return {
      id: record.id,
      userId: record.user_id,
      responsibilityId: responsibilityId || record.responsibility_id,
      title: record.title,
      message: record.message,
      type: record.type,
      isRead: record.is_read,
      dueDate,
      dueTime,
      createdAt: record.created_at
    };
  }
}

export const reminderService = new ReminderService();
