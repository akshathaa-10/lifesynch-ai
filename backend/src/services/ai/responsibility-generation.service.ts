import { 
  Responsibility, 
  ResponsibilitySyncSummary, 
  ExtractedTasksList, 
  ExtractedTasksListSchema,
  ExtractedTask,
  TaskCategory,
  TaskSourceType,
  normalizeRawExtractedTasks
} from '@lifesynch/shared';
import { env } from '../../config/env';
import { emailService } from '../db/email.service';
import { calendarEventService } from '../db/calendar-event.service';
import { taskService } from '../task.service';
import { logger } from '../../utils/logger';
import { AppError } from '../../middlewares/error.middleware';
import { 
  isSameObligation, 
  mergeResponsibilityData, 
  deduplicateExtractedBatch, 
  normalizePriority,
  determineIntelligentPriority,
  isInformationalEmailNotResponsibility,
  sanitizeTaskDeadline
} from './responsibility-matcher';

export class ResponsibilityGenerationService {
  /**
   * Invokes the configured LLM (Gemini / Groq / OpenAI) to extract structured actionable responsibilities.
   */
  public async callLLM(prompt: string): Promise<string> {
    const apiKey = env.LLM_API_KEY;
    if (!apiKey) {
      throw new AppError(
        'LLM_API_KEY is not configured in backend/.env. Please provide your Gemini API key (LLM_API_KEY=AIzaSy...) in backend/.env.',
        400,
        'LLM_CONFIG_MISSING'
      );
    }

    const provider = env.LLM_PROVIDER || 'gemini';
    const model = env.LLM_MODEL || 'gemini-flash-lite-latest';

    logger.info(`Invoking LLM for responsibility extraction using provider: ${provider}, model: ${model}`);

    if (provider === 'gemini') {
      const candidateModels = Array.from(new Set([
        model,
        'gemini-flash-lite-latest',
        'gemini-2.5-flash',
        'gemini-flash-latest',
        'gemini-3.5-flash-lite',
        'gemini-3.1-flash-lite',
        'gemini-3-flash-preview',
        'gemini-3.5-flash'
      ]));

      let lastErrorText = '';
      for (const m of candidateModels) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
        const payload = {
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            response_mime_type: 'application/json',
            temperature: 0.1
          }
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const json = await res.json() as any;
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            return text;
          }
        } else {
          lastErrorText = await res.text();
          logger.warn(`Gemini model ${m} returned HTTP ${res.status}: ${lastErrorText.substring(0, 120)}`);
          // Retry on 404 (not found), 429 (rate limit), 503 (high demand), 500
          if (res.status !== 404 && res.status !== 429 && res.status !== 503 && res.status !== 500) {
            throw new AppError(`Google Gemini API request failed (${res.status}): ${lastErrorText}`, 502, 'LLM_API_ERROR');
          }
        }
      }

      logger.error(`All Gemini model candidates failed. Last error: ${lastErrorText}`);
      throw new AppError(`Google Gemini API request failed: ${lastErrorText}`, 502, 'LLM_API_ERROR');
    } else {
      // OpenAI / Groq compatible endpoint
      const baseUrl = provider === 'groq' 
        ? 'https://api.groq.com/openai/v1/chat/completions'
        : 'https://api.openai.com/v1/chat/completions';

      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: 'You are LifeSynch AI digital life management engine. Extract actionable responsibilities in strict JSON format.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        logger.error(`${provider} API error (HTTP ${res.status}): ${errText}`);
        throw new AppError(`${provider} API request failed: ${res.status} ${res.statusText}`, 502, 'LLM_API_ERROR');
      }

      const json = await res.json() as any;
      const content = json.choices?.[0]?.message?.content;
      if (!content) {
        throw new AppError(`${provider} returned an empty response.`, 502, 'LLM_EMPTY_RESPONSE');
      }
      return content;
    }
  }

  /**
   * Generates actionable responsibilities from the authenticated user's real Gmail emails and Calendar events.
   * Performs cross-source intelligence, deduplication, and idempotent updates.
   */
  public async generateResponsibilities(userId: string): Promise<ResponsibilitySyncSummary> {
    logger.info(`Starting AI Responsibility Generation for user: ${userId}`);

    // 1. Fetch real Gmail emails stored in Supabase (strictly scoped to authenticated user)
    const emails = await emailService.getEmails(userId, 50);
    logger.info(`Retrieved ${emails.length} emails for user ${userId} for AI analysis`);

    // 2. Fetch real Google Calendar events stored in Supabase (strictly scoped to authenticated user)
    const calendarEvents = await calendarEventService.getEvents(userId, 50);
    logger.info(`Retrieved ${calendarEvents.length} calendar events for user ${userId} for AI analysis`);

    // 3. Fetch all existing responsibilities (including completed/archived) for deduplication (strictly scoped to authenticated user)
    const existingResponsibilities = await taskService.getAllTasksForUser(userId);

    if (emails.length === 0 && calendarEvents.length === 0) {
      logger.info(`No emails or calendar events found for user ${userId}. Skipping AI generation.`);
      return {
        generated: 0,
        updated: 0,
        skipped: 0,
        totalResponsibilities: existingResponsibilities.filter(r => !r.isArchived).length
      };
    }

    // 4. Construct structured prompt with intelligent cross-source instructions
    // Group and sort emails so that threads are ordered chronologically together
    const emailSummaries = [...emails]
      .sort((a, b) => {
        const threadCmp = (a.threadId || '').localeCompare(b.threadId || '');
        if (threadCmp !== 0) return threadCmp;
        return (a.receivedAt || '').localeCompare(b.receivedAt || '');
      })
      .slice(0, 40)
      .map(e => ({
        messageId: e.messageId,
        threadId: e.threadId,
        sender: e.sender,
        recipient: e.recipient,
        subject: e.subject,
        snippet: e.snippet,
        bodyText: e.bodyText ? e.bodyText.substring(0, 1500) : '',
        receivedAt: e.receivedAt
      }));

    const existingSummaries = existingResponsibilities
      .filter(r => !r.isArchived)
      .map(r => ({
        id: r.id,
        title: r.title,
        dueDate: r.dueDate,
        dueTime: r.dueTime,
        priority: r.priority,
        action: r.action,
        status: r.status,
        source: r.source,
        sourceId: r.sourceId
      }));

    const calendarSummaries = calendarEvents.map(c => ({
      eventId: c.eventId,
      summary: c.summary,
      description: c.description ? c.description.substring(0, 300) : '',
      location: c.location,
      startTime: c.startTime,
      endTime: c.endTime,
      status: c.status
    }));

    // Handle cancelled source calendar events: update existing responsibilities to CANCELLED
    for (const c of calendarEvents) {
      const isCancelledEvent = 
        c.status === 'cancelled' ||
        c.summary.toLowerCase().startsWith('canceled:') ||
        c.summary.toLowerCase().startsWith('cancelled:');

      if (isCancelledEvent) {
        const cleanSummary = c.summary.replace(/^(canceled|cancelled):\s*/i, '');
        const matchingResp = existingResponsibilities.find(r => 
          r.sourceId === c.eventId || 
          (r.sourceContext as any)?.calendarEventId === c.eventId ||
          isSameObligation(r, {
            title: cleanSummary,
            dueDate: c.startTime,
            sourceId: c.eventId,
            sourceType: 'calendar',
            sourceContext: { calendarEventId: c.eventId }
          })
        );
        if (matchingResp && matchingResp.status !== 'CANCELLED') {
          logger.info(`Source calendar event ${c.eventId} was cancelled. Marking responsibility "${matchingResp.title}" as CANCELLED.`);
          await taskService.updateTask(matchingResp.id, {
            status: 'CANCELLED',
            isArchived: true
          });
          matchingResp.status = 'CANCELLED';
          matchingResp.isArchived = true;
        }
      }
    }

    // Cleanse existing stored responsibilities:
    // Informational emails that were previously given false deadlines (e.g. program dates like SDP running 13th-17th)
    // must have their deadlines unset so they do not linger in active overdue sections.
    for (const r of existingResponsibilities) {
      if (r.source === 'gmail' && r.dueDate && !r.isArchived) {
        const sanitized = sanitizeTaskDeadline({
          title: r.title,
          action: r.action,
          description: r.description,
          dueDate: r.dueDate,
          dueTime: r.dueTime,
          type: r.type,
          sourceType: r.source,
          sourceContext: r.sourceContext as any
        });

        if (sanitized.isInformationalDate || isInformationalEmailNotResponsibility({
          title: r.title,
          action: r.action,
          description: r.description,
          sourceType: r.source,
          sourceContext: r.sourceContext as any
        })) {
          logger.info(`Cleansing false deadline on existing informational responsibility "${r.title}" (${r.id})`);
          r.dueDate = undefined;
          r.dueTime = undefined;
          r.priority = 'low';
          await taskService.updateTask(r.id, {
            dueDate: undefined,
            dueTime: undefined,
            priority: 'low'
          }).catch(err => logger.warn(`Failed to cleanse deadline for task ${r.id}:`, err));
        }
      }
    }

    const prompt = `
You are the AI extraction engine for "LifeSynch AI" — a personal digital life management system.
Analyze the user's real stored Gmail messages and Google Calendar events.

Your goal is to extract REAL, MEANINGFUL obligations, responsibilities, deadlines, and appointments.

CRITICAL EXTRACTION & CLASSIFICATION RULES:
1. REAL DATA ONLY: Work strictly with the provided Gmail messages and Google Calendar events. Do NOT invent items.
2. UNDERSTAND ACTUAL EMAIL MEANING, PURPOSE & ACTION OWNERSHIP:
   - For each email, analyze the subject, full body, sender, recipient, conversation thread, and attachments.
   - Intended Audience & Action Ownership:
     * Determine whether the user is ACTUALLY expected to take personal action.
     * If an email is addressed to someone else, assigned to a colleague or team ("Sarah will handle", "team to review"), or is a broadcast circular/newsletter, user action is NOT required. Set "actionRequired": false, "responsibleParty": "other" or "unassigned".
     * If the email is an automated receipt, order update, system alert, or delivery confirmation, user action is NOT required.
   - Classify each item accurately into "classification":
     * "action_required": User must take a genuine action (submit, apply, register, pay, send, prepare, respond).
     * "opportunity_window": Opening dates, closing dates, or application window. Distinguish opening dates, closing dates, and submission deadline. Set "deadlineType": "application_window".
     * "event_meeting": Meeting, review, viva, appointment, or session. Retain actual date, time, and duration when available. Set "deadlineType": "event_time".
     * "program_schedule": Describes when an activity or program runs (e.g. "The SDP program will run from the 13th to the 17th"). This is PROGRAM DURATION, NOT A SUBMISSION DEADLINE. Set "dueDate": null, "dueTime": null, "actionRequired": false, "deadlineType": "program_duration".
     * "informational": General announcements, club notices (e.g. club auditions, orientation sessions), newsletters, circulars. Set "actionRequired": false, "deadlineType": "none".
     * "ambiguous": If meaning, ownership, or deadline is uncertain or conflicting, preserve uncertainty rather than inventing a task or deadline. Set "actionRequired": false.
   - Explicit Classification Guidance & Examples:
     * "Submit your application by October 25" -> genuine deadline on October 25 (classification: "action_required", deadlineType: "strict_deadline").
     * "The skill development program runs from October 25 to October 30" -> program schedule, NOT a deadline on October 25 (classification: "program_schedule", deadlineType: "program_duration", dueDate: null).
     * "Attend a meeting on October 25 at 3 PM" -> calendar commitment / meeting, NOT a submission deadline (classification: "event_meeting", deadlineType: "event_time").
     * "Applications are open from October 25 to October 30" -> application window, not automatically a task deadline (classification: "opportunity_window", deadlineType: "application_window").
     * Never treat every date as a deadline. Do not create urgent responsibilities from announcements or participation reminders unless the email genuinely requires an action from the user. Never invent missing dates, actions, or deadlines.
   - Do NOT create responsibilities simply because an email contains an imperative sentence, a date, or mentions an event.
3. EMAIL THREADS & FOLLOW-UP MESSAGES:
   - Messages sharing a "threadId" are part of the same conversation.
   - Later messages in a thread update earlier messages. If a follow-up email extends a deadline, postpones a meeting, or cancels an event, output the updated obligation reflecting the final state.
4. DEADLINES & DATE/TIME EXTRACTION (NEVER INVENT DATES OR TIMES):
   - Extract a deadline ONLY when the source clearly supports that interpretation (e.g. "submit by", "deadline:", "last date to apply", "due on").
   - Program schedules and date ranges (e.g. "running from 13th to 17th") are NOT submission deadlines. Set "dueDate": null and "dueTime": null.
   - Exact deadline: If both a specific date and time are provided for a genuine submission, set "dueDate" to the ISO 8601 string and set "dueTime" to "HH:MM" (24-hour).
   - Date without time: If an explicit deadline date is provided with no time, set "dueDate" to that date and "dueTime": null. NEVER invent a fictional time.
   - All-day Calendar events: Set "dueDate" to the event date and "dueTime": null.
   - No known deadline: Set "dueDate": null and "dueTime": null. NEVER guess or hallucinate a deadline.
5. CONCISE NEXT STEP & NATURAL WORDING:
   - Provide a clear, concise "nextStep" explaining what the user should do next (e.g. "Submit final term paper on LMS", "Upload document on portal before 5 PM").
   - For events, use natural phrasing: "Attend [event]", "Join [meeting]".
6. GMAIL + CALENDAR RECONCILIATION:
   If a Gmail message and a Calendar event refer to the same obligation, combine them into ONE single responsibility with "sourceType": "both", "sources": ["gmail", "calendar"].
7. DEADLINE URGENCY & PRIORITY:
   - Due today / due tomorrow (<= 48 hours away): High urgency -> 'high' priority.
   - Due later (within 3-7 days): Medium urgency -> 'medium' priority (or 'high' if high-stakes obligation like exam, viva, placement).
   - Due much later (> 14 days): Lower urgency -> 'low' priority.
   - No deadline: Priority based on obligation importance.
8. CATEGORY: Exactly one of: 'academic', 'work', 'personal', 'finance', 'meeting', 'deadline', 'general'.

SOURCES:
GOOGLE CALENDAR EVENTS (${calendarSummaries.length} items):
${JSON.stringify(calendarSummaries, null, 2)}

GMAIL EMAILS (${emailSummaries.length} items):
${JSON.stringify(emailSummaries, null, 2)}

EXISTING USER RESPONSIBILITIES (${existingSummaries.length} items):
${JSON.stringify(existingSummaries, null, 2)}

OUTPUT SCHEMA (Must be valid JSON):
{
  "tasks": [
    {
      "title": "Short, clear title",
      "description": "Context and summary",
      "category": "academic | work | personal | finance | meeting | deadline | general",
      "type": "task | deadline | appointment | reminder | other",
      "priority": "high | medium | low",
      "action": "Specific action the user must take",
      "classification": "action_required | opportunity_window | event_meeting | program_schedule | informational | ambiguous",
      "responsibleParty": "user | other | unassigned",
      "deadlineType": "strict_deadline | application_window | event_time | program_duration | none",
      "nextStep": "Concise recommended next action",
      "windowStartDate": "ISO string or null",
      "windowEndDate": "ISO string or null",
      "dueDate": "ISO 8601 string or null if not specified",
      "dueTime": "HH:MM (24-hour) or null if not specified",
      "confidence": 0.85,
      "sourceType": "gmail | calendar | both",
      "sources": ["gmail", "calendar"],
      "sourceId": "corresponding messageId or eventId",
      "secondarySourceId": "if combining email and calendar event, the other ID, else null",
      "tags": ["tag1", "tag2"],
      "actionRequired": true,
      "reasoning": "Why this represents an actionable responsibility"
    }
  ],
  "hasActionableContent": true,
  "summary": "Brief summary of findings"
}
`;

    // 5. Call LLM
    const rawResponse = await this.callLLM(prompt);

    // 6. Parse and Validate structured output
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawResponse);
    } catch (parseErr) {
      logger.error('Failed to parse LLM response as JSON. Error:', (parseErr as Error).message);
      throw new AppError('AI model returned an unparseable response format.', 502, 'LLM_PARSE_ERROR');
    }

    // Small, safe normalization step before schema validation to map known type variations
    const normalizedJson = normalizeRawExtractedTasks(parsedJson);

    const validationResult = ExtractedTasksListSchema.safeParse(normalizedJson);
    if (!validationResult.success) {
      const safeDiagnostics = validationResult.error.issues.map(issue => ({
        path: issue.path.join('.'),
        code: issue.code,
        message: issue.message
      }));
      logger.warn('LLM output failed Zod schema validation after normalization:', safeDiagnostics);
      throw new AppError('AI model output did not match required responsibility schema.', 502, 'LLM_SCHEMA_INVALID');
    }

    const extractedList: ExtractedTasksList = validationResult.data;
    logger.info(`AI identified ${extractedList.tasks.length} actionable responsibilities from user data.`);

    // 7. Deduplicate within the newly extracted batch itself
    const deduplicatedTasks = deduplicateExtractedBatch(extractedList.tasks);
    logger.info(`After intra-batch deduplication: ${deduplicatedTasks.length} distinct responsibilities`);

    let generated = 0;
    let updated = 0;
    let skipped = extractedList.tasks.length - deduplicatedTasks.length;

    // 8. Match and Deduplicate against existing stored responsibilities
    for (const extracted of deduplicatedTasks) {
      // Priority Intelligence: strictly do not create responsibilities for ordinary informational emails,
      // but keep useful future events, programs, and application windows in Upcoming Commitments
      const isUsefulEventOrOpportunity = 
        extracted.classification === 'program_schedule' ||
        extracted.classification === 'opportunity_window' ||
        extracted.classification === 'event_meeting';

      const actionText = (extracted.action || '').toLowerCase().trim();
      const isInformationalOnly = 
        (!extracted.actionRequired && !isUsefulEventOrOpportunity) || 
        extracted.responsibleParty === 'other' ||
        extracted.classification === 'informational' ||
        extracted.classification === 'ambiguous' ||
        ((actionText === '' || 
          actionText === 'none' || 
          actionText === 'n/a' || 
          actionText.startsWith('no action') || 
          actionText.includes('no action required') || 
          actionText.includes('informational only')) && !isUsefulEventOrOpportunity);

      if (
        isInformationalOnly ||
        (!isUsefulEventOrOpportunity && isInformationalEmailNotResponsibility({
          title: extracted.title,
          action: extracted.action,
          description: extracted.description,
          reasoning: extracted.reasoning,
          sourceType: extracted.sourceType
        }))
      ) {
        logger.info(`Skipping informational/non-actionable/other-party item: "${extracted.title}"`);
        skipped++;
        continue;
      }

      // Sanitize deadlines: program schedules and event dates from email must NOT be treated as submission deadlines
      const sanitized = sanitizeTaskDeadline({
        title: extracted.title,
        action: extracted.action,
        description: extracted.description,
        dueDate: extracted.dueDate,
        dueTime: extracted.dueTime,
        type: extracted.type,
        sourceType: extracted.sourceType
      });

      if (sanitized.isInformationalDate || extracted.classification === 'program_schedule') {
        logger.info(`Unsetting false deadline on program/event information item "${extracted.title}"`);
        extracted.dueDate = null;
        extracted.dueTime = null;
      }

      // Check if an existing responsibility matches by sourceId or by cross-source semantic similarity + date
      const existingMatch = existingResponsibilities.find(existing =>
        isSameObligation(
          {
            title: existing.title,
            dueDate: existing.dueDate,
            sourceId: existing.sourceId,
            secondarySourceId: (existing as any).secondarySourceId || existing.secondarySourceId,
            sourceType: existing.source,
            sourceContext: existing.sourceContext as any
          } as any,
          {
            title: extracted.title,
            dueDate: extracted.dueDate,
            sourceId: extracted.sourceId,
            secondarySourceId: extracted.secondarySourceId,
            sourceType: extracted.sourceType,
            sourceContext: {
              calendarEventId: extracted.sourceType === 'calendar' 
                ? extracted.sourceId 
                : (extracted.sourceType === 'both' ? (extracted.secondarySourceId || extracted.sourceId) : undefined),
              messageId: extracted.sourceType === 'gmail' 
                ? extracted.sourceId 
                : (extracted.sourceType === 'both' ? (extracted.sourceId || extracted.secondarySourceId) : undefined)
            }
          } as any
        )
      );

      // Prepare context from real stored emails and calendar events
      const sourceContext: any = {};
      if (extracted.sourceType === 'gmail' || extracted.sourceType === 'both') {
        const msgId = extracted.sourceType === 'gmail' ? extracted.sourceId : (extracted.sourceId || extracted.secondarySourceId);
        const matchingEmail = emails.find(e => e.messageId === msgId) 
          || (extracted.secondarySourceId ? emails.find(e => e.messageId === extracted.secondarySourceId) : undefined);
        if (matchingEmail) {
          sourceContext.sender = matchingEmail.sender;
          sourceContext.subject = matchingEmail.subject;
          sourceContext.receivedAt = matchingEmail.receivedAt;
          sourceContext.messageId = matchingEmail.messageId;
        }
      }
      if (extracted.sourceType === 'calendar' || extracted.sourceType === 'both') {
        const evtId = extracted.sourceType === 'calendar' ? extracted.sourceId : (extracted.secondarySourceId || extracted.sourceId);
        const matchingCal = calendarEvents.find(c => c.eventId === evtId)
          || (extracted.sourceId ? calendarEvents.find(c => c.eventId === extracted.sourceId) : undefined);
        if (matchingCal) {
          sourceContext.calendarEventId = matchingCal.eventId;
          sourceContext.location = matchingCal.location;
        }
      }

      if (existingMatch) {
        // Requirement 4: Do not repeatedly recreate responsibilities that are already completed or cancelled
        if (
          existingMatch.status === 'COMPLETED' || 
          existingMatch.status === 'CANCELLED' || 
          existingMatch.status === 'completed' || 
          existingMatch.status === 'dismissed' || 
          existingMatch.isArchived
        ) {
          logger.info(`Responsibility "${existingMatch.title}" (${existingMatch.id}) is already ${existingMatch.status || 'archived'}. Not recreating or reopening.`);
          skipped++;
          continue;
        }

        // Check if incoming source update indicates the obligation was cancelled
        const isCancelledInSource = 
          extracted.title.toLowerCase().includes('cancelled') || 
          extracted.action.toLowerCase().includes('cancelled') || 
          (sourceContext.subject || '').toLowerCase().includes('cancelled');

        if (isCancelledInSource) {
          logger.info(`Source notice indicates cancellation for "${existingMatch.title}". Updating status to CANCELLED.`);
          await taskService.updateTask(existingMatch.id, {
            status: 'CANCELLED',
            isArchived: true
          });
          updated++;
          continue;
        }

        // Requirement 3: Update existing responsibility with changed source info (e.g. Sept 28 -> Sept 30)
        const merged = mergeResponsibilityData(existingMatch, extracted);

        await taskService.updateTask(existingMatch.id, {
          title: merged.title,
          description: merged.description,
          action: merged.action,
          dueTime: merged.dueTime,
          dueDate: merged.dueDate,
          priority: merged.priority,
          category: (extracted.category as TaskCategory) || existingMatch.category,
          source: merged.source,
          sources: merged.sources,
          sourceContext: { ...((existingMatch.sourceContext as any) || {}), ...sourceContext, ...merged.sourceContext },
          confidence: merged.confidence,
          tags: merged.tags
        });
        updated++;
      } else {
        // Create new responsibility with normalized priority, deadline, and sources
        let validDueDate: string | undefined = undefined;
        if (extracted.dueDate) {
          const parsedDate = new Date(extracted.dueDate);
          if (!isNaN(parsedDate.getTime())) {
            validDueDate = parsedDate.toISOString();
          }
        }

        let validDueTime: string | undefined = undefined;
        if (extracted.dueTime && /^\d{1,2}:\d{2}$/.test(extracted.dueTime.trim())) {
          validDueTime = extracted.dueTime.trim();
        }

        const sources: TaskSourceType[] = extracted.sourceType === 'both' 
          ? ['gmail', 'calendar'] 
          : [extracted.sourceType as TaskSourceType];

        if (extracted.classification) sourceContext.classification = extracted.classification;
        if (extracted.deadlineType) sourceContext.deadlineType = extracted.deadlineType;
        if (extracted.responsibleParty) sourceContext.responsibleParty = extracted.responsibleParty;
        if (extracted.nextStep) sourceContext.nextStep = extracted.nextStep;
        if (extracted.windowStartDate) sourceContext.windowStartDate = extracted.windowStartDate;
        if (extracted.windowEndDate) sourceContext.windowEndDate = extracted.windowEndDate;

        const finalPriority = determineIntelligentPriority({
          title: extracted.title,
          description: extracted.description,
          action: extracted.action,
          dueDate: validDueDate,
          dueTime: validDueTime,
          category: (extracted.category as string) || 'general',
          sourceType: extracted.sourceType as TaskSourceType,
          sourceContext,
          aiSuggestedPriority: extracted.priority
        });

        await taskService.createTask(userId, {
          title: extracted.title,
          description: extracted.description,
          action: extracted.action,
          dueTime: validDueTime,
          type: extracted.type || 'task',
          priority: finalPriority,
          category: (extracted.category as TaskCategory) || 'general',
          dueDate: validDueDate,
          source: extracted.sourceType as TaskSourceType,
          sources,
          sourceId: extracted.sourceId,
          sourceContext,
          confidence: extracted.confidence ?? 0.85,
          tags: extracted.tags || []
        });
        generated++;
      }
    }

    const currentResponsibilities = await taskService.getTasks(userId);

    logger.info(
      `AI Responsibility Generation completed for user ${userId}: generated ${generated}, updated ${updated}, skipped ${skipped}`
    );

    return {
      generated,
      updated,
      skipped,
      totalResponsibilities: currentResponsibilities.length
    };
  }
}

export const responsibilityGenerationService = new ResponsibilityGenerationService();
