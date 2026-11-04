import { google, gmail_v1 } from 'googleapis';
import { GmailSyncSummary, EmailRecord } from '@lifesynch/shared';
import { googleOAuthService } from './oauth.service';
import { accountService } from '../db/account.service';
import { emailService, NormalizedEmailInput } from '../db/email.service';
import { syncStateService } from '../db/sync-state.service';
import { AppError } from '../../middlewares/error.middleware';
import { logger } from '../../utils/logger';

export interface ParsedEmailContent {
  subject: string;
  sender: string;
  recipient: string;
  receivedAt: string;
  snippet: string;
  bodyText: string;
  bodyHtml: string;
  labels: string[];
  attachments: string[];
}

export class GmailService {
  /**
   * Safe base64url decoder for Gmail message payloads.
   */
  public decodeBase64Url(encoded: string): string {
    if (!encoded) return '';
    try {
      const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
      return Buffer.from(normalized, 'base64').toString('utf-8');
    } catch {
      return '';
    }
  }

  /**
   * Helper to strip HTML tags and decode basic entities to provide readable plain text.
   */
  public htmlToPlainText(html: string): string {
    if (!html) return '';
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<\/p>|<\/div>|<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  }

  /**
   * Recursively parses Gmail message payload parts to extract bodyText, bodyHtml, and attachments.
   */
  public extractBodyParts(part?: gmail_v1.Schema$MessagePart): { bodyText: string; bodyHtml: string; attachments: string[] } {
    if (!part) return { bodyText: '', bodyHtml: '', attachments: [] };

    let bodyText = '';
    let bodyHtml = '';
    const attachments: string[] = [];

    if (part.filename && part.filename.trim().length > 0) {
      attachments.push(part.filename.trim());
    }

    const mimeType = part.mimeType || '';

    // Direct payload body
    if (part.body && part.body.data) {
      const decoded = this.decodeBase64Url(part.body.data);
      if (mimeType.includes('text/plain')) {
        bodyText += decoded;
      } else if (mimeType.includes('text/html')) {
        bodyHtml += decoded;
      }
    }

    // Multipart traversal
    if (part.parts && Array.isArray(part.parts)) {
      for (const subPart of part.parts) {
        const subResult = this.extractBodyParts(subPart);
        if (subResult.bodyText) {
          bodyText = bodyText ? `${bodyText}\n${subResult.bodyText}` : subResult.bodyText;
        }
        if (subResult.bodyHtml) {
          bodyHtml = bodyHtml ? `${bodyHtml}\n${subResult.bodyHtml}` : subResult.bodyHtml;
        }
        if (subResult.attachments && subResult.attachments.length > 0) {
          attachments.push(...subResult.attachments);
        }
      }
    }

    return { bodyText: bodyText.trim(), bodyHtml: bodyHtml.trim(), attachments: Array.from(new Set(attachments)) };
  }

