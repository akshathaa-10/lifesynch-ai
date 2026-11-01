import { CalendarEventRecord, CalendarSyncSummary } from '@lifesynch/shared';
import { isSupabaseConfigured, getSupabaseAdminClient } from '../../config/supabase';
import { logger } from '../../utils/logger';

export interface NormalizedCalendarEventInput {
  eventId: string;
  calendarId?: string;
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
}

export class CalendarEventService {
  private inMemoryEvents: Map<string, CalendarEventRecord> = new Map();

  public async saveEvents(
    userId: string,
    events: NormalizedCalendarEventInput[]
  ): Promise<CalendarSyncSummary> {
    if (events.length === 0) {
      return { fetched: 0, inserted: 0, updated: 0, cancelled: 0, skipped: 0 };
    }

    const now = new Date().toISOString();

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      const eventIds = events.map(e => e.eventId);

      // Query existing events to calculate inserted vs updated metrics
      const { data: existingRows } = await supabase
        .from('calendar_events')
        .select('event_id')
        .eq('user_id', userId)
        .in('event_id', eventIds);

      const existingSet = new Set((existingRows || []).map((r: { event_id: string }) => r.event_id));
      let inserted = 0;
      let updated = 0;
      let cancelled = 0;

      for (const e of events) {
        if (e.status === 'cancelled') {
          cancelled++;
        }
        if (existingSet.has(e.eventId)) {
          updated++;
        } else {
          inserted++;
        }
      }

      const records = events.map(e => ({
        user_id: userId,
        event_id: e.eventId,
        calendar_id: e.calendarId || 'primary',
        summary: e.summary || '(No Title)',
        description: e.description || null,
        start_time: e.startTime,
        end_time: e.endTime,
        location: e.location || null,
        html_link: e.htmlLink || null,
        status: e.status || 'confirmed',
        attendees: e.attendees || [],
        updated_at: now
      }));

      const { error } = await supabase
        .from('calendar_events')
        .upsert(records, { onConflict: 'user_id,event_id' });

      if (error) {
        logger.error('Error saving calendar events to Supabase:', error.message);
        throw error;
      }

      logger.info(
        `Calendar storage completed for user ${userId}: ${inserted} inserted, ${updated} updated, ${cancelled} cancelled`
      );

      return {
        fetched: events.length,
        inserted,
        updated,
        cancelled,
        skipped: 0
      };
    }

    // In-memory fallback
    let inserted = 0;
    let updated = 0;
    let cancelled = 0;

    for (const e of events) {
      const key = `${userId}:${e.eventId}`;
      const exists = this.inMemoryEvents.has(key);
      if (e.status === 'cancelled') {
        cancelled++;
      }
      if (exists) {
        updated++;
      } else {
        inserted++;
      }

      this.inMemoryEvents.set(key, {
        id: `cal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        userId,
        eventId: e.eventId,
        calendarId: e.calendarId || 'primary',
        summary: e.summary || '(No Title)',
        description: e.description,
        startTime: e.startTime,
        endTime: e.endTime,
        location: e.location,
        htmlLink: e.htmlLink,
        status: e.status || 'confirmed',
        attendees: e.attendees || [],
        createdAt: now,
        updatedAt: now
      });
    }

    return {
      fetched: events.length,
      inserted,
      updated,
      cancelled,
      skipped: 0
    };
  }

  public async getEvents(userId: string, limit = 50): Promise<CalendarEventRecord[]> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', userId)
        .order('start_time', { ascending: true })
        .limit(limit);

      if (error) {
        logger.error(`Error querying calendar events from Supabase for user ${userId}:`, error.message);
        throw error;
      }

      return (data || []).map(this.mapSupabaseEvent);
    }

    return Array.from(this.inMemoryEvents.values())
      .filter(e => e.userId === userId)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .slice(0, limit);
  }

  public async getEventById(userId: string, eventId: string): Promise<CalendarEventRecord | null> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId);
      
      let query = supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', userId);

      if (isUuid) {
        query = query.or(`id.eq.${eventId},event_id.eq.${eventId}`);
      } else {
        query = query.eq('event_id', eventId);
      }

      const { data, error } = await query.single();

      if (error || !data) {
        return null;
      }

      return this.mapSupabaseEvent(data);
    }

    const key = `${userId}:${eventId}`;
    return this.inMemoryEvents.get(key) || null;
  }

  private mapSupabaseEvent(record: any): CalendarEventRecord {
    return {
      id: record.id,
      userId: record.user_id,
      eventId: record.event_id,
      calendarId: record.calendar_id,
      summary: record.summary,
      description: record.description,
      startTime: record.start_time,
      endTime: record.end_time,
      location: record.location,
      htmlLink: record.html_link,
      status: record.status || 'confirmed',
      attendees: record.attendees || [],
      createdAt: record.created_at,
      updatedAt: record.updated_at
    };
  }
}

export const calendarEventService = new CalendarEventService();
