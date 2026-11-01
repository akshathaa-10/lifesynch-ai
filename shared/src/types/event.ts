export interface CalendarEvent {
  id: string;
  userId?: string;
  eventId?: string;
  calendarId?: string;
  summary: string;
  description?: string;
  start: string; // ISO 8601
  end: string;   // ISO 8601
  startTime?: string;
  endTime?: string;
  location?: string;
  htmlLink?: string;
  status?: string;
  attendees?: Array<{
    email?: string;
    displayName?: string;
    responseStatus?: string;
  }>;
  createdAt?: string;
  updatedAt?: string;
}

export interface CalendarEventRecord {
  id: string;
  userId: string;
  eventId: string;
  calendarId: string;
  summary: string;
  description?: string;
  startTime: string; // ISO 8601
  endTime: string;   // ISO 8601
  location?: string;
  htmlLink?: string;
  status: string;    // 'confirmed' | 'tentative' | 'cancelled'
  attendees?: Array<{
    email?: string;
    displayName?: string;
    responseStatus?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export type SyncProvider = 'gmail' | 'google_calendar';

export type SyncStatus = 'idle' | 'running' | 'success' | 'failed';

export interface SyncLog {
  id: string;
  userId: string;
  provider: SyncProvider;
  status: SyncStatus;
  itemsProcessed: number;
  itemsCreated: number;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
}

export interface CalendarSyncSummary {
  fetched: number;
  inserted: number;
  updated: number;
  cancelled: number;
  skipped: number;
}
