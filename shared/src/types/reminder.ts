export type NotificationType = 'info' | 'warning' | 'alert' | 'responsibility';

export interface ReminderNotification {
  id: string;
  userId: string;
  responsibilityId?: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  dueDate?: string;
  dueTime?: string;
  createdAt: string;
}

// Alias for convenience
export type Reminder = ReminderNotification;

export interface ReminderSyncSummary {
  generated: number;
  skipped: number;
  totalReminders: number;
}

/**
 * Formats a 24-hour time string ("17:00") into a user-friendly 12-hour AM/PM string ("5:00 PM").
 */
export function formatClockTime(timeStr?: string | null): string {
  if (!timeStr) return '';
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1].padStart(2, '0');
  if (isNaN(hours)) return timeStr;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
}

/**
 * Formats an ISO date string into a user-friendly month and day string ("September 30").
 */
export function formatDateDisplay(isoDate?: string | null): string {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  });
}
