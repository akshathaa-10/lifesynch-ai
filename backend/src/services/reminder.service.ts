import { 
  ReminderNotification, 
  ReminderSyncSummary, 
  formatClockTime, 
  formatDateDisplay 
} from '@lifesynch/shared';
import { isSupabaseConfigured, getSupabaseAdminClient } from '../config/supabase';
import { logger } from '../utils/logger';
import { taskService } from './task.service';

export interface CreateReminderInput {
  userId: string;
  responsibilityId?: string;
  title: string;
  message: string;
  type?: 'responsibility' | 'info' | 'warning' | 'alert';
  dueDate?: string;
  dueTime?: string;
  category?: 'deadline' | 'email' | 'calendar' | 'system';
  targetId?: string;
}

export type ReminderTimingCondition = 'due_now' | 'due_today' | 'due_tomorrow' | 'approaching';

export class ReminderService {
  // In-memory fallback for offline/development mode
  private inMemoryReminders: Map<string, ReminderNotification> = new Map();

  /**
   * Resolves the exact wall-clock timestamp of a deadline taking into account
   * ISO strings, date-only strings ("YYYY-MM-DD"), and optional clock times ("HH:MM").
   * Respects local timezone semantics.
   */
  public resolveDeadlineTimestamp(dueDate?: string | null, dueTime?: string | null): number | null {
    if (!dueDate) return null;

    try {
      const match = dueDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (!match) {
        const d = new Date(dueDate);
        return isNaN(d.getTime()) ? null : d.getTime();
      }

      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);

      let hours = 23;
      let minutes = 59;
      let seconds = 59;

      if (dueTime && /^\d{1,2}:\d{2}$/.test(dueTime.trim())) {
        const [hh, mm] = dueTime.trim().split(':').map(Number);
        hours = hh;
        minutes = mm;
        seconds = 0;
      } else if (dueDate.includes('T')) {
        const parsedIso = new Date(dueDate);
        if (!isNaN(parsedIso.getTime()) && (parsedIso.getHours() !== 0 || parsedIso.getMinutes() !== 0)) {
          return parsedIso.getTime();
        }
      }

      const d = new Date(year, month, day, hours, minutes, seconds, 0);
      return d.getTime();
    } catch {
      return null;
    }
  }

  private isSameCalendarDay(msA: number, msB: number): boolean {
    const dA = new Date(msA);
    const dB = new Date(msB);
    return dA.getFullYear() === dB.getFullYear() &&
           dA.getMonth() === dB.getMonth() &&
           dA.getDate() === dB.getDate();
  }

  private isNextCalendarDay(targetMs: number, nowMs: number): boolean {
    const dTarget = new Date(targetMs);
    const dTomorrow = new Date(nowMs);
    dTomorrow.setDate(dTomorrow.getDate() + 1);
    return dTarget.getFullYear() === dTomorrow.getFullYear() &&
           dTarget.getMonth() === dTomorrow.getMonth() &&
           dTarget.getDate() === dTomorrow.getDate();
  }

  /**
   * Evaluates the smart reminder timing condition for an obligation.
   * STRICT RULES:
   * 1. Only generate deadline notifications for future upcoming deadlines.
   * 2. Do not generate notifications for deadlines that have already passed (returns null).
   * 3. Do not generate overdue notifications for older responsibilities.
   * 4. If a deadline is today, notify at the appropriate upcoming reminder time ('due_today')
   *    and when the actual deadline arrives ('due_now').
   * 5. Once a deadline has passed, stop sending further reminders for it (returns null).
   */
  public getReminderTimingCondition(
    dueDate?: string | null,
    dueTime?: string | null,
    now?: Date
  ): ReminderTimingCondition | null {
    if (!dueDate) return null;

    const deadlineMs = this.resolveDeadlineTimestamp(dueDate, dueTime);
    if (!deadlineMs) return null;

    const refNowMs = (now ? new Date(now) : new Date()).getTime();

    // RULE 1, 2, 3, 5: If deadline has already passed, NEVER generate any notification
    if (deadlineMs < refNowMs) {
      return null;
    }

    const diffMs = deadlineMs - refNowMs;
    const diffHours = diffMs / (1000 * 60 * 60);

    // Rule 4: Deadline arrives right now (within 1 hour)
    if (diffHours >= 0 && diffHours <= 1) {
      return 'due_now';
    }

    // Rule 4: Deadline is today
    const isToday = this.isSameCalendarDay(deadlineMs, refNowMs);
    if (isToday) {
      return 'due_today';
    }

    // Deadline is tomorrow (next calendar day or within 24-36 hours)
    const isTomorrow = this.isNextCalendarDay(deadlineMs, refNowMs);
    if (isTomorrow || (diffHours > 0 && diffHours <= 36)) {
      return 'due_tomorrow';
    }

    // Approaching deadline (within 2 to 3 days away: 36h - 72h)
    if (diffHours > 36 && diffHours <= 72) {
      return 'approaching';
    }

    // Distant obligations (>3 days away): no continuous reminders
    return null;
  }

  /**
   * Formats a clear deadline reminder message reflecting real date/time and timing condition.
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

    if (timing === 'due_now') {
      return formattedTime 
        ? `${title} deadline is arriving now at ${formattedTime}.`
        : `${title} deadline is arriving now today.`;
    }

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
   * Cleans up expired and overdue notifications from persistent storage
   * so they never linger as active notifications.
   */
  public async cleanupExpiredNotifications(userId: string): Promise<void> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      try {
        // Delete any notifications with title starting with 'Overdue:'
        await supabase
          .from('notifications')
          .delete()
          .eq('user_id', userId)
          .ilike('title', 'Overdue:%');
      } catch (err: any) {
        logger.warn(`Failed to cleanup overdue notifications for user ${userId}:`, err?.message || err);
      }
    }

    // Clean in-memory cache
    const nowMs = Date.now();
    for (const [id, rem] of this.inMemoryReminders.entries()) {
      if (rem.userId === userId) {
        if (rem.title.startsWith('Overdue:')) {
          this.inMemoryReminders.delete(id);
        } else if (rem.dueDate) {
          const dMs = this.resolveDeadlineTimestamp(rem.dueDate, rem.dueTime);
          if (dMs && dMs < nowMs) {
            this.inMemoryReminders.delete(id);
          }
        }
      }
    }
  }

  /**
   * Generates smart deadline reminders for active responsibilities at useful points.
   * Strictly filters out past/overdue deadlines.
   */
  public async generateRemindersForUser(userId: string, now?: Date): Promise<ReminderSyncSummary> {
    logger.info(`Generating smart deadline reminders for user: ${userId}`);

    // Clean up any previously stored overdue notifications
    await this.cleanupExpiredNotifications(userId);

    const activeTasks = await taskService.getTasks(userId);
    const existingReminders = await this.getRemindersForUser(userId);
    const refNow = now ? new Date(now) : new Date();

    let generated = 0;
    let skipped = 0;

    for (const task of activeTasks) {
      // Rule: Exclude completed or cancelled responsibilities
      if (
        task.status === 'COMPLETED' || 
        task.status === 'completed' || 
        task.status === 'CANCELLED' || 
        task.status === 'cancelled' || 
        task.status === 'dismissed' || 
        task.isArchived
      ) {
        continue;
      }

      // Rule: Must have a known deadline
      if (!task.dueDate) {
        continue;
      }

      // STRICT RULE: If the deadline is already in the past, DO NOT NOTIFY
      const deadlineMs = this.resolveDeadlineTimestamp(task.dueDate, task.dueTime);
      if (!deadlineMs || deadlineMs < refNow.getTime()) {
        continue;
      }

      const timingCondition = this.getReminderTimingCondition(task.dueDate, task.dueTime, refNow);
      if (!timingCondition) {
        continue;
      }

      const reminderMessage = this.formatReminderMessage(task.title, task.dueDate, task.dueTime, refNow, timingCondition);
      if (!reminderMessage) {
        continue;
      }

      const reminderTitle = timingCondition === 'due_now' 
        ? `Urgent: ${task.title}` 
        : `Reminder: ${task.title}`;

      // Prevent duplicate notifications for the same condition
      const remindedConditions: string[] = (task.metadata as any)?.remindedConditions || [];
      const alreadyNotifiedInMetadata = remindedConditions.includes(timingCondition);

      const alreadyNotifiedInDB = existingReminders.some(r => {
        if (r.responsibilityId === task.id || r.title === reminderTitle || r.message === reminderMessage) {
          const msgLow = r.message.toLowerCase();
          if (timingCondition === 'due_now') return msgLow.includes('arriving now');
          if (timingCondition === 'due_today') return msgLow.includes('due today');
          if (timingCondition === 'due_tomorrow') return msgLow.includes('due tomorrow');
          if (timingCondition === 'approaching') return msgLow.includes('approaching');
          return true;
        }
        return false;
      });

      if (alreadyNotifiedInMetadata || alreadyNotifiedInDB) {
        skipped++;
        continue;
      }

      // Create reminder
      await this.createReminder({
        userId,
        responsibilityId: task.id,
        title: reminderTitle,
        message: reminderMessage,
        type: timingCondition === 'due_now' ? 'alert' : 'responsibility',
        dueDate: task.dueDate,
        dueTime: task.dueTime,
        category: 'deadline',
        targetId: task.id
      });

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
   * Notifies users of calendar event additions, rescheduling, or cancellations.
   * Strictly filters out past calendar events.
   */
  public async notifyCalendarEventChange(
    userId: string,
    event: {
      eventId: string;
      summary: string;
      startTime: string;
      changeType: 'new' | 'rescheduled' | 'cancelled';
      oldStartTime?: string;
    }
  ): Promise<ReminderNotification | null> {
    const eventTimeMs = new Date(event.startTime).getTime();
    const nowMs = Date.now();

    // STRICT RULE: Do not notify for past events (unless it's an explicit cancellation)
    if (event.changeType !== 'cancelled' && !isNaN(eventTimeMs) && eventTimeMs < nowMs) {
      return null;
    }

    const existing = await this.getRemindersForUser(userId);
    const dateFormatted = formatDateDisplay(event.startTime);

    let title = '';
    let message = '';
    let type: 'info' | 'warning' | 'alert' | 'responsibility' = 'info';

    if (event.changeType === 'new') {
      title = `New Event: ${event.summary}`;
      message = `Scheduled on your calendar for ${dateFormatted}.`;
      type = 'info';
    } else if (event.changeType === 'rescheduled') {
      title = `Event Rescheduled: ${event.summary}`;
      message = `Updated to ${dateFormatted}.`;
      type = 'warning';
    } else if (event.changeType === 'cancelled') {
      title = `Event Cancelled: ${event.summary}`;
      message = `The scheduled event "${event.summary}" has been cancelled.`;
      type = 'warning';
    }

    // Deduplication check
    const alreadyExists = existing.some(r => 
      (r.targetId === event.eventId || r.title === title) &&
      nowMs - new Date(r.createdAt).getTime() < 24 * 60 * 60 * 1000
    );

    if (alreadyExists) {
      return null;
    }

    return this.createReminder({
      userId,
      title,
      message,
      type,
      category: 'calendar',
      targetId: event.eventId,
      dueDate: event.startTime
    });
  }

  /**
   * Notifies users when a new high-priority or actionable responsibility is extracted.
   * STRICT RULE: Never notifies for past deadlines.
   */
  public async notifyNewSignificantResponsibility(
    userId: string,
    task: {
      id: string;
      title: string;
      dueDate?: string;
      dueTime?: string;
      priority: string;
    }
  ): Promise<ReminderNotification | null> {
    const nowMs = Date.now();

    // STRICT RULE: Only notify for future upcoming deadlines
    if (task.dueDate) {
      const deadlineMs = this.resolveDeadlineTimestamp(task.dueDate, task.dueTime);
      if (deadlineMs && deadlineMs < nowMs) {
        logger.info(`Skipping notification for past obligation "${task.title}" (deadline was ${task.dueDate})`);
        return null;
      }
    }

    const existing = await this.getRemindersForUser(userId);
    const dateStr = task.dueDate ? ` (due ${formatDateDisplay(task.dueDate)})` : '';
    const title = `New Responsibility: ${task.title}`;
    const message = `Identified from your recent communications${dateStr}.`;

    const alreadyExists = existing.some(r => r.responsibilityId === task.id || r.title === title);
    if (alreadyExists) {
      return null;
    }

    return this.createReminder({
      userId,
      responsibilityId: task.id,
      title,
      message,
      type: task.priority === 'high' ? 'warning' : 'responsibility',
      category: 'deadline',
      targetId: task.id,
      dueDate: task.dueDate,
      dueTime: task.dueTime
    });
  }

  /**
   * Retrieves all notifications for a specific user, strictly user-isolated.
   * STRICTLY FILTERS OUT:
   * 1. Already-passed deadlines (expired deadlines)
   * 2. Any overdue notifications
   * 3. Reminders for completed or cancelled tasks
   */
  public async getRemindersForUser(userId: string): Promise<ReminderNotification[]> {
    const nowMs = Date.now();

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(60);

      if (error) {
        logger.error(`Error querying notifications for user ${userId}:`, error.message);
        throw error;
      }

      // Query tasks to check status and actual deadlines
      const { data: allTasks } = await supabase
        .from('responsibilities')
        .select('id, title, status, is_archived, due_date, due_time')
        .eq('user_id', userId);

      const tasksMap = new Map((allTasks || []).map((t: any) => [t.id, t]));
      const taskTitlesMap = new Map((allTasks || []).map((t: any) => [t.title.toLowerCase().trim(), t]));

      const inactiveTitles = new Set(
        (allTasks || [])
          .filter((t: any) => 
            t.status === 'completed' || 
            t.status === 'COMPLETED' || 
            t.status === 'dismissed' || 
            t.status === 'CANCELLED' || 
            t.status === 'cancelled' || 
            Boolean(t.is_archived)
          )
          .map((t: any) => t.title.toLowerCase().trim())
      );

      const rawReminders = (data || []).map(record => this.mapRecordToReminder(record));

      // Filter out past/expired deadlines, overdue notifications, and inactive tasks
      return rawReminders.filter(r => {
        // 1. Exclude any notification starting with "Overdue:"
        if (r.title.startsWith('Overdue:') || r.message.toLowerCase().includes('is now overdue')) {
          return false;
        }

        // 2. Check if notification has its own dueDate and if it has passed
        if (r.dueDate) {
          const deadlineMs = this.resolveDeadlineTimestamp(r.dueDate, r.dueTime);
          if (deadlineMs && deadlineMs < nowMs) {
            return false; // Deadline has already passed!
          }
        }

        // 3. For deadline/responsibility reminders, check the linked task
        if (r.type === 'responsibility' || r.category === 'deadline' || r.title.startsWith('Reminder:')) {
          const cleanTitle = r.title.replace(/^(Reminder|Urgent|New Responsibility):\s*/i, '').toLowerCase().trim();

          // Exclude if task is completed, cancelled, or archived
          if (inactiveTitles.has(cleanTitle)) {
            return false;
          }

          // Match the task to inspect its deadline
          const matchedTask: any = (r.responsibilityId && tasksMap.get(r.responsibilityId)) || taskTitlesMap.get(cleanTitle);
          if (matchedTask) {
            if (
              matchedTask.status === 'completed' || 
              matchedTask.status === 'COMPLETED' || 
              matchedTask.status === 'CANCELLED' || 
              matchedTask.status === 'cancelled' || 
              Boolean(matchedTask.is_archived)
            ) {
              return false;
            }

            // Exclude if task's deadline has already passed
            if (matchedTask.due_date) {
              const taskDeadlineMs = this.resolveDeadlineTimestamp(matchedTask.due_date, matchedTask.due_time);
              if (taskDeadlineMs && taskDeadlineMs < nowMs) {
                return false; // Past deadline!
              }
            }
          }
        }

        // 4. For calendar notifications, check if the event start time has passed
        if (r.category === 'calendar' && !r.title.includes('Cancelled') && r.dueDate) {
          const calMs = new Date(r.dueDate).getTime();
          if (!isNaN(calMs) && calMs < nowMs) {
            return false; // Event already occurred
          }
        }

        return true;
      });
    }

    // In-memory fallback
    const allMemReminders = Array.from(this.inMemoryReminders.values())
      .filter(r => r.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return allMemReminders.filter(r => {
      if (r.title.startsWith('Overdue:') || r.message.toLowerCase().includes('is now overdue')) {
        return false;
      }
      if (r.dueDate) {
        const dMs = this.resolveDeadlineTimestamp(r.dueDate, r.dueTime);
        if (dMs && dMs < nowMs) {
          return false;
        }
      }
      return true;
    });
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
      category: input.category || (input.type === 'responsibility' ? 'deadline' : 'system'),
      targetId: input.targetId || input.responsibilityId,
      createdAt: nowIso
    };

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
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

      return this.mapRecordToReminder(
        data, 
        input.responsibilityId, 
        input.dueDate, 
        input.dueTime,
        input.category,
        input.targetId
      );
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

  /**
   * Marks all reminders as read for a user.
   */
  public async markAllAsRead(userId: string): Promise<void> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) {
        logger.error(`Error marking all notifications as read for user ${userId}:`, error.message);
        throw error;
      }
      return;
    }

    for (const rem of this.inMemoryReminders.values()) {
      if (rem.userId === userId) {
        rem.isRead = true;
      }
    }
  }

  private mapRecordToReminder(
    record: any, 
    responsibilityId?: string, 
    dueDate?: string, 
    dueTime?: string,
    category?: 'deadline' | 'email' | 'calendar' | 'system',
    targetId?: string
  ): ReminderNotification {
    const title = record.title || '';
    const message = record.message || '';

    let cat: 'deadline' | 'email' | 'calendar' | 'system' = category || 'system';
    if (!category) {
      if (title.toLowerCase().includes('calendar') || title.toLowerCase().includes('event:')) {
        cat = 'calendar';
      } else if (title.toLowerCase().includes('email') || message.toLowerCase().includes('email')) {
        cat = 'email';
      } else if (record.type === 'responsibility' || title.toLowerCase().includes('reminder')) {
        cat = 'deadline';
      }
    }

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
      category: cat,
      targetId: targetId || responsibilityId || record.responsibility_id,
      createdAt: record.created_at
    };
  }
}

export const reminderService = new ReminderService();