  /**
   * Normalizes a full Gmail message into structured content.
   */
  public parseGmailMessage(message: gmail_v1.Schema$Message): ParsedEmailContent {
    const headers = message.payload?.headers || [];
    const getHeader = (name: string): string => {
      const h = headers.find(hdr => hdr.name?.toLowerCase() === name.toLowerCase());
      return h?.value || '';
    };

    const subject = getHeader('Subject') || '(No Subject)';
    const sender = getHeader('From') || '';
    const recipient = getHeader('To') || '';
    const dateHeader = getHeader('Date');

    let receivedAt = new Date().toISOString();
    if (message.internalDate) {
      const parsedMs = parseInt(message.internalDate, 10);
      if (!isNaN(parsedMs) && parsedMs > 0) {
        receivedAt = new Date(parsedMs).toISOString();
      }
    } else if (dateHeader) {
      const parsedDate = new Date(dateHeader);
      if (!isNaN(parsedDate.getTime())) {
        receivedAt = parsedDate.toISOString();
      }
    }

    const { bodyText, bodyHtml, attachments } = this.extractBodyParts(message.payload);

    // If no plain text is present, extract readable text from HTML for AI processing
    const cleanBodyText = bodyText || this.htmlToPlainText(bodyHtml);
    const textWithAttachments = attachments.length > 0
      ? `${cleanBodyText}\n[Attachments: ${attachments.join(', ')}]`
      : cleanBodyText;

    return {
      subject,
      sender,
      recipient,
      receivedAt,
      snippet: message.snippet || '',
      bodyText: textWithAttachments,
      bodyHtml,
      labels: message.labelIds || [],
      attachments
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
        logger.info(`Received refreshed Google tokens for user ${userId}`);
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
        logger.info(`Access token expired or expiring soon for user ${userId}. Refreshing...`);
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
   * Synchronizes real Gmail messages for the authenticated user and stores them in Supabase.
   */
  public async syncUserEmails(userId: string): Promise<GmailSyncSummary> {
    logger.info(`Initiating real Gmail synchronization for user: ${userId}`);

    const authClient = await this.getAuthenticatedOAuthClient(userId);

    // Retrieve previous sync state for historical pagination
    const existingSyncState = await syncStateService.getSyncState(userId, 'gmail');
    const priorSyncToken = existingSyncState?.syncToken || undefined;

    await syncStateService.updateSyncState(userId, 'gmail', {
      status: 'running',
      errorMessage: null
    });

    try {
      const gmail = google.gmail({ version: 'v1', auth: authClient });

      // 1. Fetch recent messages list (page 1) to catch newly arrived emails (50-100 messages where available)
      let listResponse;
      try {
        listResponse = await gmail.users.messages.list({
          userId: 'me',
          maxResults: 50,
          q: 'in:inbox'
        });
      } catch (apiError: any) {
        const errorMsg = apiError?.message || 'Google Gmail API request failed';
        const isAuthError = apiError?.code === 401 || (apiError?.code === 403 && (errorMsg.toLowerCase().includes('auth') || errorMsg.toLowerCase().includes('permission') || errorMsg.toLowerCase().includes('insufficient')));
        const statusCode = isAuthError ? 401 : (apiError?.code || 500);
        logger.error(`Gmail API list failed for user ${userId}: ${errorMsg}`);
        throw new AppError(
          isAuthError
            ? 'Google Gmail access unauthorized. Please ensure gmail.readonly permission is granted.'
            : `Gmail synchronization failed: ${errorMsg}`,
          statusCode,
          'GMAIL_API_ERROR'
        );
      }

      const allMessageSummaries: gmail_v1.Schema$Message[] = [...(listResponse.data.messages || [])];
      let nextSyncToken: string | null = listResponse.data.nextPageToken || null;

      // 2. Progressive pagination: on initial sync or explicit cursor, fetch an older batch (50-100 messages where supported)
      const isInitialSync = !existingSyncState?.lastSyncedAt;
      const tokenToFetch = isInitialSync ? listResponse.data.nextPageToken : priorSyncToken;
      if (tokenToFetch && allMessageSummaries.length < 100) {
        try {
          const olderPageResponse = await gmail.users.messages.list({
            userId: 'me',
            maxResults: 50,
            q: 'in:inbox',
            pageToken: tokenToFetch
          });
          if (olderPageResponse.data.messages && olderPageResponse.data.messages.length > 0) {
            allMessageSummaries.push(...olderPageResponse.data.messages);
          }
          nextSyncToken = olderPageResponse.data.nextPageToken || null;
        } catch (pageErr) {
          logger.warn(`Failed to fetch older page with token for user ${userId}, resetting cursor:`, pageErr);
          nextSyncToken = null;
        }
      }

      // Deduplicate summaries by message ID in memory
      const messageSummaries = Array.from(
        new Map(allMessageSummaries.filter(m => !!m.id).map(m => [m.id!, m])).values()
      );

      if (messageSummaries.length === 0) {
        logger.info(`No messages found in inbox for user ${userId}`);
        await syncStateService.updateSyncState(userId, 'gmail', {
          status: 'success',
          lastSyncedAt: new Date().toISOString(),
          syncToken: nextSyncToken
        });
        return { fetched: 0, inserted: 0, updated: 0, skipped: 0 };
      }

      // 3. Check existing message IDs in DB to avoid unnecessary quota exhaustion on repeat syncs
      const allIds = messageSummaries.map(m => m.id).filter(Boolean) as string[];
      const existingIds = await emailService.getExistingMessageIds(userId, allIds);
      const messagesToFetch = messageSummaries.filter(m => m.id && !existingIds.has(m.id));

      const normalizedEmails: NormalizedEmailInput[] = [];
      const batchSize = 10;

      for (let i = 0; i < messagesToFetch.length; i += batchSize) {
        const batch = messagesToFetch.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(
          batch.map(async (item) => {
            if (!item.id) return null;
            const detailRes = await gmail.users.messages.get({
              userId: 'me',
              id: item.id,
              format: 'full'
            });
            return detailRes.data;
          })
        );

        for (const res of batchResults) {
          if (res.status === 'fulfilled' && res.value && res.value.id) {
            const parsed = this.parseGmailMessage(res.value);
            normalizedEmails.push({
              messageId: res.value.id,
              threadId: res.value.threadId || undefined,
              sender: parsed.sender,
              recipient: parsed.recipient,
              subject: parsed.subject,
              snippet: parsed.snippet,
              bodyText: parsed.bodyText,
              bodyHtml: parsed.bodyHtml,
              receivedAt: parsed.receivedAt,
              labels: parsed.labels
            });
          }
        }
      }

      // 4. Save newly fetched emails to Supabase
      const summary = normalizedEmails.length > 0
        ? await emailService.saveEmails(userId, normalizedEmails)
        : { fetched: messageSummaries.length, inserted: 0, updated: 0, skipped: messageSummaries.length };

      // 4. Update sync state
      await syncStateService.updateSyncState(userId, 'gmail', {
        status: 'success',
        lastSyncedAt: new Date().toISOString(),
        syncToken: nextSyncToken
      });

      logger.info(
        `Gmail sync successful for user ${userId}: fetched ${summary.fetched}, inserted ${summary.inserted}, updated ${summary.updated}`
      );

      return summary;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown sync error';
      await syncStateService.updateSyncState(userId, 'gmail', {
        status: 'failed',
        errorMessage: errMsg
      });
      throw error;
    }
  }

  /**
   * Retrieves stored emails for the authenticated user.
   */
  public async getUserEmails(userId: string, limit = 100): Promise<EmailRecord[]> {
    return emailService.getEmails(userId, limit);
  }

  /**
   * Retrieves Gmail sync status for the authenticated user.
   */
  /**
   * Retrieves spam emails directly from the Gmail SPAM folder for the authenticated user.
   * Handles pagination so older spam messages are retrieved.
   * Does NOT store them into the database emails table or trigger AI responsibility extraction.
   */
  public async getUserSpamEmails(userId: string, limit = 100): Promise<EmailRecord[]> {
    logger.info(`Fetching Spam emails from Gmail API for user: ${userId} (limit: ${limit})`);
    const authClient = await this.getAuthenticatedOAuthClient(userId);
    const gmail = google.gmail({ version: 'v1', auth: authClient });

    const allMessageSummaries: gmail_v1.Schema$Message[] = [];
    let pageToken: string | undefined = undefined;

    try {
      do {
        const pageSize = Math.min(50, limit - allMessageSummaries.length);
        const listResponse: any = await gmail.users.messages.list({
          userId: 'me',
          includeSpamTrash: true,
          q: 'in:spam',
          maxResults: pageSize,
          pageToken
        });

        if (listResponse.data.messages && listResponse.data.messages.length > 0) {
          allMessageSummaries.push(...listResponse.data.messages);
        }

        pageToken = listResponse.data.nextPageToken || undefined;
      } while (pageToken && allMessageSummaries.length < limit);

      if (allMessageSummaries.length === 0) {
        logger.info(`No spam messages found for user ${userId}`);
        return [];
      }

      // Deduplicate summaries by ID in memory
      const uniqueSummaries = Array.from(
        new Map(allMessageSummaries.filter(m => !!m.id).map(m => [m.id!, m])).values()
      );

      // Fetch message details in concurrent chunks of 10
      const spamEmails: EmailRecord[] = [];
      const batchSize = 10;

      for (let i = 0; i < uniqueSummaries.length; i += batchSize) {
        const batch = uniqueSummaries.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(
          batch.map(async (item) => {
            if (!item.id) return null;
            const detailRes = await gmail.users.messages.get({
              userId: 'me',
              id: item.id,
              format: 'full'
            });
            return detailRes.data;
          })
        );

        for (const res of batchResults) {
          if (res.status === 'fulfilled' && res.value && res.value.id) {
            const parsed = this.parseGmailMessage(res.value);
            spamEmails.push({
              id: res.value.id,
              userId,
              messageId: res.value.id,
              threadId: res.value.threadId || undefined,
              sender: parsed.sender,
              recipient: parsed.recipient,
              subject: parsed.subject,
              snippet: parsed.snippet,
              bodyText: parsed.bodyText,
              bodyHtml: parsed.bodyHtml,
              labels: parsed.labels,
              receivedAt: parsed.receivedAt,
              processed: true,
              createdAt: parsed.receivedAt
            });
          }
        }
      }

      // Sort chronological descending (newest first for display)
      spamEmails.sort((a, b) => new Date(b.receivedAt || '').getTime() - new Date(a.receivedAt || '').getTime());

      logger.info(`Successfully retrieved ${spamEmails.length} spam emails for user ${userId}`);
      return spamEmails;
    } catch (error: any) {
      const errorMsg = error?.message || 'Google Gmail API request failed';
      logger.error(`Error retrieving spam emails for user ${userId}: ${errorMsg}`);
      throw new AppError(`Failed to fetch spam emails: ${errorMsg}`, error?.code || 500);
    }
  }

  public async getSyncStatus(userId: string) {
    const syncState = await syncStateService.getSyncState(userId, 'gmail');
    return {
      lastSyncedAt: syncState?.lastSyncedAt || null,
      status: syncState?.status || 'idle',
      errorMessage: syncState?.errorMessage || null
    };
  }
}

export const gmailService = new GmailService();
