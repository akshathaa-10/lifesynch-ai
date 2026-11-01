import { EmailRecord, GmailSyncSummary } from '@lifesynch/shared';
import { isSupabaseConfigured, getSupabaseAdminClient } from '../../config/supabase';
import { logger } from '../../utils/logger';

export interface NormalizedEmailInput {
  messageId: string;
  threadId?: string;
  sender?: string;
  recipient?: string;
  subject?: string;
  snippet?: string;
  bodyText?: string;
  bodyHtml?: string;
  receivedAt?: string;
  labels?: string[];
}

export class EmailService {
  private inMemoryEmails: Map<string, EmailRecord> = new Map();

  public async saveEmails(
    userId: string,
    emails: NormalizedEmailInput[]
  ): Promise<GmailSyncSummary> {
    if (emails.length === 0) {
      return { fetched: 0, inserted: 0, updated: 0, skipped: 0 };
    }

    const now = new Date().toISOString();

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      const messageIds = emails.map(e => e.messageId);

      // Determine which messages already exist for this user to track counts
      const { data: existingRows } = await supabase
        .from('emails')
        .select('message_id')
        .eq('user_id', userId)
        .in('message_id', messageIds);

      const existingSet = new Set((existingRows || []).map((r: { message_id: string }) => r.message_id));
      let inserted = 0;
      let updated = 0;

      for (const id of messageIds) {
        if (existingSet.has(id)) {
          updated++;
        } else {
          inserted++;
        }
      }

      const records = emails.map(e => ({
        user_id: userId,
        message_id: e.messageId,
        thread_id: e.threadId || null,
        sender: e.sender || null,
        recipient: e.recipient || null,
        subject: e.subject || '(No Subject)',
        snippet: e.snippet || null,
        body_text: e.bodyText || null,
        body_html: e.bodyHtml || null,
        labels: e.labels || [],
        received_at: e.receivedAt || now,
        processed: false
      }));

      const { error } = await supabase
        .from('emails')
        .upsert(records, { onConflict: 'user_id,message_id' });

      if (error) {
        logger.error('Error saving emails to Supabase:', error.message);
        throw error;
      }

      logger.info(
        `Gmail storage completed for user ${userId}: ${inserted} inserted, ${updated} updated`
      );

      return {
        fetched: emails.length,
        inserted,
        updated,
        skipped: 0
      };
    }

    // In-memory fallback
    let inserted = 0;
    let updated = 0;

    for (const e of emails) {
      const key = `${userId}:${e.messageId}`;
      const exists = this.inMemoryEmails.has(key);
      if (exists) {
        updated++;
      } else {
        inserted++;
      }

      this.inMemoryEmails.set(key, {
        id: `email_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        userId,
        messageId: e.messageId,
        threadId: e.threadId,
        sender: e.sender,
        recipient: e.recipient,
        subject: e.subject,
        snippet: e.snippet,
        bodyText: e.bodyText,
        bodyHtml: e.bodyHtml,
        labels: e.labels,
        receivedAt: e.receivedAt || now,
        processed: false,
        createdAt: now
      });
    }

    return {
      fetched: emails.length,
      inserted,
      updated,
      skipped: 0
    };
  }

  public async getEmails(userId: string, limit = 50): Promise<EmailRecord[]> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('emails')
        .select('*')
        .eq('user_id', userId)
        .order('received_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error(`Error querying emails from Supabase for user ${userId}:`, error.message);
        throw error;
      }

      return (data || []).map(this.mapSupabaseEmail);
    }

    return Array.from(this.inMemoryEmails.values())
      .filter(e => e.userId === userId)
      .sort((a, b) => new Date(b.receivedAt || '').getTime() - new Date(a.receivedAt || '').getTime())
      .slice(0, limit);
  }

  public async getEmailById(userId: string, messageId: string): Promise<EmailRecord | null> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(messageId);

      let query = supabase
        .from('emails')
        .select('*')
        .eq('user_id', userId);

      if (isUuid) {
        query = query.or(`id.eq.${messageId},message_id.eq.${messageId}`);
      } else {
        query = query.eq('message_id', messageId);
      }

      const { data, error } = await query.single();

      if (error || !data) {
        return null;
      }

      return this.mapSupabaseEmail(data);
    }

    const key = `${userId}:${messageId}`;
    return this.inMemoryEmails.get(key) || null;
  }

  public async getExistingMessageIds(userId: string, messageIds: string[]): Promise<Set<string>> {
    if (messageIds.length === 0) return new Set();
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('emails')
        .select('message_id')
        .eq('user_id', userId)
        .in('message_id', messageIds);
      if (error) {
        logger.error(`Error querying existing message IDs from Supabase for user ${userId}:`, error.message);
        return new Set();
      }
      return new Set((data || []).map((r: { message_id: string }) => r.message_id));
    }
    const set = new Set<string>();
    for (const id of messageIds) {
      if (this.inMemoryEmails.has(`${userId}:${id}`)) {
        set.add(id);
      }
    }
    return set;
  }

  private mapSupabaseEmail(record: any): EmailRecord {
    return {
      id: record.id,
      userId: record.user_id,
      messageId: record.message_id,
      threadId: record.thread_id,
      sender: record.sender,
      recipient: record.recipient,
      subject: record.subject,
      snippet: record.snippet,
      bodyText: record.body_text,
      bodyHtml: record.body_html,
      labels: record.labels || [],
      receivedAt: record.received_at,
      processed: record.processed,
      createdAt: record.created_at
    };
  }
}

export const emailService = new EmailService();
