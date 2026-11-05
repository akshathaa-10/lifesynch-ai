import { 
  ApiResponse, 
  HealthCheckData, 
  Responsibility, 
  ResponsibilitySyncSummary,
  User, 
  EmailRecord, 
  GmailSyncSummary, 
  CalendarEventRecord, 
  CalendarSyncSummary,
  ReminderNotification,
  ReminderSyncSummary,
  ChatMessage,
  AskAssistantResponse
} from '@lifesynch/shared';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export class ApiError extends Error {
  public code?: string;
  public details?: unknown;
  public statusCode: number;
  public isAuthError: boolean;
  public isNetworkError: boolean;

  constructor(message: string, statusCode: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isAuthError = statusCode === 401 || statusCode === 403;
    this.isNetworkError = statusCode === 0;
  }
}

// Token storage key
export const AUTH_TOKEN_KEY = 'lifesynch_auth_token';

export const getStoredToken = (): string | null => {
  return localStorage.getItem(AUTH_TOKEN_KEY);
};

export const setStoredToken = (token: string): void => {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
};

export const removeStoredToken = (): void => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
};

/**
 * Translates any caught error into a safe, user-friendly message.
 * Raw stack traces, SQL errors, API internals, and tokens are NEVER shown.
 */
export function getFriendlyError(err: unknown, context: 'gmail' | 'calendar' | 'ai' | 'auth' | 'general' = 'general'): string {
  if (err instanceof ApiError) {
    // Auth / session expiry
    if (err.isAuthError) {
      return 'Your Google session has expired. Please sign in again.';
    }
    // Network unreachable
    if (err.isNetworkError) {
      return 'Could not reach the server. Please check your connection and try again.';
    }
    // Server returned a user-facing message — use it directly (already sanitized by backend)
    if (err.message && err.message.length < 250 && !err.message.includes('\n') && !err.message.includes('Error:')) {
      return err.message;
    }
  }

  // Network error (fetch failed entirely)
  if (err instanceof TypeError && (err.message.includes('fetch') || err.message.includes('network') || err.message.includes('Failed to fetch'))) {
    return 'Could not reach the server. Please check your connection and try again.';
  }

  // Fallback by context
  switch (context) {
    case 'gmail':
      return "Gmail couldn't be updated right now. Your existing emails are still available.";
    case 'calendar':
      return "Calendar couldn't be updated right now. Your existing events are still available.";
    case 'ai':
      return "We couldn't generate responsibilities right now. Your existing responsibilities are still available.";
    case 'auth':
      return 'Your Google session has expired. Please sign in again.';
    default:
      return 'Something went wrong. Please try again later.';
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Automatically attach Bearer token if available
  const token = getStoredToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (networkErr) {
    // fetch() threw — the server is unreachable or the network is down
    throw new ApiError(
      'Could not reach the server. Please check your connection.',
      0,
      'NETWORK_ERROR'
    );
  }

  const data: ApiResponse<T> = await response.json().catch(() => ({
    success: false,
    message: `Unexpected response from server (${response.status})`,
    timestamp: new Date().toISOString()
  }));

  if (!response.ok || !data.success) {
    throw new ApiError(
      data.error?.message || data.message || 'An unexpected error occurred',
      response.status,
      data.error?.code,
      undefined // never pass raw details to callers
    );
  }

  return data;
}

export const apiClient = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),

  // System & Health
  getHealth: () => request<HealthCheckData>('/api/v1/health'),

  // Authentication
  getGoogleAuthUrl: () => request<{ authUrl: string }>('/api/v1/auth/google'),
  getCurrentUser: () => request<User>('/api/v1/auth/me'),
  logout: () => request<void>('/api/v1/auth/logout', { method: 'POST' }),

  // Responsibilities (Tasks)
  getTasks: () => request<Responsibility[]>('/api/v1/sync/responsibilities'),
  generateResponsibilities: () => request<ResponsibilitySyncSummary>('/api/v1/sync/responsibilities', { method: 'POST' }),
  updateTask: (id: string, data: Partial<Responsibility>) => request<Responsibility>(`/api/v1/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTask: (id: string) => request<void>(`/api/v1/tasks/${id}`, { method: 'DELETE' }),

  // Sync & Digital Sources
  getSyncStatus: () => request<{ 
    gmail: { lastSyncedAt: string | null; status: string; errorMessage: string | null }; 
    calendar: { lastSyncedAt: string | null; status: string; errorMessage: string | null };
  }>('/api/v1/sync/status'),
  syncGmail: () => request<GmailSyncSummary>('/api/v1/sync/gmail', { method: 'POST' }),
  getEmails: (limit = 50) => request<EmailRecord[]>(`/api/v1/sync/emails?limit=${limit}`),
  getSpamEmails: (limit = 100) => request<EmailRecord[]>(`/api/v1/sync/spam?limit=${limit}`),
  syncCalendar: () => request<CalendarSyncSummary>('/api/v1/sync/calendar', { method: 'POST' }),
  getCalendarEvents: (limit = 50) => request<CalendarEventRecord[]>(`/api/v1/sync/calendar-events?limit=${limit}`),

  // Reminders & Notifications
  getReminders: () => request<ReminderNotification[]>('/api/v1/reminders'),
  generateReminders: () => request<ReminderSyncSummary>('/api/v1/reminders/generate', { method: 'POST' }),
  markReminderAsRead: (id: string) => request<void>(`/api/v1/reminders/${id}/read`, { method: 'PATCH' }),
  markAllRemindersAsRead: () => request<void>('/api/v1/reminders/read-all', { method: 'PATCH' }),

  // Conversational Assistant
  askAssistant: (question: string, history?: ChatMessage[], timezone?: string) =>
    request<AskAssistantResponse>('/api/v1/assistant/ask', {
      method: 'POST',
      body: JSON.stringify({
        question,
        history,
        timezone: timezone || (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined)
      })
    })
};

