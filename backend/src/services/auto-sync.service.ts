import { gmailService } from './google/gmail.service';
import { calendarService } from './google/calendar.service';
import { accountService } from './db/account.service';
import { responsibilityGenerationService } from './ai/responsibility-generation.service';
import { reminderService } from './reminder.service';
import { logger } from '../utils/logger';

export class AutoSyncService {
  private syncTimer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private activeSyncUsers: Set<string> = new Set();
  private intervalMs: number = 30000; // 30 seconds

  /**
   * Starts periodic automatic synchronization.
   */
  public start(intervalMs: number = 30000): void {
    if (this.syncTimer) {
      logger.info('AutoSyncService is already running.');
      return;
    }

    this.intervalMs = intervalMs;
    logger.info(`Starting AutoSyncService with interval: ${this.intervalMs}ms`);

    // Run first sync shortly after start (e.g. 5 seconds)
    setTimeout(() => {
      this.syncAllUsers().catch(err => {
        logger.error('Error during initial auto-sync execution:', err);
      });
    }, 5000);

    // Schedule regular periodic execution
    this.syncTimer = setInterval(() => {
      this.syncAllUsers().catch(err => {
        logger.error('Error during periodic auto-sync execution:', err);
      });
    }, this.intervalMs);
  }

  /**
   * Stops periodic synchronization.
   */
  public stop(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      logger.info('AutoSyncService stopped.');
    }
  }

  /**
   * Triggers automatic synchronization for all users with connected Google accounts.
   */
  public async syncAllUsers(): Promise<void> {
    if (this.isRunning) {
      logger.debug('AutoSyncService already has a global cycle running, skipping this tick.');
      return;
    }

    this.isRunning = true;
    try {
      const accounts = await accountService.getAllConnectedAccounts('google');
      if (!accounts || accounts.length === 0) {
        return;
      }

      // Group accounts by user_id to avoid duplicate user syncs in a single tick
      const userIds = Array.from(new Set(accounts.map((a: any) => a.user_id || a.userId)));

      for (const userId of userIds) {
        if (!userId) continue;
        await this.syncUser(userId);
      }
    } catch (err: any) {
      logger.error('AutoSyncService error during syncAllUsers:', err?.message || err);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Synchronizes Gmail and Google Calendar for a specific user, followed by AI responsibility extraction and reminders.
   */
  public async syncUser(userId: string): Promise<{ gmailSynced: boolean; calendarSynced: boolean }> {
    if (this.activeSyncUsers.has(userId)) {
      logger.debug(`Auto-sync already in-flight for user ${userId}, skipping concurrent request.`);
      return { gmailSynced: false, calendarSynced: false };
    }

    this.activeSyncUsers.add(userId);
    let gmailSynced = false;
    let calendarSynced = false;

    try {
      // 1. Sync Gmail and Calendar concurrently
      const [gmailSettled, calSettled] = await Promise.allSettled([
        gmailService.syncUserEmails(userId),
        calendarService.syncUserCalendar(userId)
      ]);

      if (gmailSettled.status === 'fulfilled') {
        gmailSynced = true;
        const gmailRes = gmailSettled.value;
        if (gmailRes.inserted > 0 || gmailRes.updated > 0) {
          logger.info(`[Auto-Sync] Gmail for ${userId}: ${gmailRes.inserted} new, ${gmailRes.updated} updated.`);
        }
      } else {
        logger.warn(`[Auto-Sync] Gmail sync notice for user ${userId}: ${gmailSettled.reason?.message || gmailSettled.reason}`);
      }

      if (calSettled.status === 'fulfilled') {
        calendarSynced = true;
        const calRes = calSettled.value;
        if (calRes.inserted > 0 || calRes.updated > 0 || calRes.cancelled > 0) {
          logger.info(`[Auto-Sync] Calendar for ${userId}: ${calRes.inserted} new, ${calRes.updated} updated, ${calRes.cancelled} cancelled.`);
        }
      } else {
        logger.warn(`[Auto-Sync] Calendar sync notice for user ${userId}: ${calSettled.reason?.message || calSettled.reason}`);
      }

      // 3. AI Responsibility Generation (continuous automatic extraction)
      try {
        await responsibilityGenerationService.generateResponsibilities(userId);
      } catch (aiErr: any) {
        logger.warn(`[Auto-Sync] AI Responsibility generation notice for user ${userId}: ${aiErr?.message || aiErr}`);
      }

      // 4. Smart Reminders & Notifications
      try {
        await reminderService.generateRemindersForUser(userId);
      } catch (remErr: any) {
        logger.warn(`[Auto-Sync] Reminder generation notice for user ${userId}: ${remErr?.message || remErr}`);
      }

      return { gmailSynced, calendarSynced };
    } finally {
      this.activeSyncUsers.delete(userId);
    }
  }
}

export const autoSyncService = new AutoSyncService();
