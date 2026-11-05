import { Responsibility, CreateResponsibilityDTO, UpdateResponsibilityDTO, getSourceDisplay } from '@lifesynch/shared';
import { isSupabaseConfigured, getSupabaseAdminClient } from '../config/supabase';
import { logger } from '../utils/logger';
import { 
  determineIntelligentPriority, 
  determineResponsibilityStatus, 
  isSameObligation,
  sanitizeTaskDeadline,
  isInformationalEmailNotResponsibility,
  isProgramScheduleOrEventDateRange
} from './ai/responsibility-matcher';

export class TaskService {
  // In-memory store fallback when Supabase is unconfigured in development
  private inMemoryResponsibilities: Map<string, Responsibility> = new Map();

  public async getTasks(userId: string): Promise<Responsibility[]> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('responsibilities')
        .select('*')
        .eq('user_id', userId)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error querying responsibilities from Supabase:', error.message);
        throw error;
      }
      const rawTasks = (data || []).map(r => this.mapSupabaseRecord(r));

      // Exclude cancelled and completed tasks from active tasks query (completed tasks are accessed via getTaskHistory)
      const tasks = rawTasks.filter(t => {
        const norm = (t.status || '').toUpperCase();
        if (norm === 'CANCELLED' || norm === 'DISMISSED') return false;
        if (norm === 'COMPLETED') return false;
        return true;
      });

      // Correct existing stored responsibilities & refresh lifecycle statuses:
      // 1. Program schedules mistakenly assigned deadlines have their deadlines unset and classified as program_schedule.
      // 2. Events/meetings are accurately tagged as event_meeting with deadlineType: event_time.
      // 3. Application windows are tagged as opportunity_window with deadlineType: application_window.
      // 4. Past deadlines transition to OVERDUE rather than lingering in active attention sections.
      // 5. Cancelled/non-actionable circulars are archived.
      for (const t of tasks) {
        const { needsDbUpdate, updateFields } = this.correctRecord(t);

        if (needsDbUpdate) {
          updateFields.updated_at = new Date().toISOString();
          Promise.resolve(
            supabase
              .from('responsibilities')
              .update(updateFields)
              .eq('id', t.id)
          ).catch((err: unknown) => logger.warn(`Failed to update responsibility ${t.id} in background:`, err));
        }
      }

      // Reconcile and deduplicate so user sees ONE responsibility for obligations found in Gmail and Calendar
      const { reconciled, duplicatesToArchive } = this.reconcileAndDeduplicate(tasks);

      if (duplicatesToArchive.length > 0) {
        Promise.resolve(
          supabase
            .from('responsibilities')
            .update({ is_archived: true })
            .in('id', duplicatesToArchive)
        )
          .then(() => logger.info(`Archived ${duplicatesToArchive.length} duplicate responsibilities after cross-source reconciliation`))
          .catch((err: unknown) => logger.warn('Failed to archive duplicate responsibilities in background:', err));
      }

      return reconciled;
    }

    const tasks = Array.from(this.inMemoryResponsibilities.values())
      .filter(t => {
        if (t.userId !== userId || t.isArchived) return false;
        const norm = (t.status || '').toUpperCase();
        if (norm === 'CANCELLED' || norm === 'DISMISSED') return false;
        if (norm === 'COMPLETED') return false;
        return true;
      });

    for (const t of tasks) {
      this.correctRecord(t);
    }

    return this.reconcileAndDeduplicate(tasks).reconciled;
  }

  /**
   * Refreshes the deadline urgency and priority for active tasks when current date/time changes.
   */
  public async refreshTaskUrgencies(userId: string, now?: Date): Promise<{ updatedCount: number; tasks: Responsibility[] }> {
    const tasks = await this.getTasks(userId);
    let updatedCount = 0;
    const refreshed: Responsibility[] = [];

    for (const t of tasks) {
      if (t.dueDate && t.status !== 'completed' && t.status !== 'dismissed' && !t.isArchived) {
        const latestPriority = determineIntelligentPriority({
          title: t.title,
          description: t.description,
          action: t.action,
          dueDate: t.dueDate,
          dueTime: t.dueTime,
          category: t.category,
          sourceType: t.source,
          sourceContext: t.sourceContext as any,
          existingPriority: t.priority,
          now
        });

        if (latestPriority !== t.priority) {
          const updated = await this.updateTask(t.id, { priority: latestPriority });
          refreshed.push(updated);
          updatedCount++;
          continue;
        }
      }
      refreshed.push(t);
    }

    return { updatedCount, tasks: refreshed };
  }

  public async getAllTasksForUser(userId: string): Promise<Responsibility[]> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('responsibilities')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error querying all user responsibilities from Supabase:', error.message);
        throw error;
      }
      return (data || []).map(r => this.mapSupabaseRecord(r));
    }

    return Array.from(this.inMemoryResponsibilities.values())
      .filter(t => t.userId === userId);
  }

  public async getTaskHistory(userId: string): Promise<Responsibility[]> {
    return this.getAllTasksForUser(userId);
  }

  public async getTaskById(id: string): Promise<Responsibility | null> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('responsibilities')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        return null;
      }
      return this.mapSupabaseRecord(data);
    }

    return this.inMemoryResponsibilities.get(id) || null;
  }

  public async createTask(userId: string, dto: CreateResponsibilityDTO): Promise<Responsibility> {
    const now = new Date().toISOString();
    const normalizedPriority: 'high' | 'medium' | 'low' = 
      dto.priority === 'urgent' || dto.priority === 'high' 
        ? 'high' 
        : dto.priority === 'low' 
        ? 'low' 
        : 'medium';

    const sources = dto.sources || (dto.source === 'both' ? ['gmail', 'calendar'] : dto.source ? [dto.source] : ['manual']);

    const initialStatus = determineResponsibilityStatus({
      dueDate: dto.dueDate,
      dueTime: dto.dueTime,
      existingStatus: dto.status,
      sourceContext: dto.sourceContext
    });

    const dbStatus = 
      initialStatus === 'COMPLETED' || dto.status === 'completed'
        ? 'completed'
        : initialStatus === 'CANCELLED' || dto.status === 'dismissed' || dto.status === 'cancelled'
        ? 'dismissed'
        : 'pending';

    const metadata = {
      action: dto.action,
      dueTime: dto.dueTime,
      category: dto.category || 'general',
      sourceContext: dto.sourceContext,
      sources,
      lifecycleStatus: initialStatus,
      ...(dto.metadata || {})
    };

    const newResponsibility: Responsibility = {
      id: `resp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId,
      title: dto.title,
      description: dto.description || '',
      type: dto.type || 'task',
      priority: normalizedPriority,
      status: initialStatus,
      category: dto.category || 'general',
      dueDate: dto.dueDate,
      dueTime: dto.dueTime,
      action: dto.action,
      source: dto.source || 'manual',
      sources,
      sourceDisplay: getSourceDisplay({ source: dto.source || 'manual', sources }),
      sourceId: dto.sourceId,
      sourceContext: dto.sourceContext,
      confidence: dto.confidence ?? 1.0,
      tags: dto.tags || [],
      metadata,
      isArchived: initialStatus === 'CANCELLED',
      createdAt: now,
      updatedAt: now
    };

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      const payload = {
        user_id: userId,
        title: newResponsibility.title,
        description: newResponsibility.description,
        type: newResponsibility.type,
        priority: newResponsibility.priority,
        status: dbStatus,
        due_date: newResponsibility.dueDate,
        source: newResponsibility.source,
        source_id: newResponsibility.sourceId,
        confidence: newResponsibility.confidence,
        tags: newResponsibility.tags,
        metadata: newResponsibility.metadata,
        is_archived: newResponsibility.isArchived,
        created_at: now,
        updated_at: now
      };

      const { data, error } = await supabase
        .from('responsibilities')
        .insert(payload)
        .select()
        .single();

      if (error) {
        logger.error('Error creating responsibility in Supabase:', error.message);
        throw error;
      }
      return this.mapSupabaseRecord(data);
    }

    this.inMemoryResponsibilities.set(newResponsibility.id, newResponsibility);
    logger.info(`Created new responsibility ${newResponsibility.id} (in-memory mode)`);
    return newResponsibility;
  }

  public async updateTask(id: string, dto: UpdateResponsibilityDTO): Promise<Responsibility> {
    const existing = await this.getTaskById(id);
    if (!existing) {
      throw new Error(`Responsibility with id ${id} not found`);
    }

    const updatedMetadata = {
      ...(existing.metadata || {}),
      ...(dto.metadata || {})
    };
    if (dto.action !== undefined) updatedMetadata.action = dto.action;
    if (dto.dueTime !== undefined) updatedMetadata.dueTime = dto.dueTime;
    if (dto.category !== undefined) updatedMetadata.category = dto.category;
    if (dto.sourceContext !== undefined) {
      updatedMetadata.sourceContext = {
        ...((existing.sourceContext as any) || {}),
        ...((dto.sourceContext as any) || {})
      };
    }
    if (dto.sources !== undefined) {
      updatedMetadata.sources = dto.sources;
    } else if (dto.source === 'both') {
      updatedMetadata.sources = Array.from(new Set([...(existing.sources || [existing.source]), 'gmail', 'calendar']));
    }

    const normalizedPriority = dto.priority !== undefined
      ? (dto.priority === 'urgent' || dto.priority === 'high' ? 'high' : dto.priority === 'low' ? 'low' : 'medium')
      : existing.priority;

    let updatedLifecycleStatus = existing.status;
    if (dto.status !== undefined) {
      const norm = String(dto.status).toUpperCase();
      if (norm === 'COMPLETED' || norm === 'CANCELLED' || norm === 'UPCOMING' || norm === 'DUE_TODAY' || norm === 'OVERDUE') {
        updatedLifecycleStatus = norm as any;
      } else if (norm === 'DISMISSED') {
        updatedLifecycleStatus = 'CANCELLED';
      } else if (norm === 'PENDING') {
        updatedLifecycleStatus = determineResponsibilityStatus({
          dueDate: dto.dueDate !== undefined ? dto.dueDate : existing.dueDate,
          dueTime: dto.dueTime !== undefined ? dto.dueTime : existing.dueTime,
          sourceContext: updatedMetadata.sourceContext as Record<string, unknown>
        });
      }
    } else {
      updatedLifecycleStatus = determineResponsibilityStatus({
        dueDate: dto.dueDate !== undefined ? dto.dueDate : existing.dueDate,
        dueTime: dto.dueTime !== undefined ? dto.dueTime : existing.dueTime,
        existingStatus: existing.status,
        sourceContext: updatedMetadata.sourceContext as Record<string, unknown>
      });
    }

    updatedMetadata.lifecycleStatus = updatedLifecycleStatus;

    const dbStatus = 
      updatedLifecycleStatus === 'COMPLETED'
        ? 'completed'
        : updatedLifecycleStatus === 'CANCELLED'
        ? 'dismissed'
        : 'pending';

    const updated: Responsibility = {
      ...existing,
      ...dto,
      status: updatedLifecycleStatus,
      priority: normalizedPriority,
      metadata: updatedMetadata,
      action: dto.action !== undefined ? dto.action : existing.action,
      dueTime: dto.dueTime !== undefined ? dto.dueTime : existing.dueTime,
      category: dto.category !== undefined ? dto.category : existing.category,
      source: dto.source !== undefined ? dto.source : existing.source,
      sources: (updatedMetadata.sources as any) || existing.sources,
      sourceDisplay: getSourceDisplay({ source: dto.source !== undefined ? dto.source : existing.source, sources: (updatedMetadata.sources as any) || existing.sources }),
      sourceContext: (updatedMetadata.sourceContext as any) || existing.sourceContext,
      isArchived: updatedLifecycleStatus === 'CANCELLED' ? true : (dto.isArchived !== undefined ? dto.isArchived : existing.isArchived),
      updatedAt: new Date().toISOString()
    };

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      const payload: Record<string, unknown> = {
        updated_at: updated.updatedAt
      };
      if (dto.title !== undefined) payload.title = dto.title;
      if (dto.description !== undefined) payload.description = dto.description;
      if (dto.type !== undefined) payload.type = dto.type;
      payload.priority = normalizedPriority;
      payload.status = dbStatus;
      if (dto.dueDate !== undefined) payload.due_date = dto.dueDate;
      if (dto.source !== undefined) payload.source = dto.source;
      if (dto.sourceId !== undefined) payload.source_id = dto.sourceId;
      if (dto.confidence !== undefined) payload.confidence = dto.confidence;
      if (dto.tags !== undefined) payload.tags = dto.tags;
      payload.is_archived = updated.isArchived;
      payload.metadata = updatedMetadata;

      const { data, error } = await supabase
        .from('responsibilities')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        logger.error(`Error updating responsibility ${id} in Supabase:`, error.message);
        throw error;
      }
      return this.mapSupabaseRecord(data);
    }

    this.inMemoryResponsibilities.set(id, updated);
    return updated;
  }

  public async deleteTask(id: string): Promise<void> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      const { error } = await supabase.from('responsibilities').delete().eq('id', id);
      if (error) {
        logger.error(`Error deleting responsibility ${id} in Supabase:`, error.message);
        throw error;
      }
      return;
    }

    this.inMemoryResponsibilities.delete(id);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapSupabaseRecord(record: any): Responsibility {
    const meta = record.metadata || {};
    const sources = meta.sources || (record.source === 'both' ? ['gmail', 'calendar'] : record.source ? [record.source] : ['manual']);

    // Compute dynamic lifecycle status
    const lifecycleStatus = determineResponsibilityStatus({
      dueDate: record.due_date,
      dueTime: meta.dueTime,
      existingStatus: meta.lifecycleStatus || record.status,
      isCancelled: record.status === 'dismissed' || (record.is_archived && record.status !== 'completed'),
      completionEvidence: record.status === 'completed' || meta.lifecycleStatus === 'COMPLETED',
      sourceContext: meta.sourceContext
    });

    let action = meta.action || meta.sourceContext?.nextStep || record.action || undefined;
    let title = record.title || '';

    // Requirement 5: Clean up mechanical wording like "Review calendar event 'X'"
    if (action && /review calendar event\s*['"]?([^'"]+)['"]?/i.test(action)) {
      const match = action.match(/review calendar event\s*['"]?([^'"]+)['"]?/i);
      const eventName = match ? match[1].trim() : '';
      if (/meeting|call|sync|discussion/i.test(eventName)) {
        action = `Join ${eventName}`;
      } else if (/appointment|interview|assessment|exam|test/i.test(eventName)) {
        action = `Attend ${eventName}`;
      } else {
        action = eventName ? `Attend ${eventName}` : 'Attend scheduled commitment';
      }
    }
    if (title && /^event\s*['"]([^'"]+)['"]$/i.test(title.trim())) {
      const match = title.trim().match(/^event\s*['"]([^'"]+)['"]$/i);
      if (match) title = match[1];
    }

    return {
      id: record.id,
      userId: record.user_id,
      title,
      description: record.description || undefined,
      type: record.type,
      priority: record.priority,
      status: lifecycleStatus,
      category: meta.category || record.category || 'general',
      dueDate: record.due_date || undefined,
      dueTime: meta.dueTime || undefined,
      action,
      source: record.source,
      sources,
      sourceDisplay: getSourceDisplay({ source: record.source, sources }),
      sourceId: record.source_id || undefined,
      sourceContext: meta.sourceContext || undefined,
      confidence: record.confidence ?? 1.0,
      confidenceScore: record.confidence ?? 1.0,
      tags: record.tags || [],
      metadata: { ...meta, action, lifecycleStatus, category: meta.category || record.category || 'general' },
      isArchived: record.is_archived || false,
      createdAt: record.created_at,
      updatedAt: record.updated_at
    };
  }

  /**
   * Reconciles and merges duplicate responsibilities (e.g. from both Gmail and Calendar)
   * into a single unified responsibility with source: 'both'.
   */
  private reconcileAndDeduplicate(tasks: Responsibility[]): { reconciled: Responsibility[]; duplicatesToArchive: string[] } {
    const reconciled: Responsibility[] = [];
    const duplicatesToArchive: string[] = [];

    for (const t of tasks) {
      const matchIdx = reconciled.findIndex(existing => isSameObligation(existing, t));
      if (matchIdx !== -1) {
        const existing = reconciled[matchIdx];
        const hasCal = existing.sources?.includes('calendar') || t.sources?.includes('calendar') || existing.source === 'calendar' || t.source === 'calendar';
        const hasGmail = existing.sources?.includes('gmail') || t.sources?.includes('gmail') || existing.source === 'gmail' || t.source === 'gmail';
        const isBoth = hasCal && hasGmail;

        const mergedSources = Array.from(new Set([...(existing.sources || []), ...(t.sources || [])])) as ('gmail' | 'calendar' | 'manual')[];
        const mergedSource = isBoth ? 'both' : (existing.source === 'both' ? 'both' : (t.source === 'both' ? 'both' : (existing.source || t.source)));

        // Keep richer details and natural action
        reconciled[matchIdx] = {
          ...existing,
          title: existing.title.length >= t.title.length ? existing.title : t.title,
          description: existing.description || t.description,
          action: existing.action || t.action,
          dueDate: existing.dueDate || t.dueDate,
          dueTime: existing.dueTime || t.dueTime,
          source: mergedSource,
          sources: mergedSources,
          sourceDisplay: getSourceDisplay({ source: mergedSource, sources: mergedSources }),
          sourceContext: { ...(t.sourceContext || {}), ...(existing.sourceContext || {}) }
        };

        if (t.id !== existing.id) {
          duplicatesToArchive.push(t.id);
        }
      } else {
        reconciled.push({ ...t });
      }
    }

    return { reconciled, duplicatesToArchive };
  }

  /**
   * Comprehensive underlying correction of misclassified responsibilities,
   * program schedules, events/meetings, application windows, cancelled items, and deadlines.
   */
  public correctRecord(t: Responsibility): { needsDbUpdate: boolean; updateFields: Record<string, unknown> } {
    let needsDbUpdate = false;
    const updateFields: Record<string, unknown> = {};

    const normStatus = (t.status || '').toUpperCase();
    if (normStatus === 'COMPLETED' && !t.title.toLowerCase().includes('cancelled')) {
      return { needsDbUpdate: false, updateFields };
    }

    const titleLower = (t.title || '').toLowerCase();
    const actionLower = (t.action || '').toLowerCase().trim();
    const descLower = (t.description || '').toLowerCase();
    const subLower = String(t.sourceContext?.subject || '').toLowerCase();
    const snipLower = String(t.sourceContext?.snippet || '').toLowerCase();
    const corpus = `${titleLower} ${actionLower} ${descLower} ${subLower} ${snipLower}`;

    // 1. Cancelled items:
    if (
      titleLower.includes('cancelled') ||
      titleLower.includes('canceled') ||
      actionLower.includes('cancelled') ||
      actionLower.includes('canceled') ||
      actionLower === 'no action required' ||
      subLower.includes('cancelled') ||
      subLower.includes('canceled')
    ) {
      if (t.status !== 'CANCELLED' || !t.isArchived) {
        t.status = 'CANCELLED';
        t.isArchived = true;
        updateFields.status = 'dismissed';
        updateFields.is_archived = true;
        needsDbUpdate = true;
      }
      return { needsDbUpdate, updateFields };
    }

    const hasGenuineActionDeadline = /\b(submit\s+(by|before|on|until)|submission\s+(deadline|date|by|due)|due\s+(by|on|before|date)|last\s+date(\s+of|\s+for|\s+to)?|upload\s+(before|by|on)|pay(\s+fee|\s+tuition)?\s+(before|by|on)|payment\s+deadline|apply\s+(by|before|on|until)|application\s+(deadline|due|closes?|end)|register\s+(by|before|on|until|institution)|registration\s+(deadline|closes?|end|last\s+date)|tickets?(\s+sale|\s+booking)?\s+(by|before|on|ends?|closes?|at)|purchase(\s+tickets?)?\s+(by|before|on|before)|deadline\s*:?|closing\s+date|closes?\s+on|ends?\s+on)\b/i.test(corpus);
    const hasSubmission = /\b(submit|submission|upload|pay|payment|tuition|fee|exam|viva|assessment|test|interview|apply|application|register|registration|tickets?|purchase|buy|enroll|enrolment|due\s+by|deadline|closing\s+date|last\s+date)\b/i.test(corpus);
    const isProgramSchedule = isProgramScheduleOrEventDateRange(corpus) || /\b(skill\s+development\s+program|sdp|fdp|runs?\s+from|running\s+from)\b/i.test(corpus);
    const isAppWindow = /\b(application\s+window|applications?\s+are\s+open|open\s+from\s+[a-z0-9]+\s+to|scholarship\s+application\s+window)\b/i.test(corpus) ||
      t.sourceContext?.classification === 'opportunity_window' ||
      t.sourceContext?.deadlineType === 'application_window';
    const isEventOrMeeting = (t.source === 'calendar' || t.type === 'appointment' ||
      /\b(meeting|interview|session|talk|sync|discussion|ceremony|lecture|viva|review|webinar)\b/i.test(corpus) ||
      t.sourceContext?.classification === 'event_meeting' ||
      t.sourceContext?.deadlineType === 'event_time') &&
      !hasGenuineActionDeadline;

    // Ensure category is accurately assigned
    if (!t.category || (t.category as string) === 'general') {
      let targetCat: 'work' | 'academic' | 'personal' | 'finance' | 'meeting' | null = null;
      if (/\b(intern|internship|hiring|job|unstop|placement|recruitment|core team)\b/i.test(corpus)) {
        targetCat = 'work';
      } else if (/\b(kashi|kts|nptel|exam|gate|test|course|grade|iit|university|college|academic|scholarship|hall ticket|viva|hackathon|sih)\b/i.test(corpus)) {
        targetCat = 'academic';
      } else if (/\b(sitaara|diwali|celebration|music|festival|party|volleyball|tournament|exhibition)\b/i.test(corpus)) {
        targetCat = 'personal';
      } else if (/\b(fee|tuition|payment|dues|invoice|refund)\b/i.test(corpus)) {
        targetCat = 'finance';
      } else if (isEventOrMeeting) {
        targetCat = 'meeting';
      }
      if (targetCat && targetCat !== t.category) {
        t.category = targetCat;
        if (!t.metadata) t.metadata = {};
        t.metadata.category = targetCat;
        updateFields.metadata = t.metadata;
        needsDbUpdate = true;
      }
    }

    // Guard: Cleanse invalid windowStartDate / windowEndDate that were improperly set to email receivedAt or messageId dates
    const receivedAt = (t.sourceContext?.receivedAt as string) || '';
    if (t.sourceContext?.windowStartDate && receivedAt) {
      const winStartDay = (t.sourceContext.windowStartDate as string).split('T')[0];
      const recDay = receivedAt.split('T')[0];
      if (winStartDay === recDay && !hasSubmission) {
        delete t.sourceContext.windowStartDate;
        if (!t.metadata) t.metadata = {};
        if (t.metadata.sourceContext) {
          delete (t.metadata.sourceContext as any).windowStartDate;
        }
        updateFields.metadata = t.metadata;
        needsDbUpdate = true;
      }
    }

    // 2. Program schedules (e.g. SDP running from 13th to 17th)
    if (isProgramSchedule && !hasSubmission) {
      if (t.dueDate) {
        t.dueDate = undefined;
        t.dueTime = undefined;
        t.priority = 'low';
        updateFields.due_date = null;
        updateFields.priority = 'low';
        if (!t.metadata) t.metadata = {};
        t.metadata.dueTime = null;
        updateFields.metadata = t.metadata;
        needsDbUpdate = true;
      }
      if (!t.sourceContext) t.sourceContext = {};
      if (t.sourceContext.classification !== 'program_schedule' || t.sourceContext.deadlineType !== 'program_duration') {
        t.sourceContext.classification = 'program_schedule';
        t.sourceContext.deadlineType = 'program_duration';
        if (!t.metadata) t.metadata = {};
        t.metadata.sourceContext = t.sourceContext;
        t.metadata.classification = 'program_schedule';
        t.metadata.deadlineType = 'program_duration';
        updateFields.metadata = t.metadata;
        needsDbUpdate = true;
      }
    } else if (isAppWindow) {
      // 3. Application window
      if (!t.sourceContext) t.sourceContext = {};
      // If there is no genuine submission deadline, do not invent or keep a due_date
      if (!hasSubmission && !t.sourceContext.windowEndDate && t.dueDate) {
        t.dueDate = undefined;
        t.dueTime = undefined;
        t.priority = 'low';
        updateFields.due_date = null;
        updateFields.priority = 'low';
        if (!t.metadata) t.metadata = {};
        t.metadata.dueTime = null;
        updateFields.metadata = t.metadata;
        needsDbUpdate = true;
      }
      if (t.sourceContext.classification !== 'opportunity_window' || t.sourceContext.deadlineType !== 'application_window') {
        t.sourceContext.classification = 'opportunity_window';
        t.sourceContext.deadlineType = 'application_window';
        if (!t.metadata) t.metadata = {};
        t.metadata.sourceContext = t.sourceContext;
        t.metadata.classification = 'opportunity_window';
        t.metadata.deadlineType = 'application_window';
        updateFields.metadata = t.metadata;
        needsDbUpdate = true;
      }
    } else if (isEventOrMeeting) {
      // 4. Event / Meeting
      t.type = 'appointment';
      if (!t.sourceContext) t.sourceContext = {};
      if (t.sourceContext.classification !== 'event_meeting' || t.sourceContext.deadlineType !== 'event_time') {
        t.sourceContext.classification = 'event_meeting';
        t.sourceContext.deadlineType = 'event_time';
        if (!t.metadata) t.metadata = {};
        t.metadata.sourceContext = t.sourceContext;
        t.metadata.classification = 'event_meeting';
        t.metadata.deadlineType = 'event_time';
        updateFields.metadata = t.metadata;
        needsDbUpdate = true;
      }
    } else if (
      !hasSubmission &&
      /\b(circular|timetable|room\s+allotment|newsletter|weekly\s+digest|audition\s+call|auditions?\s+for|open\s+auditions?|invitation\s+to\s+attend)\b/i.test(corpus)
    ) {
      // 5. Informational circulars/announcements without submission
      if (t.dueDate) {
        t.dueDate = undefined;
        t.dueTime = undefined;
        t.priority = 'low';
        updateFields.due_date = null;
        updateFields.priority = 'low';
        if (!t.metadata) t.metadata = {};
        t.metadata.dueTime = null;
        updateFields.metadata = t.metadata;
        needsDbUpdate = true;
      }
      if (!t.sourceContext) t.sourceContext = {};
      t.sourceContext.classification = 'informational';
      t.sourceContext.deadlineType = 'none';
      if (!t.metadata) t.metadata = {};
      t.metadata.sourceContext = t.sourceContext;
      t.metadata.classification = 'informational';
      t.metadata.deadlineType = 'none';
      updateFields.metadata = t.metadata;
      needsDbUpdate = true;
    } else {
      // 6. Actionable deadline
      if (!t.sourceContext) t.sourceContext = {};
      if (t.dueDate && (hasGenuineActionDeadline || hasSubmission)) {
        if (t.sourceContext.classification !== 'action_required' || t.sourceContext.deadlineType !== 'strict_deadline') {
          t.sourceContext.classification = 'action_required';
          t.sourceContext.deadlineType = 'strict_deadline';
          t.type = 'deadline';
          if (!t.metadata) t.metadata = {};
          t.metadata.sourceContext = t.sourceContext;
          t.metadata.classification = 'action_required';
          t.metadata.deadlineType = 'strict_deadline';
          updateFields.metadata = t.metadata;
          needsDbUpdate = true;
        }
      } else if (!t.sourceContext.classification) {
        t.sourceContext.classification = 'informational';
        t.sourceContext.deadlineType = 'none';
        if (!t.metadata) t.metadata = {};
        t.metadata.sourceContext = t.sourceContext;
        t.metadata.classification = 'informational';
        t.metadata.deadlineType = 'none';
        updateFields.metadata = t.metadata;
        needsDbUpdate = true;
      }
    }

    // Dynamic lifecycle status recalculation
    const dynamicStatus = determineResponsibilityStatus({
      dueDate: t.dueDate,
      dueTime: t.dueTime,
      existingStatus: t.status,
      sourceContext: t.sourceContext as any
    });
    if (dynamicStatus !== t.status) {
      t.status = dynamicStatus;
      const dbStatus = dynamicStatus === 'COMPLETED' ? 'completed' : dynamicStatus === 'CANCELLED' ? 'dismissed' : 'pending';
      updateFields.status = dbStatus;
      if (!t.metadata) t.metadata = {};
      t.metadata.lifecycleStatus = dynamicStatus;
      updateFields.metadata = t.metadata;
      needsDbUpdate = true;
    }

    // Dynamic priority update
    if (t.dueDate) {
      const latestPriority = determineIntelligentPriority({
        title: t.title,
        description: t.description,
        action: t.action,
        dueDate: t.dueDate,
        dueTime: t.dueTime,
        category: t.category,
        sourceType: t.source,
        sourceContext: t.sourceContext as any,
        existingPriority: t.priority
      });

      if (latestPriority !== t.priority) {
        t.priority = latestPriority;
        updateFields.priority = latestPriority;
        needsDbUpdate = true;
      }
    }

    return { needsDbUpdate, updateFields };
  }
}

export const taskService = new TaskService();
