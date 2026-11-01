import { google, calendar_v3 } from 'googleapis';
import { CalendarSyncSummary, CalendarEventRecord } from '@lifesynch/shared';
import { googleOAuthService } from './oauth.service';
import { accountService } from '../db/account.service';
import { calendarEventService, NormalizedCalendarEventInput } from '../db/calendar-event.service';
import { syncStateService } from '../db/sync-state.service';
import { AppError } from '../../middlewares/error.middleware';
import { logger } from '../../utils/logger';

export class CalendarService {
  /**
   * Normalizes a Google Calendar event item into structured database input.
   * Accurately handles both timed events (dateTime) and all-day events (date).
   */
  public parseCalendarEvent(
    item: calendar_v3.Schema$Event,
    calendarId = 'primary'
  ): NormalizedCalendarEventInput {
    // Parse Start Time
    let startTime: string;
    if (item.start?.dateTime) {
      startTime = new Date(item.start.dateTime).toISOString();
    } else if (item.start?.date) {
      startTime = new Date(`${item.start.date}T00:00:00.000Z`).toISOString();
    } else {
      startTime = new Date().toISOString();
    }

    // Parse End Time
    let endTime: string;
    if (item.end?.dateTime) {
      endTime = new Date(item.end.dateTime).toISOString();
    } else if (item.end?.date) {
      endTime = new Date(`${item.end.date}T23:59:59.999Z`).toISOString();
    } else {
      endTime = startTime;
    }

    const attendees = (item.attendees || []).map((att) => ({
      email: att.email || undefined,
      displayName: att.displayName || undefined,
      responseStatus: att.responseStatus || undefined
    }));

    return {
      eventId: item.id || `cal_evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      calendarId,
      summary: item.summary || '(No Title)',
      description: item.description || undefined,
      startTime,
      endTime,
      location: item.location || undefined,
      htmlLink: item.htmlLink || undefined,
      status: item.status || 'confirmed',
      attendees
    };
  }

  /**
   * Retrieves authenticated OAuth2 client with auto-refresh configured for the given user.
   */
  public async getAuthenticatedOAuthClient(userId: string) {
    const account = await accountService.getAccount(userId, 'google');
    if (!account) {
      throw new AppError(
        'No connected Google account found. Please sign in with Google to connect your account.',
        400,
        'GOOGLE_ACCOUNT_NOT_CONNECTED'
      );
    }

    if (!account.access_token) {
      throw new AppError(
        'Google OAuth access token missing. Please sign in again with Google.',
        401,
        'GOOGLE_ACCESS_TOKEN_MISSING'
      );
    }

    const oauthClient = googleOAuthService.getClient({
      access_token: account.access_token,
      refresh_token: account.refresh_token || undefined
    });

    // Automatically persist refreshed tokens when Google issues new ones
    oauthClient.on('tokens', async (tokens) => {
      try {
        logger.info(`Received refreshed Google Calendar tokens for user ${userId}`);
        await accountService.updateTokens(userId, 'google', {
          accessToken: tokens.access_token || undefined,
          refreshToken: tokens.refresh_token || undefined,
          tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined
        });
      } catch (err) {
        logger.error(`Error updating refreshed tokens for user ${userId}:`, err);
      }
    });

    // Proactively check and refresh token if expired
    const isExpired = account.token_expiry && new Date(account.token_expiry).getTime() <= Date.now() + 60000;
    if (isExpired && account.refresh_token) {
      try {
        logger.info(`Access token expired or expiring soon for user ${userId}. Refreshing for Calendar...`);
        const { credentials } = await oauthClient.refreshAccessToken();
        oauthClient.setCredentials(credentials);
        await accountService.updateTokens(userId, 'google', {
          accessToken: credentials.access_token || undefined,
          refreshToken: credentials.refresh_token || undefined,
          tokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined
        });
      } catch (refreshErr) {
        logger.error(`Failed to refresh Google token for user ${userId}:`, refreshErr);
        throw new AppError(
          'Google OAuth authorization has expired or was revoked. Please reconnect your Google account.',
          401,
          'GOOGLE_AUTH_EXPIRED'
        );
      }
    }

    return oauthClient;
  }

  /**
   * Synchronizes real Google Calendar events for the authenticated user and stores them in Supabase.
   */
  public async syncUserCalendar(userId: string): Promise<CalendarSyncSummary> {
    logger.info(`Initiating real Google Calendar synchronization for user: ${userId}`);

    const authClient = await this.getAuthenticatedOAuthClient(userId);

    await syncStateService.updateSyncState(userId, 'google_calendar', {
      status: 'running',
      errorMessage: null
    });

    try {
      const calendar = google.calendar({ version: 'v3', auth: authClient });

      // Fetch previous recent 50+ events (from 90 days in the past onwards)
      const timeMin = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

      let listResponse;
      try {
        listResponse = await calendar.events.list({
          calendarId: 'primary',
          timeMin,
          maxResults: 250,
          singleEvents: true,
          showDeleted: true
        });
      } catch (apiError: any) {
        const errorMsg = apiError?.message || 'Google Calendar API request failed';
        const isAuthError = apiError?.code === 401 || (apiError?.code === 403 && (errorMsg.toLowerCase().includes('auth') || errorMsg.toLowerCase().includes('permission') || errorMsg.toLowerCase().includes('insufficient')));
        const statusCode = isAuthError ? 401 : (apiError?.code || 500);
        logger.error(`Google Calendar API list failed for user ${userId}: ${errorMsg}`);
        throw new AppError(
          isAuthError
            ? 'Google Calendar access unauthorized. Please ensure calendar.readonly permission is granted.'
            : `Calendar synchronization failed: ${errorMsg}`,
          statusCode,
          'CALENDAR_API_ERROR'
        );
      }

      const eventItems = (listResponse.data.items || []).sort((a, b) => {
        const startA = a.start?.dateTime || a.start?.date || '';
        const startB = b.start?.dateTime || b.start?.date || '';
        return new Date(startA).getTime() - new Date(startB).getTime();
      });
      if (eventItems.length === 0) {
        logger.info(`No calendar events found for user ${userId}`);
        await syncStateService.updateSyncState(userId, 'google_calendar', {
          status: 'success',
          lastSyncedAt: new Date().toISOString()
        });
        return { fetched: 0, inserted: 0, updated: 0, cancelled: 0, skipped: 0 };
      }

      // Normalize event items
      const normalizedEvents = eventItems.map((item) => this.parseCalendarEvent(item, 'primary'));

      // Persist to Supabase calendar_events table
      const summary = await calendarEventService.saveEvents(userId, normalizedEvents);

      // Update sync state
      await syncStateService.updateSyncState(userId, 'google_calendar', {
        status: 'success',
        lastSyncedAt: new Date().toISOString()
      });

      logger.info(
        `Calendar sync successful for user ${userId}: fetched ${summary.fetched}, inserted ${summary.inserted}, updated ${summary.updated}, cancelled ${summary.cancelled}`
      );

      return summary;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown calendar sync error';
      await syncStateService.updateSyncState(userId, 'google_calendar', {
        status: 'failed',
        errorMessage: errMsg
      });
      throw error;
    }
  }

  /**
   * Retrieves stored calendar events for the authenticated user from Supabase.
   */
  public async getUserCalendarEvents(userId: string, limit = 50): Promise<CalendarEventRecord[]> {
    return calendarEventService.getEvents(userId, limit);
  }

  /**
   * Retrieves Calendar sync status for the authenticated user.
   */
  public async getSyncStatus(userId: string) {
    const syncState = await syncStateService.getSyncState(userId, 'google_calendar');
    return {
      lastSyncedAt: syncState?.lastSyncedAt || null,
      status: syncState?.status || 'idle',
      errorMessage: syncState?.errorMessage || null
    };
  }
}

export const calendarService = new CalendarService();
