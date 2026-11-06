import { 
  ChatMessage, 
  Responsibility, 
  CalendarEventRecord, 
  EmailRecord,
  SourceMetadata,
  ClassifiedLifeItem,
  IntelligentDiscovery,
  aggregateAndClassifyAll,
  groupCategoryItemsBySections,
  generateIntelligentDiscoveries,
  classifyItemSection
} from '@lifesynch/shared';
import { env } from '../../config/env';
import { taskService } from '../task.service';
import { emailService } from '../db/email.service';
import { calendarEventService } from '../db/calendar-event.service';
import { accountService } from '../db/account.service';
import { syncStateService } from '../db/sync-state.service';
import { autoSyncService } from '../auto-sync.service';
import { logger } from '../../utils/logger';
import { 
  isProgramScheduleOrEventDateRange, 
  isInformationalEmailNotResponsibility 
} from './responsibility-matcher';

export type AssistantIntent =
  | 'prioritization'
  | 'overdue'
  | 'passed'
  | 'upcoming_deadlines'
  | 'upcoming_events'
  | 'calendar_schedule'
  | 'meeting_lookup'
  | 'opportunities'
  | 'academic_updates'
  | 'today_overview'
  | 'focus_tomorrow'
  | 'week_schedule'
  | 'pending_applications'
  | 'placement_updates'
  | 'internship_updates'
  | 'email_summary'
  | 'email_explanation'
  | 'email_action_check'
  | 'specific_lookup'
  | 'priority_rationale'
  | 'follow_up'
  | 'ambiguous'
  | 'general';

export interface ClassificationResult {
  intent: AssistantIntent;
  targetEntity?: string;
  subType?: 'tomorrow_only' | 'highest_single' | 'actionable_only' | 'why_priority' | 'today_only' | 'this_week' | 'next_week' | 'events_only' | 'tasks_only' | 'all';
  targetEmail?: EmailRecord;
  targetDiscovery?: IntelligentDiscovery;
  matchedRecords?: {
    tasks: Responsibility[];
    emails: EmailRecord[];
    calendarEvents: CalendarEventRecord[];
  };
}

export interface FilteredAssistantData {
  prioritizedTasks?: Responsibility[];
  yourDayItems?: Array<ClassifiedLifeItem & { formattedScheduleText: string }>;
  overdueTasks?: Responsibility[];
  passedItems?: Array<ClassifiedLifeItem & { formattedScheduleText: string }>;
  upcomingTasks?: Responsibility[];
  upcomingItems?: Array<ClassifiedLifeItem & { formattedScheduleText: string }>;
  upcomingEvents?: CalendarEventRecord[];
  todayTasks?: Responsibility[];
  todayEvents?: CalendarEventRecord[];
  tomorrowTasks?: Responsibility[];
  tomorrowEvents?: CalendarEventRecord[];
  tomorrowItems?: Array<ClassifiedLifeItem & { formattedScheduleText: string }>;
  weekTasks?: Responsibility[];
  weekEvents?: CalendarEventRecord[];
  pendingApplications?: Responsibility[];
  placementEmails?: EmailRecord[];
  placementTasks?: Responsibility[];
  internshipEmails?: EmailRecord[];
  internshipTasks?: Responsibility[];
  academicItems?: Array<ClassifiedLifeItem & { formattedScheduleText: string }>;
  careerItems?: Array<ClassifiedLifeItem & { formattedScheduleText: string }>;
  opportunityTasks?: Responsibility[];
  opportunityEmails?: EmailRecord[];
  opportunityDiscoveries?: IntelligentDiscovery[];
  actionableEmails?: EmailRecord[];
  informationalEmails?: EmailRecord[];
  targetEmail?: EmailRecord;
  targetDiscovery?: IntelligentDiscovery;
  matchedTasks?: Responsibility[];
  matchedEmails?: EmailRecord[];
  matchedEvents?: CalendarEventRecord[];
  integrationNotice?: string;
}

export interface TemporalContext {
  timeZone: string;
  todayStr: string;
  tomorrowStr: string;
  currentTimeStr: string;
  currentIso: string;
  thisWeekStartStr: string;
  thisWeekEndStr: string;
  nextWeekStartStr: string;
  nextWeekEndStr: string;
  readableDate: string;
  readableTime: string;
}

export interface IntegrationStatus {
  hasGoogleAccount: boolean;
  isTokenExpired: boolean;
  gmailStatus: 'active' | 'disconnected' | 'error' | 'syncing';
  calendarStatus: 'active' | 'disconnected' | 'error' | 'syncing';
  gmailLastSyncedAt?: string | null;
  calendarLastSyncedAt?: string | null;
  errorMessage?: string | null;
}

export class AssistantService {
  /**
   * Normalizes raw user input, correcting common typos in domain keywords.
   */
  public normalizeQuery(raw: string): string {
    let q = raw.toLowerCase().trim();
    q = q.replace(/[?!.,;]+/g, ' ');
    
    const typoMap: Array<[RegExp, string]> = [
      [/\b(internshps?|internshps|intrnships?|internshp|intrn)\b/g, 'internship'],
      [/\b(oppurtunit(y|ies)|opertunit(y|ies)|oppertunit(y|ies)|oppurtunity)\b/g, 'opportunity'],
      [/\b(deadl(i?)ne|deadlnes|dedlines?|dedline)\b/g, 'deadline'],
      [/\b(cal(e|a)nd(e|a)r|calender)\b/g, 'calendar'],
      [/\b(shedule(s?)|schedul(e?)|shedul)\b/g, 'schedule'],
      [/\b(meet(i?)ng(s?)|metings?|meatings?)\b/g, 'meeting'],
      [/\b(foc(o?)us|focass|focas)\b/g, 'focus'],
      [/\b(tomm?or?row|tmrw)\b/g, 'tomorrow'],
      [/\b(ov(e?)rdue|overdu)\b/g, 'overdue'],
      [/\b(sum(m?)ar(i?)ze|sum(m?)arise)\b/g, 'summarize'],
      [/\b(sum(m?)ary)\b/g, 'summary'],
      [/\b(responsibilit(y|ies)|resposibilit(y|ies)|responsbility)\b/g, 'responsibility'],
      [/\b(plac(e?)ments?)\b/g, 'placement'],
      [/\b(interv(i?)ews?)\b/g, 'interview'],
      [/\b(assign(e?)ments?)\b/g, 'assignment'],
      [/\b(submi(s?)sions?)\b/g, 'submission'],
      [/\b(hack(a?)thons?)\b/g, 'hackathon'],
      [/\b(import(a|e)nt)\b/g, 'important']
    ];

    for (const [regex, replacement] of typoMap) {
      q = q.replace(regex, replacement);
    }

    return q.replace(/\s+/g, ' ').trim();
  }

  /**
   * Resolves the current temporal context formatted to the user's actual timezone.
   */
  public resolveTemporalContext(userTimeZone?: string, refDate: Date = new Date()): TemporalContext {
    let validTimeZone = 'UTC';
    if (userTimeZone && typeof userTimeZone === 'string') {
      try {
        new Intl.DateTimeFormat(undefined, { timeZone: userTimeZone });
        validTimeZone = userTimeZone;
      } catch {
        validTimeZone = 'UTC';
      }
    } else {
      try {
        validTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      } catch {
        validTimeZone = 'UTC';
      }
    }

    const dateFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: validTimeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const todayStr = dateFormatter.format(refDate);

    const timeFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: validTimeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const currentTimeStr = timeFormatter.format(refDate);

    const tomorrowDate = new Date(refDate.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStr = dateFormatter.format(tomorrowDate);

    const readableDate = refDate.toLocaleDateString('en-US', {
      timeZone: validTimeZone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const readableTime = refDate.toLocaleTimeString('en-US', {
      timeZone: validTimeZone,
      hour: '2-digit',
      minute: '2-digit'
    });

    const [y, m, d] = todayStr.split('-').map(Number);
    const dateUtc = new Date(Date.UTC(y, m - 1, d));
    const dayOfWeek = dateUtc.getUTCDay(); // 0 is Sunday, 1 is Monday ...
    const daysSinceMonday = (dayOfWeek + 6) % 7;
    const thisMonday = new Date(dateUtc.getTime() - daysSinceMonday * 86400000);
    const thisSunday = new Date(thisMonday.getTime() + 6 * 86400000);
    const nextMonday = new Date(thisMonday.getTime() + 7 * 86400000);
    const nextSunday = new Date(thisMonday.getTime() + 13 * 86400000);

    const formatYmd = (dt: Date) => dt.toISOString().substring(0, 10);
    const thisWeekStartStr = formatYmd(thisMonday);
    const thisWeekEndStr = formatYmd(thisSunday);
    const nextWeekStartStr = formatYmd(nextMonday);
    const nextWeekEndStr = formatYmd(nextSunday);
    const currentIso = refDate.toISOString();

    return {
      timeZone: validTimeZone,
      todayStr,
      tomorrowStr,
      currentTimeStr,
      currentIso,
      thisWeekStartStr,
      thisWeekEndStr,
      nextWeekStartStr,
      nextWeekEndStr,
      readableDate,
      readableTime
    };
  }

  /**
   * Checks the real-time health and status of connected Google integrations.
   */
  public async checkIntegrationStatus(userId: string): Promise<IntegrationStatus> {
    const account = await accountService.getAccount(userId, 'google');
    const [gmailState, calState] = await Promise.all([
      syncStateService.getSyncState(userId, 'gmail'),
      syncStateService.getSyncState(userId, 'google_calendar')
    ]);

    if (!account) {
      return {
        hasGoogleAccount: false,
        isTokenExpired: false,
        gmailStatus: 'disconnected',
        calendarStatus: 'disconnected'
      };
    }

    const isExpired = account.token_expiry && new Date(account.token_expiry).getTime() <= Date.now() && !account.refresh_token;

    return {
      hasGoogleAccount: true,
      isTokenExpired: Boolean(isExpired),
      gmailStatus: isExpired ? 'error' : (gmailState?.status === 'failed' ? 'error' : 'active'),
      calendarStatus: isExpired ? 'error' : (calState?.status === 'failed' ? 'error' : 'active'),
      gmailLastSyncedAt: gmailState?.lastSyncedAt,
      calendarLastSyncedAt: calState?.lastSyncedAt,
      errorMessage: isExpired 
        ? 'Google authorization has expired. Please reconnect your account.' 
        : (gmailState?.errorMessage || calState?.errorMessage || null)
    };
  }

  /**
   * Main conversational assistant endpoint returning formatted text answer.
   */
  public async ask(
    userId: string,
    question: string,
    history: ChatMessage[] = [],
    timezone?: string
  ): Promise<string> {
    const res = await this.askDetailed(userId, question, history, timezone);
    return res.answer;
  }

  /**
   * Conversational assistant endpoint returning answer, structured source metadata, and classified intent.
   */
  public async askDetailed(
    userId: string,
    question: string,
    history: ChatMessage[] = [],
    timezone?: string
  ): Promise<{ answer: string; sources: SourceMetadata[]; intent: AssistantIntent; suggestedQuestions: string[] }> {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      return {
        answer: 'Please ask a question about your responsibilities, schedule, or emails.',
        sources: [],
        intent: 'general',
        suggestedQuestions: [
          'What should I focus on today?',
          'What deadlines are coming up?',
          'Any new internships or opportunities?'
        ]
      };
    }

    // 1. Resolve temporal context with user's actual timezone
    const temporalContext = this.resolveTemporalContext(timezone);
    const { todayStr, tomorrowStr, currentTimeStr, readableDate, readableTime } = temporalContext;

    // 2. Fetch authenticated user's records & integration health in parallel
    const [allTasksRaw, emails, calendarEvents, integrationStatus] = await Promise.all([
      taskService.getAllTasksForUser(userId),
      emailService.getEmails(userId, 100),
      calendarEventService.getEvents(userId, 100),
      this.checkIntegrationStatus(userId)
    ]);

    // Sanitize tasks: exclude archived tasks and cancelled tasks
    const allTasks = allTasksRaw.filter(t => !t.isArchived && (t.status || '').toUpperCase() !== 'CANCELLED');
    const activeTasks = allTasks.filter(t => {
      const s = (t.status || '').toUpperCase();
      return s !== 'COMPLETED' && s !== 'DISMISSED';
    });

    // 3. LifeSynch Unified Classification & Discoveries (matching Responsibilities and Dashboard)
    const classifiedLife = aggregateAndClassifyAll(allTasks, emails, calendarEvents);
    const discoveries = generateIntelligentDiscoveries(emails, calendarEvents, allTasks);
    const now = new Date();
    const allSections = groupCategoryItemsBySections(classifiedLife.items, now);
    const academicSections = groupCategoryItemsBySections(classifiedLife.categoryItemsMap.academic || [], now);
    const careerSections = groupCategoryItemsBySections(classifiedLife.categoryItemsMap.career || [], now);
    const personalSections = groupCategoryItemsBySections(classifiedLife.categoryItemsMap.personal || [], now);
    const financeSections = groupCategoryItemsBySections(classifiedLife.categoryItemsMap.finance || [], now);

    // 4. Classify user intent reliably
    const classification = this.classifyIntent(trimmedQuestion, {
      allTasks,
      emails,
      calendarEvents,
      history,
      todayStr,
      tomorrowStr,
      discoveries,
      allSections,
      careerSections,
      academicSections
    });

    // 5. Filter data strictly relevant to the classified intent
    const filteredData = this.filterDataForIntent(classification, {
      activeTasks,
      allTasks,
      emails,
      calendarEvents,
      integrationStatus,
      todayStr,
      tomorrowStr,
      currentTimeStr,
      currentIso: temporalContext.currentIso,
      thisWeekStartStr: temporalContext.thisWeekStartStr,
      thisWeekEndStr: temporalContext.thisWeekEndStr,
      nextWeekStartStr: temporalContext.nextWeekStartStr,
      nextWeekEndStr: temporalContext.nextWeekEndStr,
      allSections,
      academicSections,
      careerSections,
      discoveries
    });

    // Collect structured sources
    const sources = this.extractSourceMetadata(classification, filteredData);

    // If an integration issue directly blocks the answer (e.g. asking for calendar when disconnected or sync failed)
    if (filteredData.integrationNotice) {
      const suggestedQuestions = this.generateSuggestedQuestions(
        classification,
        filteredData,
        allTasks,
        emails,
        calendarEvents
      );
      return {
        answer: filteredData.integrationNotice,
        sources,
        intent: classification.intent,
        suggestedQuestions
      };
    }

    // 5. Attempt LLM generation with focused context
    try {
      if (env.LLM_API_KEY && env.LLM_API_KEY.trim().length > 0) {
        const contextData = this.buildFocusedContextRepresentation({
          classification,
          filteredData,
          todayStr,
          tomorrowStr,
          currentTimeStr,
          readableDate,
          readableTime
        });

        const answer = await this.callLLMForChat(
          classification,
          contextData,
          history,
          trimmedQuestion
        );
        if (answer && answer.trim().length > 0) {
          const suggestedQuestions = this.generateSuggestedQuestions(
            classification,
            filteredData,
            allTasks,
            emails,
            calendarEvents
          );
          return {
            answer: answer.trim(),
            sources,
            intent: classification.intent,
            suggestedQuestions
          };
        }
      }
    } catch (llmError) {
      logger.warn('Assistant LLM invocation encountered an error. Falling back to deterministic analysis:', llmError);
    }

    // 6. Deterministic Rule-Based Answer Generation (guarantees direct answers, zero hallucination, and concise responses)
    const fallbackAnswer = this.generateDeterministicAnswer({
      question: trimmedQuestion,
      classification,
      filteredData,
      todayStr,
      tomorrowStr,
      currentTimeStr,
      currentIso: temporalContext.currentIso,
      thisWeekStartStr: temporalContext.thisWeekStartStr,
      thisWeekEndStr: temporalContext.thisWeekEndStr,
      nextWeekStartStr: temporalContext.nextWeekStartStr,
      nextWeekEndStr: temporalContext.nextWeekEndStr,
      activeTasks,
      allTasks,
      calendarEvents,
      emails
    });

    const suggestedQuestions = this.generateSuggestedQuestions(
      classification,
      filteredData,
      allTasks,
      emails,
      calendarEvents
    );

    return {
      answer: fallbackAnswer,
      sources,
      intent: classification.intent,
      suggestedQuestions
    };
  }

  /**
   * Classify user question into intent categories.
   * Distinguishes: daily priorities, overdue, upcoming, calendar events, email summaries, specific lookups, follow-ups.
   */
  public classifyIntent(
    question: string,
    params: {
      allTasks: Responsibility[];
      emails: EmailRecord[];
      calendarEvents: CalendarEventRecord[];
      history?: ChatMessage[];
      todayStr: string;
      tomorrowStr: string;
      discoveries?: IntelligentDiscovery[];
      allSections?: {
        yourDay: Array<ClassifiedLifeItem & { formattedScheduleText: string }>;
        upcoming: Array<ClassifiedLifeItem & { formattedScheduleText: string }>;
        passed: Array<ClassifiedLifeItem & { formattedScheduleText: string }>;
        informative: Array<ClassifiedLifeItem & { formattedScheduleText: string }>;
      };
      careerSections?: {
        yourDay: Array<ClassifiedLifeItem & { formattedScheduleText: string }>;
        upcoming: Array<ClassifiedLifeItem & { formattedScheduleText: string }>;
        passed: Array<ClassifiedLifeItem & { formattedScheduleText: string }>;
        informative: Array<ClassifiedLifeItem & { formattedScheduleText: string }>;
      };
      academicSections?: {
        yourDay: Array<ClassifiedLifeItem & { formattedScheduleText: string }>;
        upcoming: Array<ClassifiedLifeItem & { formattedScheduleText: string }>;
        passed: Array<ClassifiedLifeItem & { formattedScheduleText: string }>;
        informative: Array<ClassifiedLifeItem & { formattedScheduleText: string }>;
      };
    }
  ): ClassificationResult {
    const rawQ = question.trim();
    const q = this.normalizeQuery(rawQ);

    // 0. Academic updates query: "Show my academic updates", "What are my academic tasks?", "Academic updates"
    const isAcademicQuery = 
      (/\b(academic|academics|courses?|classes?|syllabus|exams?|nptel|assignments?|lectures?|homework)\b/i.test(q) &&
       (/\b(update|updates|task|tasks|responsibilit|show|list|what|my|do i have|any)\b/i.test(q))) ||
      q.includes('academic update') || q.includes('academic updates') || q.includes('my academic') || q === 'show my academic updates';

    if (isAcademicQuery) {
      return { intent: 'academic_updates' };
    }

    // 1. Specific Email Comprehension: "What does this email mean?" / "Explain this email" / "Summarize this email"
    const isEmailExplanation = 
      (/\b(what does (this|the|that|my)?\s*(recent|latest)?\s*(email|message) mean|explain (this|the|that|my)?\s*(recent|latest)?\s*(email|message)|what is (this|the|that)\s*(email|message) (about|communicating|saying)|summarize (this|the|that|my)?\s*(recent|latest)?\s*(email|message))\b/i.test(q)) ||
      (/\bwhat does\b/i.test(q) && /\b(email|message)\b/i.test(q) && /\bmean\b/i.test(q)) ||
      (/\bexplain\b/i.test(q) && /\b(email|message)\b/i.test(q)) ||
      (/\bsummarize\b/i.test(q) && /\b(this|that|the)\b/i.test(q) && /\b(email|message)\b/i.test(q));

    // 2. Action Check: "Do I need to do anything about this email?" / "Does this email require action?"
    const isEmailActionCheck = 
      (/\b(do i need to do anything|do i have to do anything|is any action required|does (this|the|that|my)?\s*(email|message) require|am i expected to do anything|what action is required (for|on|from) (this|the|that|my)?\s*(email|message)|who should take action)\b/i.test(q)) ||
      (/\baction\b/i.test(q) && /\b(required|needed)\b/i.test(q) && /\b(email|message)\b/i.test(q));

    if (isEmailExplanation || isEmailActionCheck) {
      let targetEmail = this.findMatchingEmail(q, params.emails);

      // Resolve from history if pronoun/reference is used
      if (!targetEmail && params.history && params.history.length > 0) {
        const lastAssistantMsg = [...params.history].reverse().find(m => m.role === 'assistant');
        if (lastAssistantMsg && lastAssistantMsg.content) {
          const resolved = this.resolveFollowUpTarget(q, lastAssistantMsg.content, params.allTasks, params.emails, params.calendarEvents, params.history);
          if (resolved && resolved.emails.length > 0) {
            targetEmail = resolved.emails[0];
          }
        }
      }

      if (!targetEmail && params.emails.length > 0) {
        targetEmail = params.emails[0];
      }

      if (targetEmail) {
        const matchingTask = params.allTasks.find(
          t => t.sourceId === targetEmail!.messageId || (t.sourceContext as any)?.messageId === targetEmail!.messageId
        );
        const emailSub = (targetEmail.subject || '').toLowerCase();
        const matchingEvent = emailSub ? params.calendarEvents.find(
          ev => ev.summary.toLowerCase().includes(emailSub)
        ) : undefined;

        return {
          intent: isEmailExplanation ? 'email_explanation' : 'email_action_check',
          targetEntity: targetEmail.subject,
          targetEmail,
          matchedRecords: {
            tasks: matchingTask ? [matchingTask] : [],
            emails: [targetEmail],
            calendarEvents: matchingEvent ? [matchingEvent] : []
          }
        };
      }
    }

    // 3. Follow-up query detection referencing previous messages
    if (params.history && params.history.length > 0) {
      const isFollowUpPronoun = /\b(it|that|this|the first( one)?|the second( one)?|the third( one)?|the last( one)?|first item|second item|first task|second task|that task|that email|that event|first one|second one)\b/i.test(q);
      const isFollowUpActionOrWhy = /^(why is (that|it|this)|what action|how do i|who sent (that|it)|tell me more about (it|that|the first|the second|first one|second one)|where is (it|that))\b/i.test(q);

      if (isFollowUpPronoun || isFollowUpActionOrWhy) {
        const lastAssistantMsg = [...params.history].reverse().find(m => m.role === 'assistant');
        if (lastAssistantMsg && lastAssistantMsg.content) {
          const resolved = this.resolveFollowUpTarget(q, lastAssistantMsg.content, params.allTasks, params.emails, params.calendarEvents, params.history);
          if (resolved) {
            return {
              intent: 'follow_up',
              targetEntity: resolved.subject,
              subType: q.includes('why') ? 'why_priority' : undefined,
              matchedRecords: {
                tasks: resolved.tasks,
                emails: resolved.emails,
                calendarEvents: resolved.calendarEvents
              }
            };
          }
        }
      }
    }

    // 4. Pending applications & registrations: "Show my pending applications", "Do I have any pending applications?"
    if (
      /\b(pending applications?|my applications?|applications? pending|pending registration|applications?)\b/i.test(q) &&
      /\b(pending|show|list|what|my|do i have|any|check)\b/i.test(q)
    ) {
      return { intent: 'pending_applications' };
    }

    // 5. Placement communications & updates: "Summarize my latest placement emails", "Placement updates"
    if (
      (/\b(placement|placements|campus drive|tcs hackquest|hackquest|te ai cup)\b/i.test(q) &&
       /\b(email|emails|update|updates|summary|summarize|latest|news|what|do i have|show|check)\b/i.test(q)) ||
      q.includes('placement email') || q.includes('placement updates') || q.includes('placement update')
    ) {
      return { intent: 'placement_updates' };
    }

    // 6. Internship updates query: "What is the latest update about my internship?", "Any internship updates?"
    if (
      (/\b(internships?|intern)\b/i.test(q) &&
       /\b(update|updates|latest|status|email|emails|summary|summarize|what is the latest|show|news)\b/i.test(q))
    ) {
      return { intent: 'internship_updates' };
    }

    // 7. Tomorrow Queries: "What should I focus on tomorrow?", "What events do I have tomorrow?", "What is happening tomorrow?"
    if (/\btomorrow\b/i.test(q)) {
      if (/\b(events?|calendar|meetings?)\b/i.test(q)) {
        return { intent: 'focus_tomorrow', subType: 'events_only' };
      }
      if (/\b(tasks?|responsibilit(y|ies)|due|deadlines?|submit|submission)\b/i.test(q)) {
        return { intent: 'focus_tomorrow', subType: 'tasks_only' };
      }
      return { intent: 'focus_tomorrow', subType: 'all' };
    }

    // 8. Next Week / This Week Queries: "Do I have any events next week?", "What is happening this week?"
    if (/\bnext week\b/i.test(q)) {
      return { intent: 'week_schedule', subType: 'next_week' };
    }
    if (/\bthis week\b/i.test(q)) {
      return { intent: 'week_schedule', subType: 'this_week' };
    }

    // 9. Upcoming Calendar Events: "What are my upcoming events?", "Show upcoming events"
    if (
      (/\b(events?)\b/i.test(q) && /\b(upcoming|coming up|future|scheduled|next)\b/i.test(q) && !/\b(tasks?|responsibilit)\b/i.test(q)) ||
      q === 'what are my upcoming events' || q === 'what are my upcoming events?' ||
      q === 'show upcoming events' || q === 'upcoming events'
    ) {
      return { intent: 'upcoming_events' };
    }

    // 10. Calendar Events Today: "What events do I have today?", "What is on my calendar today?"
    if (
      (/\b(events?|calendar)\b/i.test(q) && /\b(today|tonight)\b/i.test(q)) ||
      q === 'what events do i have today?' || q === 'what events do i have today' ||
      q === 'what is on my calendar today' || q === 'what is on my calendar today?' ||
      q === 'show my calendar today'
    ) {
      return { intent: 'calendar_schedule', subType: 'today_only' };
    }

    // 11. Upcoming Tasks: "What are my upcoming tasks?", "Show my upcoming tasks"
    if (
      (/\b(tasks?|responsibilit(y|ies))\b/i.test(q) && /\b(upcoming|coming up|future|next)\b/i.test(q)) ||
      q === 'what are my upcoming tasks' || q === 'what are my upcoming tasks?' ||
      q === 'show my upcoming tasks' || q === 'show upcoming tasks' || q === 'upcoming tasks'
    ) {
      return { intent: 'upcoming_deadlines', subType: 'tasks_only' };
    }

    // 12. Approaching Deadlines: "What deadlines are approaching?", "What deadlines are coming up?"
    if (
      (/\b(deadlines?|due)\b/i.test(q) && /\b(approaching|coming up|upcoming|soon|next)\b/i.test(q)) ||
      q === 'what deadlines are approaching' || q === 'what deadlines are approaching?' ||
      q === 'what deadlines are coming up' || q === 'what deadlines are coming up?' ||
      q === 'what is coming up' || q === "what's coming up"
    ) {
      return { intent: 'upcoming_deadlines' };
    }

    // 13. Overdue Tasks: "Which tasks are overdue?", "What tasks are overdue?"
    if (
      /\b(overdue|past due|missed deadline|missed deadlines|which tasks are overdue|what tasks are overdue|what is overdue)\b/i.test(q) ||
      (/\bmissed\b/i.test(q) && /\b(deadline|deadlines|task|tasks|responsibility|responsibilities)\b/i.test(q)) ||
      q === 'what did i miss?' || q === 'what did i miss' || q === 'do i have anything overdue?' || q === 'do i have anything overdue'
    ) {
      return { intent: 'overdue' };
    }

    // 14. Single Highest Priority Task: "What is the most important thing I need to do?", "What should I complete first?"
    if (
      /\b(most important( thing)?|what should i (do|complete) first|which task should i (do|complete) first|highest priority|top priority|most urgent)\b/i.test(q) ||
      q.includes('most important') || q.includes('do first') || q.includes('complete first')
    ) {
      return { intent: 'prioritization', subType: 'highest_single' };
    }

    // 15. Prioritization Today: "What should I focus on today?", "What do I need to complete today?"
    if (
      /\b(focus|focus on|complete today|do today|work on today|priorities for today|daily priorities|my priorities today|what should i do today|what to do today|what do i need to do today|what do i need to complete today|what to complete today)\b/i.test(q) ||
      q === 'what should i focus on today?' ||
      q === 'what should i focus on today' ||
      q === 'what should i do today?' ||
      q === 'what should i do today' ||
      q === 'what to do today' ||
      q === 'what should i focus on'
    ) {
      return { intent: 'prioritization' };
    }

    // 16. Meeting Lookup: "When is my meeting?", "Do I have any meetings?", "When is the interview?"
    const isMeetingQuery = 
      (/\b(when is (my|the|our|next)?\s*(meeting|interview|sync|viva|evaluation|call)|what time is (my|the|our)?\s*(meeting|interview|sync|viva|call)|do i have any meetings|any meetings today|show my meetings|what meetings do i have)\b/i.test(q)) ||
      (/\bwhen is\b/i.test(q) && /\b(meeting|sync|interview|viva|evaluation|call)\b/i.test(q)) ||
      (/\b(any|what)\b/i.test(q) && /\bmeetings?\b/i.test(q)) ||
      q === 'when is my meeting' || q === 'when is the meeting';

    if (isMeetingQuery) {
      const isToday = /\b(today|tonight|this morning|this afternoon)\b/i.test(q);
      return { 
        intent: 'meeting_lookup',
        subType: isToday ? 'today_only' : undefined
      };
    }

    // 17. Opportunities & Internships: "Any new internships?", "Are there any job opportunities?"
    const isOpportunityQuery = 
      (/\b(any|new|show|find|list|what|are there any)?\s*(new)?\s*(internships?|intern|fellowships?|job opportunities|jobs?|hackathons?|placements?|campus drives?|contests?|hiring|opportunities|career)\b/i.test(q)) ||
      q.includes('internship') || q.includes('opportunity') || q.includes('opportunities') || q.includes('job opportunity') || q.includes('campus drive') || q.includes('placement drive') || q.includes('career opportunit');

    if (isOpportunityQuery) {
      return { intent: 'opportunities' };
    }

    // 18. Passed items query: "What has passed?", "What did I miss?"
    if (
      /\b(what has passed|what is passed|show passed|what passed|passed responsibilities|concluded)\b/i.test(q) ||
      q === 'what has passed?' || q === 'what has passed' || q === 'what is passed'
    ) {
      return { intent: 'passed' };
    }

    // 19. "What is happening today?" / "What is on my schedule today?"
    if (
      q === 'what is happening today?' ||
      q === 'what is happening today' ||
      q === "what's happening today?" ||
      q === "what's happening today" ||
      q.includes('happening today') ||
      (/\b(what('s| is) on my schedule today|what is scheduled for today|what's scheduled for today|today's schedule)\b/i.test(q))
    ) {
      return { intent: 'today_overview' };
    }

    // 20. Explicit Calendar schedule query: "What is on my calendar?"
    if (
      (/\b(calendar)\b/i.test(q) &&
       !/\b(email|emails|mail|inbox|overdue)\b/i.test(q) &&
       (/\b(today|now|on my calendar)\b/i.test(q) ||
        /^(what is on my calendar|what's on my calendar|show my calendar|show calendar)/i.test(q)))
    ) {
      return { intent: 'calendar_schedule' };
    }

    // 21. Specific "Why is [X] priority / urgent" query
    if (/\bwhy\b/i.test(q) && /\b(high priority|priority|urgent)\b/i.test(q)) {
      const specificMatch = this.findMatchingRecords(q, params.allTasks, params.emails, params.calendarEvents);
      return {
        intent: 'priority_rationale',
        targetEntity: specificMatch?.subject || 'high priority responsibility',
        matchedRecords: {
          tasks: specificMatch?.tasks || params.allTasks.filter(t => t.priority === 'high').slice(0, 1),
          emails: [],
          calendarEvents: []
        }
      };
    }

    // 22. Email summary & actionable email requests
    if (
      /\b(email|emails|gmail|inbox|messages)\b/i.test(q) &&
      (/\b(summar|important|unread|action|response|respond|latest|recent|check)\b/i.test(q) ||
       /^(summarize my|check my|show my|any emails)/i.test(q))
    ) {
      const isActionableOnly = /\b(action|actionable|response|respond|reply|need my response)\b/i.test(q);
      return {
        intent: 'email_summary',
        subType: isActionableOnly ? 'actionable_only' : undefined
      };
    }

    // 15. Check matching discovery (e.g. "tell me about Eurogrip", "tell me about TCS HackQuest")
    if (params.discoveries && params.discoveries.length > 0) {
      for (const disc of params.discoveries) {
        const titleLower = disc.title.toLowerCase();
        const explLower = disc.explanation.toLowerCase();
        const words = titleLower.split(/[^a-z0-9]+/).filter(w => w.length >= 4);
        const matchesWord = words.some(w => q.includes(w));
        if (matchesWord || (q.includes('internship') && disc.category === 'career')) {
          return {
            intent: 'specific_lookup',
            targetEntity: disc.title,
            targetDiscovery: disc,
            matchedRecords: {
              tasks: disc.rawResponsibility ? [disc.rawResponsibility] : [],
              emails: disc.rawEmail ? [disc.rawEmail] : [],
              calendarEvents: disc.rawCalendarEvent ? [disc.rawCalendarEvent] : []
            }
          };
        }
      }
    }

    // 16. Specific record lookup (topic, entity, person, or organization)
    const specificMatch = this.findMatchingRecords(q, params.allTasks, params.emails, params.calendarEvents);
    if (specificMatch) {
      return {
        intent: 'specific_lookup',
        targetEntity: specificMatch.subject,
        matchedRecords: {
          tasks: specificMatch.tasks,
          emails: specificMatch.emails,
          calendarEvents: specificMatch.calendarEvents
        }
      };
    }

    // If query contains specific candidate named entities that were NOT found in user data
    const candidateQuery = this.extractCandidateKeywords(q);
    if (candidateQuery && candidateQuery.length >= 3 && !/^(help|hello|hi|what|how|why)$/i.test(candidateQuery)) {
      return {
        intent: 'specific_lookup',
        targetEntity: candidateQuery,
        matchedRecords: { tasks: [], emails: [], calendarEvents: [] }
      };
    }

    // 14. Ambiguous question check
    if (
      q.length < 14 ||
      /^(what about|can you|how about|what then|and then|what else)\b/i.test(q)
    ) {
      return { intent: 'ambiguous' };
    }

    // 15. General fallbacks
    if (q.includes('today')) {
      return { intent: 'prioritization' };
    }

    return { intent: 'general' };
  }

  /**
   * Helper to find a matching email by sender or subject keywords.
   */
  public findMatchingEmail(q: string, emails: EmailRecord[]): EmailRecord | null {
    if (emails.length === 0) return null;
    const cleanQ = q.toLowerCase();

    for (const email of emails) {
      const sender = (email.sender || '').toLowerCase();
      const subject = (email.subject || '').toLowerCase();

      // Check sender words (e.g. "Prof. Davis" -> "davis", "Fidelity", "coordinator", "sumanth")
      const senderWords = sender.replace(/<[^>]+>/g, '').split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !['com', 'edu', 'org', 'net', 'gmail', 'mail'].includes(w));
      for (const sw of senderWords) {
        if (cleanQ.includes(sw)) return email;
      }

      // Check subject keywords
      const subjectWords = subject.split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !['about', 'with', 'from', 'this', 'that', 'your', 'update', 'email', 'reminder'].includes(w));
      let matchCount = 0;
      for (const sw of subjectWords) {
        if (cleanQ.includes(sw)) matchCount++;
      }
      if (matchCount >= 2 || (subjectWords.length === 1 && matchCount === 1)) {
        return email;
      }
    }

    return null;
  }

  /**
   * Resolves follow-up query target from conversation history items.
   */
  private resolveFollowUpTarget(
    q: string,
    lastAssistantContent: string,
    allTasks: Responsibility[],
    emails: EmailRecord[],
    calendarEvents: CalendarEventRecord[],
    history: ChatMessage[] = []
  ): { tasks: Responsibility[]; emails: EmailRecord[]; calendarEvents: CalendarEventRecord[]; subject: string } | null {
    // 1. Extract source tags: [Source: (Gmail|Calendar|Task) - ... | id:<id>]
    const sourceRegex = /\[Source:\s*(Gmail|Calendar|Task)[^|]*\|\s*id:([a-zA-Z0-9_\-\.]+)\]/gi;
    const sourceMatches = Array.from(lastAssistantContent.matchAll(sourceRegex));

    // 2. Extract bold titles/subjects: **Title**
    const boldMatches = Array.from(lastAssistantContent.matchAll(/\*\*([^*]+)\*\*/g)).map(m => m[1].trim());

    // Determine target index:
    let targetIndex = 0;
    if (/\b(first one|first item|first task|first email|the first|item 1)\b/i.test(q)) {
      targetIndex = 0;
    } else if (/\b(second one|second item|second task|second email|the second|item 2)\b/i.test(q)) {
      targetIndex = 1;
    } else if (/\b(third one|third item|third task|third email|the third|item 3)\b/i.test(q)) {
      targetIndex = 2;
    }

    // If query specifically asks about "that email" / "this email"
    const isEmailReference = /\b(that email|this email|the email)\b/i.test(q);
    if (isEmailReference) {
      const gmailSrc = sourceMatches.find(m => m[1].toLowerCase() === 'gmail');
      if (gmailSrc) {
        const emailId = gmailSrc[2];
        const email = emails.find(e => e.id === emailId || e.messageId === emailId);
        if (email) {
          const task = allTasks.find(t => (t.sourceContext as any)?.messageId === email.messageId || t.sourceId === email.messageId);
          return { tasks: task ? [task] : [], emails: [email], calendarEvents: [], subject: email.subject || 'Email' };
        }
      }
    }

    // Try resolution by Source Tag ID if available
    if (sourceMatches.length > targetIndex) {
      const match = sourceMatches[targetIndex];
      const type = match[1].toLowerCase();
      const id = match[2];

      if (type === 'task') {
        const task = allTasks.find(t => t.id === id);
        if (task) return { tasks: [task], emails: [], calendarEvents: [], subject: task.title };
      } else if (type === 'gmail') {
        const email = emails.find(e => e.id === id || e.messageId === id);
        if (email) {
          const task = allTasks.find(t => (t.sourceContext as any)?.messageId === email.messageId || t.sourceId === email.messageId);
          return { tasks: task ? [task] : [], emails: [email], calendarEvents: [], subject: email.subject || 'Email' };
        }
      } else if (type === 'calendar') {
        const event = calendarEvents.find(c => c.id === id || c.eventId === id);
        if (event) {
          const task = allTasks.find(t => (t.sourceContext as any)?.calendarEventId === event.eventId || t.sourceId === event.eventId);
          return { tasks: task ? [task] : [], emails: [], calendarEvents: [event], subject: event.summary };
        }
      }
    }

    // Try resolution by bold title
    if (boldMatches.length > targetIndex) {
      const targetTitle = boldMatches[targetIndex];
      const match = this.findMatchingRecords(targetTitle, allTasks, emails, calendarEvents);
      if (match) return match;
      return {
        tasks: [],
        emails: [],
        calendarEvents: [],
        subject: targetTitle
      };
    }

    // Check earlier history if last assistant message was a follow-up or confirmation
    if (history.length >= 3) {
      for (let i = history.length - 2; i >= 0; i--) {
        const prevMsg = history[i];
        if (prevMsg.role === 'assistant' && prevMsg.content) {
          const prevSources = Array.from(prevMsg.content.matchAll(sourceRegex));
          if (prevSources.length > 0) {
            const id = prevSources[0][2];
            const task = allTasks.find(t => t.id === id);
            if (task) return { tasks: [task], emails: [], calendarEvents: [], subject: task.title };
            const email = emails.find(e => e.id === id || e.messageId === id);
            if (email) return { tasks: [], emails: [email], calendarEvents: [], subject: email.subject || 'Email' };
            const event = calendarEvents.find(c => c.id === id || c.eventId === id);
            if (event) return { tasks: [], emails: [], calendarEvents: [event], subject: event.summary };
          }
        }
      }
    }

    return null;
  }

  /**
   * Helper to extract candidate search tokens from a question.
   */
  private extractCandidateKeywords(q: string): string | null {
    const cleanQ = q.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    const tokens = cleanQ.split(/\s+/).filter(w => w.length >= 3);
    const stopWords = new Set([
      'what', 'when', 'where', 'which', 'who', 'whom', 'whose', 'why', 'how',
      'the', 'this', 'that', 'these', 'those', 'there', 'here',
      'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
      'do', 'does', 'did', 'have', 'has', 'had', 'having',
      'can', 'could', 'should', 'would', 'may', 'might', 'must',
      'show', 'tell', 'about', 'give', 'list', 'details', 'detail', 'info', 'information',
      'task', 'tasks', 'responsibility', 'responsibilities', 'obligation', 'obligations',
      'email', 'emails', 'mail', 'mails', 'inbox', 'message', 'messages',
      'calendar', 'event', 'events', 'schedule',
      'today', 'tomorrow', 'yesterday', 'upcoming', 'deadline', 'deadlines',
      'due', 'overdue', 'priority', 'priorities', 'important', 'focus', 'summarize', 'summary',
      'coming', 'happening', 'next', 'first', 'second', 'send', 'sent', 'receive', 'received'
    ]);

    const keywords = tokens.filter(t => !stopWords.has(t));
    return keywords.length > 0 ? keywords.join(' ') : null;
  }

  /**
   * Searches for specific record matches for entities/topics mentioned in the question.
   */
  private findMatchingRecords(
    q: string,
    allTasks: Responsibility[],
    emails: EmailRecord[],
    calendarEvents: CalendarEventRecord[]
  ): { tasks: Responsibility[]; emails: EmailRecord[]; calendarEvents: CalendarEventRecord[]; subject: string } | null {
    const candidateSubject = this.extractCandidateKeywords(q);
    if (!candidateSubject) return null;

    const candidateKeywords = candidateSubject.split(/\s+/).filter(w => w.length >= 3);
    if (candidateKeywords.length === 0) return null;

    const scoreText = (text: string): number => {
      const lower = text.toLowerCase();
      if (lower.includes(candidateSubject)) return 100;
      let matchCount = 0;
      for (const kw of candidateKeywords) {
        if (lower.includes(kw)) matchCount++;
      }
      return matchCount / candidateKeywords.length;
    };

    const scoredTasks = allTasks
      .map(t => ({
        task: t,
        score: scoreText(`${t.title} ${t.action || ''} ${t.description || ''} ${t.category || ''} ${t.sourceContext?.sender || ''}`)
      }))
      .filter(item => item.score >= 0.5)
      .sort((a, b) => b.score - a.score)
      .map(item => item.task);

    const scoredEmails = emails
      .map(e => ({
        email: e,
        score: scoreText(`${e.subject || ''} ${e.sender || ''} ${e.snippet || ''} ${e.bodyText || ''}`)
      }))
      .filter(item => item.score >= 0.5)
      .sort((a, b) => b.score - a.score)
      .map(item => item.email);

    const scoredEvents = calendarEvents
      .map(ev => ({
        event: ev,
        score: scoreText(`${ev.summary || ''} ${ev.description || ''} ${ev.location || ''}`)
      }))
      .filter(item => item.score >= 0.5)
      .sort((a, b) => b.score - a.score)
      .map(item => item.event);

    if (scoredTasks.length > 0 || scoredEmails.length > 0 || scoredEvents.length > 0) {
      return {
        tasks: scoredTasks.slice(0, 3),
        emails: scoredEmails.slice(0, 3),
        calendarEvents: scoredEvents.slice(0, 3),
        subject: candidateSubject
      };
    }

    return null;
  }

  /**
   * Filter data strictly relevant to the classified intent.
   * Ensures accurate timezone-based boundaries and integration status reporting.
   */
  public filterDataForIntent(
    classification: ClassificationResult,
    params: {
      activeTasks: Responsibility[];
      allTasks: Responsibility[];
      emails: EmailRecord[];
      calendarEvents: CalendarEventRecord[];
      integrationStatus: IntegrationStatus;
      todayStr: string;
      tomorrowStr: string;
      currentTimeStr: string;
      currentIso?: string;
      thisWeekStartStr?: string;
      thisWeekEndStr?: string;
      nextWeekStartStr?: string;
      nextWeekEndStr?: string;
      allSections?: {
        yourDay: Array<ClassifiedLifeItem & { formattedScheduleText: string }>;
        upcoming: Array<ClassifiedLifeItem & { formattedScheduleText: string }>;
        passed: Array<ClassifiedLifeItem & { formattedScheduleText: string }>;
        informative: Array<ClassifiedLifeItem & { formattedScheduleText: string }>;
      };
      academicSections?: {
        yourDay: Array<ClassifiedLifeItem & { formattedScheduleText: string }>;
        upcoming: Array<ClassifiedLifeItem & { formattedScheduleText: string }>;
        passed: Array<ClassifiedLifeItem & { formattedScheduleText: string }>;
        informative: Array<ClassifiedLifeItem & { formattedScheduleText: string }>;
      };
      careerSections?: {
        yourDay: Array<ClassifiedLifeItem & { formattedScheduleText: string }>;
        upcoming: Array<ClassifiedLifeItem & { formattedScheduleText: string }>;
        passed: Array<ClassifiedLifeItem & { formattedScheduleText: string }>;
        informative: Array<ClassifiedLifeItem & { formattedScheduleText: string }>;
      };
      discoveries?: IntelligentDiscovery[];
    }
  ): FilteredAssistantData {
    const { 
      activeTasks, 
      allTasks, 
      emails, 
      calendarEvents, 
      integrationStatus, 
      todayStr, 
      tomorrowStr, 
      currentTimeStr,
      currentIso,
      thisWeekStartStr,
      thisWeekEndStr,
      nextWeekStartStr,
      nextWeekEndStr,
      allSections,
      academicSections,
      careerSections,
      discoveries
    } = params;

    const isPending = (t: Responsibility) => {
      if (t.isArchived) return false;
      const s = (t.status || '').toUpperCase();
      return s !== 'COMPLETED' && s !== 'CANCELLED' && s !== 'DISMISSED';
    };

    // Filter genuine tasks (ignore informational announcements with date ranges)
    const isGenuineActionableTask = (t: Responsibility) => {
      if (!isPending(t)) return false;
      if (t.source === 'gmail') {
        if (isProgramScheduleOrEventDateRange(t.title) || isProgramScheduleOrEventDateRange(t.description)) {
          return false;
        }
        if (isInformationalEmailNotResponsibility({
          title: t.title,
          action: t.action,
          description: t.description,
          sourceType: t.source,
          sourceContext: t.sourceContext as any
        })) {
          return false;
        }
      }
      return true;
    };

    // Precision deadline checker taking into account both date and time in user timezone
    const isOverdue = (t: Responsibility) => {
      if (!isGenuineActionableTask(t) || !t.dueDate) return false;
      const taskDate = t.dueDate.substring(0, 10);
      if (taskDate < todayStr) return true;
      if (taskDate === todayStr && t.dueTime && t.dueTime < currentTimeStr) {
        return true;
      }
      return false;
    };

    const isDueToday = (t: Responsibility) => {
      if (!isGenuineActionableTask(t) || !t.dueDate) return false;
      const taskDate = t.dueDate.substring(0, 10);
      if (taskDate !== todayStr) return false;
      // If it had a specific time that has already passed, it is now overdue
      if (t.dueTime && t.dueTime < currentTimeStr) return false;
      return true;
    };

    switch (classification.intent) {
      case 'prioritization': {
        const yourDayItems = allSections?.yourDay || [];
        let topTasks: Responsibility[] = yourDayItems
          .map(it => it.rawResponsibility)
          .filter(Boolean) as Responsibility[];

        if (topTasks.length === 0 && yourDayItems.length === 0) {
          const dueToday = activeTasks.filter(t => isDueToday(t));
          topTasks = dueToday;
        }

        if (classification.subType === 'highest_single') {
          const dueToday = activeTasks.filter(t => isDueToday(t));
          if (dueToday.length > 0) {
            return { prioritizedTasks: dueToday.slice(0, 1) };
          }

          const overdueTasks = allTasks.filter(t => isOverdue(t)).sort((a, b) => (b.dueDate || '').localeCompare(a.dueDate || ''));
          const tomorrowTasks = activeTasks.filter(t => isGenuineActionableTask(t) && t.dueDate && t.dueDate.substring(0, 10) === tomorrowStr);
          
          if (tomorrowTasks.length > 0) {
            return {
              prioritizedTasks: tomorrowTasks.slice(0, 1),
              overdueTasks: overdueTasks.slice(0, 1)
            };
          }

          if (overdueTasks.length > 0) {
            return { prioritizedTasks: overdueTasks.slice(0, 1) };
          }

          const upcoming = activeTasks
            .filter(t => isGenuineActionableTask(t) && t.dueDate && t.dueDate.substring(0, 10) >= todayStr)
            .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));

          return { prioritizedTasks: upcoming.slice(0, 1) };
        }

        return {
          yourDayItems: yourDayItems.slice(0, 5),
          prioritizedTasks: topTasks.slice(0, 5)
        };
      }

      case 'focus_tomorrow': {
        const tomorrowTasks = activeTasks.filter(
          t => isGenuineActionableTask(t) && t.dueDate && t.dueDate.substring(0, 10) === tomorrowStr
        );
        const tomorrowEvents = calendarEvents.filter(
          ev => ev.startTime.startsWith(tomorrowStr) && ev.status !== 'cancelled'
        ).sort((a, b) => a.startTime.localeCompare(b.startTime));
        const tomorrowItems = (allSections?.upcoming || []).filter(it => {
          if (it.formattedScheduleText.toLowerCase().includes('tomorrow')) return true;
          if (it.date && it.date.substring(0, 10) === tomorrowStr) return true;
          return false;
        });
        return { tomorrowTasks, tomorrowEvents, tomorrowItems };
      }

      case 'upcoming_events': {
        // Upcoming calendar events must be strictly future commitments relative to the user's current time.
        // Never return past events from September or October!
        const referenceTime = currentIso || `${todayStr}T${currentTimeStr}:00Z`;
        const upcomingEvents = calendarEvents
          .filter(ev => ev.status !== 'cancelled' && (ev.startTime >= referenceTime || ev.startTime.substring(0, 10) > todayStr))
          .sort((a, b) => a.startTime.localeCompare(b.startTime));

        return { upcomingEvents };
      }

      case 'week_schedule': {
        const isNextWeek = classification.subType === 'next_week';
        const rangeStart = isNextWeek ? (nextWeekStartStr || tomorrowStr) : todayStr;
        const rangeEnd = isNextWeek ? (nextWeekEndStr || '2099-12-31') : (thisWeekEndStr || '2099-12-31');

        const weekTasks = activeTasks
          .filter(t => isGenuineActionableTask(t) && t.dueDate && t.dueDate.substring(0, 10) >= rangeStart && t.dueDate.substring(0, 10) <= rangeEnd)
          .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));

        const weekEvents = calendarEvents
          .filter(ev => ev.status !== 'cancelled' && ev.startTime.substring(0, 10) >= rangeStart && ev.startTime.substring(0, 10) <= rangeEnd)
          .sort((a, b) => a.startTime.localeCompare(b.startTime));

        return { weekTasks, weekEvents };
      }

      case 'pending_applications': {
        const appKeywords = ['apply', 'application', 'register', 'registration', 'recruitment', 'form', 'submission', 'enroll'];
        const matchedTasks = activeTasks.filter(t => {
          const text = `${t.title} ${t.action || ''} ${t.description || ''}`.toLowerCase();
          return appKeywords.some(kw => text.includes(kw));
        }).sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));

        const matchedDiscoveries = (discoveries || []).filter(d => {
          const text = `${d.title} ${d.explanation || ''}`.toLowerCase();
          return appKeywords.some(kw => text.includes(kw));
        });

        return {
          pendingApplications: matchedTasks,
          opportunityDiscoveries: matchedDiscoveries
        };
      }

      case 'placement_updates': {
        const placementKeywords = ['placement', 'campus drive', 'hackquest', 'tcs', 'te ai cup', 'hiring', 'eligibility', 'nie placement'];
        const placementEmails = emails.filter(e => {
          const text = `${e.subject || ''} ${e.sender || ''} ${e.snippet || ''}`.toLowerCase();
          return placementKeywords.some(kw => text.includes(kw));
        });

        const placementTasks = activeTasks.filter(t => {
          const text = `${t.title} ${t.action || ''} ${t.description || ''} ${t.sourceContext?.sender || ''}`.toLowerCase();
          return placementKeywords.some(kw => text.includes(kw));
        });

        return {
          placementEmails: placementEmails.slice(0, 5),
          placementTasks: placementTasks.slice(0, 3)
        };
      }

      case 'internship_updates': {
        const internKeywords = ['internship', 'intern', 'unstop', 'airbus', 'indian army', 'hp power lab', 'corizo', 'summer intern'];
        const internshipEmails = emails.filter(e => {
          const text = `${e.subject || ''} ${e.sender || ''} ${e.snippet || ''}`.toLowerCase();
          return internKeywords.some(kw => text.includes(kw));
        });

        const internshipTasks = activeTasks.filter(t => {
          const text = `${t.title} ${t.action || ''} ${t.description || ''}`.toLowerCase();
          return internKeywords.some(kw => text.includes(kw));
        });

        return {
          internshipEmails: internshipEmails.slice(0, 5),
          internshipTasks: internshipTasks.slice(0, 3)
        };
      }

      case 'today_overview': {
        const todayEvents = calendarEvents.filter(
          ev => ev.startTime.startsWith(todayStr) && ev.status !== 'cancelled'
        ).sort((a, b) => a.startTime.localeCompare(b.startTime));

        const todayTasks = activeTasks.filter(t => isDueToday(t));

        return {
          todayEvents,
          todayTasks
        };
      }

      case 'email_explanation':
      case 'email_action_check': {
        const targetEmail = classification.targetEmail || classification.matchedRecords?.emails?.[0];
        const matchedTasks = classification.matchedRecords?.tasks && classification.matchedRecords.tasks.length > 0
          ? classification.matchedRecords.tasks
          : (targetEmail ? activeTasks.filter(t => t.sourceId === targetEmail.messageId || (t.sourceContext as any)?.messageId === targetEmail.messageId) : []);

        return {
          targetEmail,
          matchedTasks,
          matchedEmails: targetEmail ? [targetEmail] : []
        };
      }

      case 'passed':
      case 'overdue': {
        const passedItems = allSections?.passed || [];
        let overdue = passedItems.map(it => it.rawResponsibility).filter(Boolean) as Responsibility[];
        if (overdue.length === 0 && passedItems.length === 0) {
          overdue = allTasks.filter(t => isOverdue(t)).sort((a, b) => (b.dueDate || '').localeCompare(a.dueDate || ''));
        }
        return {
          passedItems,
          overdueTasks: overdue
        };
      }

      case 'upcoming_deadlines': {
        if (classification.subType === 'tomorrow_only') {
          const tomorrowItems = (allSections?.upcoming || []).filter(it => {
            if (it.formattedScheduleText.toLowerCase().includes('tomorrow')) return true;
            if (it.date && it.date.substring(0, 10) === tomorrowStr) return true;
            return false;
          });
          const tomorrowTasks = activeTasks.filter(
            t => isGenuineActionableTask(t) && t.dueDate && t.dueDate.substring(0, 10) === tomorrowStr
          );
          const tomorrowEvents = calendarEvents.filter(
            ev => ev.startTime.startsWith(tomorrowStr) && ev.status !== 'cancelled'
          );
          return { tomorrowItems, tomorrowTasks, tomorrowEvents };
        }

        const upcomingTasks = activeTasks
          .filter(t => isGenuineActionableTask(t) && t.dueDate && t.dueDate.substring(0, 10) >= todayStr)
          .sort((a, b) => {
            const dateCmp = (a.dueDate || '').localeCompare(b.dueDate || '');
            if (dateCmp !== 0) return dateCmp;
            return (a.dueTime || '99:99').localeCompare(b.dueTime || '99:99');
          });

        if (classification.subType === 'tasks_only') {
          return {
            upcomingTasks: upcomingTasks.slice(0, 8)
          };
        }

        const referenceTime = currentIso || `${todayStr}T${currentTimeStr}:00Z`;
        const upcomingEvents = calendarEvents
          .filter(ev => ev.status !== 'cancelled' && (ev.startTime >= referenceTime || ev.startTime.substring(0, 10) > todayStr))
          .sort((a, b) => a.startTime.localeCompare(b.startTime));

        const upcomingItems = allSections?.upcoming || [];

        return {
          upcomingItems: upcomingItems.slice(0, 8),
          upcomingTasks: upcomingTasks.slice(0, 8),
          upcomingEvents: upcomingEvents.slice(0, 3)
        };
      }

      case 'academic_updates': {
        const academicItems = [
          ...(academicSections?.yourDay || []),
          ...(academicSections?.upcoming || []),
          ...(academicSections?.informative || [])
        ];
        const academicDiscs = (discoveries || []).filter(d => d.category === 'academic');
        const academicTasks = activeTasks.filter(t => t.category === 'academic');
        return {
          academicItems,
          opportunityDiscoveries: academicDiscs,
          matchedTasks: academicTasks
        };
      }

      case 'meeting_lookup': {
        const isTodaySpecific = classification.subType === 'today_only';

        const targetEvents = isTodaySpecific
          ? calendarEvents.filter(ev => ev.status !== 'cancelled' && ev.startTime.startsWith(todayStr))
          : calendarEvents
              .filter(ev => ev.status !== 'cancelled' && ev.startTime >= todayStr)
              .sort((a, b) => a.startTime.localeCompare(b.startTime));

        const meetingEmails = emails.filter(e => {
          const text = `${e.subject || ''} ${e.snippet || ''} ${e.bodyText || ''}`.toLowerCase();
          return text.includes('meeting') || text.includes('interview') || text.includes('viva') || text.includes('evaluation') || text.includes('sync') || text.includes('zoom') || text.includes('meet.google');
        });

        return {
          matchedEvents: targetEvents.slice(0, 3),
          matchedEmails: isTodaySpecific ? [] : meetingEmails.slice(0, 2)
        };
      }

      case 'opportunities': {
        const oppDiscs = (discoveries || []).filter(d => d.category === 'career' || d.discoveryType === 'opportunity');
        const careerItems = [
          ...(careerSections?.yourDay || []),
          ...(careerSections?.upcoming || []),
          ...(careerSections?.informative || [])
        ];
        const opportunityKeywords = ['internship', 'intern', 'fellowship', 'stipend', 'ppo', 'pre-placement', 'campus drive', 'placement drive', 'challenge', 'hackathon', 'contest', 'hiring', 'opportunity', 'eurogrip', 'samsung', 'tcs'];

        const oppTasks = activeTasks.filter(t => {
          if ((t.category as string) === 'career' || t.category === 'work') return true;
          const text = `${t.title} ${t.action || ''} ${t.description || ''}`.toLowerCase();
          return opportunityKeywords.some(kw => text.includes(kw));
        });

        const oppEmails = emails.filter(e => {
          const text = `${e.subject || ''} ${e.snippet || ''} ${e.bodyText || ''}`.toLowerCase();
          return opportunityKeywords.some(kw => text.includes(kw));
        });

        return {
          opportunityDiscoveries: oppDiscs,
          careerItems,
          opportunityTasks: oppTasks.slice(0, 4),
          opportunityEmails: oppEmails.slice(0, 4)
        };
      }

      case 'calendar_schedule': {
        const todayEvents = calendarEvents.filter(
          ev => ev.startTime.startsWith(todayStr) && ev.status !== 'cancelled'
        ).sort((a, b) => a.startTime.localeCompare(b.startTime));

        if (todayEvents.length === 0 && integrationStatus.calendarStatus === 'disconnected') {
          return {
            integrationNotice: 'Google Calendar is not currently connected to your account. Please connect Google Calendar in Settings or Digital Sources to view your live schedule.'
          };
        }
        if (todayEvents.length === 0 && integrationStatus.calendarStatus === 'error') {
          return {
            integrationNotice: `Google Calendar synchronization encountered an error: ${integrationStatus.errorMessage || 'Authentication expired'}. Please reconnect your Google account in Settings.`
          };
        }

        return { todayEvents };
      }

      case 'email_summary': {
        if (emails.length === 0 && integrationStatus.gmailStatus === 'disconnected') {
          return {
            integrationNotice: 'Gmail is not currently connected to your account. Please connect Gmail in Settings or Digital Sources to summarize your emails.'
          };
        }
        if (emails.length === 0 && integrationStatus.gmailStatus === 'error') {
          return {
            integrationNotice: `Gmail synchronization encountered an error: ${integrationStatus.errorMessage || 'Authentication expired'}. Please reconnect your Google account in Settings.`
          };
        }

        const actionableTaskMessageIds = new Set(
          activeTasks.map(t => (t.sourceContext as any)?.messageId).filter(Boolean)
        );

        const actionableEmails: EmailRecord[] = [];
        const informationalEmails: EmailRecord[] = [];

        emails.slice(0, 20).forEach(e => {
          const isLinkedToTask = actionableTaskMessageIds.has(e.id);
          const text = `${e.subject || ''} ${e.snippet || ''}`.toLowerCase();
          const hasActionCue = text.includes('apply') || text.includes('submit') || text.includes('registration') || text.includes('register') || text.includes('deadline') || text.includes('exam') || text.includes('guidelines');

          if (isLinkedToTask || hasActionCue) {
            actionableEmails.push(e);
          } else {
            informationalEmails.push(e);
          }
        });

        if (classification.subType === 'actionable_only') {
          return { actionableEmails: actionableEmails.slice(0, 5) };
        }

        return {
          actionableEmails: actionableEmails.slice(0, 3),
          informationalEmails: informationalEmails.slice(0, 3)
        };
      }

      case 'priority_rationale': {
        return {
          matchedTasks: classification.matchedRecords?.tasks || []
        };
      }

      case 'follow_up':
      case 'specific_lookup': {
        return {
          matchedTasks: classification.matchedRecords?.tasks || [],
          matchedEmails: classification.matchedRecords?.emails || [],
          matchedEvents: classification.matchedRecords?.calendarEvents || []
        };
      }

      case 'ambiguous': {
        return {};
      }

      case 'general':
      default: {
        return {
          prioritizedTasks: activeTasks.filter(t => isGenuineActionableTask(t)).slice(0, 3)
        };
      }
    }
  }

  /**
   * Extracts structured SourceMetadata array from filtered data.
   */
  public extractSourceMetadata(
    classification: ClassificationResult,
    filteredData: FilteredAssistantData
  ): SourceMetadata[] {
    const sources: SourceMetadata[] = [];
    const seenIds = new Set<string>();

    const addSource = (id: string, type: 'task' | 'gmail' | 'calendar', title?: string, sender?: string) => {
      if (!id || seenIds.has(id)) return;
      seenIds.add(id);
      sources.push({ id, type, title, sender });
    };

    filteredData.prioritizedTasks?.forEach(t => addSource(t.id, 'task', t.title));
    filteredData.yourDayItems?.forEach(it => {
      const id = it.rawResponsibility?.id || it.sourceId || it.id;
      const type = it.sourceType === 'calendar' ? 'calendar' : it.sourceType === 'gmail' ? 'gmail' : 'task';
      addSource(id, type, it.title, it.sender);
    });
    filteredData.overdueTasks?.forEach(t => addSource(t.id, 'task', t.title));
    filteredData.passedItems?.forEach(it => {
      const id = it.rawResponsibility?.id || it.sourceId || it.id;
      const type = it.sourceType === 'calendar' ? 'calendar' : it.sourceType === 'gmail' ? 'gmail' : 'task';
      addSource(id, type, it.title, it.sender);
    });
    filteredData.upcomingTasks?.forEach(t => addSource(t.id, 'task', t.title));
    filteredData.upcomingItems?.forEach(it => {
      const id = it.rawResponsibility?.id || it.sourceId || it.id;
      const type = it.sourceType === 'calendar' ? 'calendar' : it.sourceType === 'gmail' ? 'gmail' : 'task';
      addSource(id, type, it.title, it.sender);
    });
    filteredData.tomorrowTasks?.forEach(t => addSource(t.id, 'task', t.title));
    filteredData.tomorrowItems?.forEach(it => {
      const id = it.rawResponsibility?.id || it.sourceId || it.id;
      const type = it.sourceType === 'calendar' ? 'calendar' : it.sourceType === 'gmail' ? 'gmail' : 'task';
      addSource(id, type, it.title, it.sender);
    });
    filteredData.todayTasks?.forEach(t => addSource(t.id, 'task', t.title));
    filteredData.matchedTasks?.forEach(t => addSource(t.id, 'task', t.title));
    filteredData.academicItems?.forEach(it => {
      const id = it.rawResponsibility?.id || it.sourceId || it.id;
      const type = it.sourceType === 'calendar' ? 'calendar' : it.sourceType === 'gmail' ? 'gmail' : 'task';
      addSource(id, type, it.title, it.sender);
    });
    filteredData.careerItems?.forEach(it => {
      const id = it.rawResponsibility?.id || it.sourceId || it.id;
      const type = it.sourceType === 'calendar' ? 'calendar' : it.sourceType === 'gmail' ? 'gmail' : 'task';
      addSource(id, type, it.title, it.sender);
    });

    filteredData.weekTasks?.forEach(t => addSource(t.id, 'task', t.title));
    filteredData.weekEvents?.forEach(ev => addSource(ev.id, 'calendar', ev.summary));
    filteredData.pendingApplications?.forEach(t => addSource(t.id, 'task', t.title));
    filteredData.placementEmails?.forEach(e => addSource(e.id, 'gmail', e.subject, this.cleanSender(e.sender)));
    filteredData.placementTasks?.forEach(t => addSource(t.id, 'task', t.title));
    filteredData.internshipEmails?.forEach(e => addSource(e.id, 'gmail', e.subject, this.cleanSender(e.sender)));
    filteredData.internshipTasks?.forEach(t => addSource(t.id, 'task', t.title));

    filteredData.todayEvents?.forEach(ev => addSource(ev.id, 'calendar', ev.summary));
    filteredData.tomorrowEvents?.forEach(ev => addSource(ev.id, 'calendar', ev.summary));
    filteredData.upcomingEvents?.forEach(ev => addSource(ev.id, 'calendar', ev.summary));
    filteredData.matchedEvents?.forEach(ev => addSource(ev.id, 'calendar', ev.summary));

    filteredData.opportunityTasks?.forEach(t => addSource(t.id, 'task', t.title));
    filteredData.opportunityEmails?.forEach(e => addSource(e.id, 'gmail', e.subject, this.cleanSender(e.sender)));
    filteredData.opportunityDiscoveries?.forEach(d => {
      addSource(d.sourceId || d.id, d.sourceType === 'calendar' ? 'calendar' : 'gmail', d.title);
    });
    if (filteredData.targetDiscovery) {
      addSource(filteredData.targetDiscovery.sourceId || filteredData.targetDiscovery.id, filteredData.targetDiscovery.sourceType === 'calendar' ? 'calendar' : 'gmail', filteredData.targetDiscovery.title);
    }

    if (filteredData.targetEmail) {
      addSource(filteredData.targetEmail.id, 'gmail', filteredData.targetEmail.subject, this.cleanSender(filteredData.targetEmail.sender));
    }
    filteredData.actionableEmails?.forEach(e => addSource(e.id, 'gmail', e.subject, this.cleanSender(e.sender)));
    filteredData.informationalEmails?.forEach(e => addSource(e.id, 'gmail', e.subject, this.cleanSender(e.sender)));
    filteredData.matchedEmails?.forEach(e => addSource(e.id, 'gmail', e.subject, this.cleanSender(e.sender)));

    return sources;
  }

  /**
   * Builds focused context data for LLM grounded prompt according to classified intent.
   */
  private buildFocusedContextRepresentation(params: {
    classification: ClassificationResult;
    filteredData: FilteredAssistantData;
    todayStr: string;
    tomorrowStr: string;
    currentTimeStr: string;
    readableDate: string;
    readableTime: string;
  }): string {
    const { classification, filteredData, todayStr, tomorrowStr, currentTimeStr, readableDate, readableTime } = params;

    let text = `CURRENT DATE & TIME: ${readableDate} at ${readableTime} (Local Date: ${todayStr}, Time: ${currentTimeStr})\n`;
    text += `TOMORROW'S DATE: ${tomorrowStr}\n`;
    text += `USER QUERY INTENT: ${classification.intent.toUpperCase()}\n\n`;

    switch (classification.intent) {
      case 'prioritization': {
        text += `=== TOP ACTIONABLE RESPONSIBILITIES FOR TODAY (${filteredData.prioritizedTasks?.length || 0} items) ===\n`;
        filteredData.prioritizedTasks?.forEach((t, i) => {
          const dueText = t.dueDate ? `${t.dueDate.substring(0, 10)}${t.dueTime ? ' at ' + t.dueTime : ''}` : 'No deadline';
          text += `[${i + 1}] Title: "${t.title}" | Priority: ${t.priority.toUpperCase()} | Deadline: ${dueText}\n`;
          if (t.action) text += `    Action: ${t.action}\n`;
          if (t.description) text += `    Description: ${t.description.substring(0, 150)}\n`;
          text += `    SourceTag: ${this.getTaskSourceTag(t)}\n\n`;
        });
        break;
      }

      case 'overdue': {
        text += `=== OVERDUE INCOMPLETE RESPONSIBILITIES (${filteredData.overdueTasks?.length || 0} items) ===\n`;
        filteredData.overdueTasks?.forEach((t, i) => {
          const dueText = `${t.dueDate?.substring(0, 10)}${t.dueTime ? ' at ' + t.dueTime : ''}`;
          text += `[${i + 1}] Title: "${t.title}" | Priority: ${t.priority.toUpperCase()} | Missed Deadline: ${dueText}\n`;
          if (t.action) text += `    Action: ${t.action}\n`;
          text += `    SourceTag: ${this.getTaskSourceTag(t)}\n\n`;
        });
        break;
      }

      case 'upcoming_deadlines': {
        if (classification.subType === 'tomorrow_only') {
          text += `=== RESPONSIBILITIES DUE TOMORROW (${filteredData.tomorrowTasks?.length || 0} items) ===\n`;
          filteredData.tomorrowTasks?.forEach((t, i) => {
            text += `[${i + 1}] Title: "${t.title}" | Due: Tomorrow (${tomorrowStr})${t.dueTime ? ' at ' + t.dueTime : ''} | Priority: ${t.priority.toUpperCase()}\n`;
            if (t.action) text += `    Action: ${t.action}\n`;
            text += `    SourceTag: ${this.getTaskSourceTag(t)}\n\n`;
          });
          break;
        }

        text += `=== UPCOMING ACTIONABLE DEADLINES (${filteredData.upcomingTasks?.length || 0} items) ===\n`;
        filteredData.upcomingTasks?.forEach((t, i) => {
          const dueText = t.dueDate ? `${t.dueDate.substring(0, 10)}${t.dueTime ? ' at ' + t.dueTime : ''}` : 'No deadline';
          text += `[${i + 1}] Title: "${t.title}" | Deadline: ${dueText} | Priority: ${t.priority.toUpperCase()}\n`;
          if (t.action) text += `    Action: ${t.action}\n`;
          text += `    SourceTag: ${this.getTaskSourceTag(t)}\n\n`;
        });
        break;
      }

      case 'calendar_schedule': {
        text += `=== TODAY'S CALENDAR EVENTS (${filteredData.todayEvents?.length || 0} items) ===\n`;
        filteredData.todayEvents?.forEach((ev, i) => {
          text += `[${i + 1}] Event: "${ev.summary}" | Start: ${ev.startTime} | End: ${ev.endTime}\n`;
          text += `    SourceTag: ${this.getCalendarSourceTag(ev)}\n\n`;
        });
        break;
      }

      case 'today_overview': {
        text += `=== TODAY'S SCHEDULE & TIME-SENSITIVE RESPONSIBILITIES ===\n`;
        text += `Calendar Events Scheduled Today (${filteredData.todayEvents?.length || 0}):\n`;
        if (!filteredData.todayEvents || filteredData.todayEvents.length === 0) {
          text += `(No calendar events scheduled for today)\n`;
        } else {
          filteredData.todayEvents.forEach((ev, i) => {
            text += `[Event ${i + 1}] "${ev.summary}" | Time: ${ev.startTime}${ev.location ? ' at ' + ev.location : ''}\n`;
            text += `    SourceTag: ${this.getCalendarSourceTag(ev)}\n`;
          });
        }
        text += `\nResponsibilities Due Today (${filteredData.todayTasks?.length || 0}):\n`;
        if (!filteredData.todayTasks || filteredData.todayTasks.length === 0) {
          text += `(No responsibilities due today)\n`;
        } else {
          filteredData.todayTasks.forEach((t, i) => {
            text += `[Task ${i + 1}] "${t.title}" | Priority: ${t.priority.toUpperCase()}${t.dueTime ? ' by ' + t.dueTime : ''}\n`;
            if (t.action) text += `    Action: ${t.action}\n`;
            text += `    SourceTag: ${this.getTaskSourceTag(t)}\n`;
          });
        }
        break;
      }

      case 'email_explanation': {
        const e = filteredData.targetEmail || filteredData.matchedEmails?.[0];
        if (e) {
          text += `=== EMAIL TO EXPLAIN ===\n`;
          text += `Subject: "${e.subject}"\n`;
          text += `From: ${e.sender}\n`;
          text += `Received: ${e.receivedAt}\n`;
          if (e.snippet) text += `Snippet: ${e.snippet}\n`;
          text += `SourceTag: ${this.getEmailSourceTag(e)}\n\n`;

          const tasks = filteredData.matchedTasks || [];
          if (tasks.length > 0) {
            text += `Detected Responsibilities Linked to this Email (${tasks.length}):\n`;
            tasks.forEach(t => {
              text += `- Responsibility: "${t.title}" | Action: "${t.action || t.title}" | Due: ${t.dueDate || 'None'}\n`;
            });
          } else {
            text += `No action required or pending responsibilities are linked to this email.\n`;
          }
        }
        break;
      }

      case 'email_action_check': {
        const e = filteredData.targetEmail || filteredData.matchedEmails?.[0];
        if (e) {
          text += `=== EMAIL TO CHECK FOR REQUIRED ACTION ===\n`;
          text += `Subject: "${e.subject}"\n`;
          text += `From: ${e.sender}\n`;
          text += `Received: ${e.receivedAt}\n`;
          if (e.snippet) text += `Snippet: ${e.snippet}\n`;
          text += `SourceTag: ${this.getEmailSourceTag(e)}\n\n`;

          const tasks = filteredData.matchedTasks || [];
          if (tasks.length > 0) {
            text += `Required User Actions Found (${tasks.length}):\n`;
            tasks.forEach(t => {
              text += `- Action: "${t.action || t.title}" | Responsible: Recipient (User) | Deadline: ${t.dueDate || 'No explicit deadline'}\n`;
            });
          } else {
            text += `No action required: This email is informational only.\n`;
          }
        }
        break;
      }

      case 'email_summary': {
        text += `=== ACTIONABLE EMAILS (${filteredData.actionableEmails?.length || 0} items) ===\n`;
        filteredData.actionableEmails?.forEach((e, i) => {
          text += `[${i + 1}] Subject: "${e.subject}" | From: ${e.sender} | Date: ${e.receivedAt}\n`;
          if (e.snippet) text += `    Snippet: ${e.snippet.substring(0, 140)}\n`;
          text += `    SourceTag: ${this.getEmailSourceTag(e)}\n\n`;
        });
        text += `=== INFORMATIONAL EMAILS (${filteredData.informationalEmails?.length || 0} items) ===\n`;
        filteredData.informationalEmails?.forEach((e, i) => {
          text += `[${i + 1}] Subject: "${e.subject}" | From: ${e.sender} | Date: ${e.receivedAt}\n`;
          if (e.snippet) text += `    Snippet: ${e.snippet.substring(0, 140)}\n`;
          text += `    SourceTag: ${this.getEmailSourceTag(e)}\n\n`;
        });
        break;
      }

      case 'follow_up':
      case 'priority_rationale':
      case 'specific_lookup': {
        text += `=== MATCHED SPECIFIC RECORDS FOR "${classification.targetEntity || 'Target'}" ===\n`;
        filteredData.matchedTasks?.forEach((t, i) => {
          text += `[Task ${i + 1}] Title: "${t.title}" | Priority: ${t.priority} | Due: ${t.dueDate?.substring(0, 10) || 'None'}\n`;
          if (t.action) text += `    Action: ${t.action}\n`;
          if (t.description) text += `    Description: ${t.description.substring(0, 150)}\n`;
          text += `    SourceTag: ${this.getTaskSourceTag(t)}\n\n`;
        });
        filteredData.matchedEmails?.forEach((e, i) => {
          text += `[Email ${i + 1}] Subject: "${e.subject}" | From: ${e.sender}\n`;
          if (e.snippet) text += `    Snippet: ${e.snippet.substring(0, 140)}\n`;
          text += `    SourceTag: ${this.getEmailSourceTag(e)}\n\n`;
        });
        filteredData.matchedEvents?.forEach((ev, i) => {
          text += `[Event ${i + 1}] Summary: "${ev.summary}" | Time: ${ev.startTime}\n`;
          text += `    SourceTag: ${this.getCalendarSourceTag(ev)}\n\n`;
        });
        break;
      }

      case 'meeting_lookup': {
        text += `=== SCHEDULED MEETINGS & CALENDAR EVENTS ===\n`;
        const events = filteredData.matchedEvents || [];
        if (events.length > 0) {
          events.forEach((ev, i) => {
            text += `[Meeting ${i + 1}] Title: "${ev.summary}" | StartTime: ${ev.startTime} | EndTime: ${ev.endTime}${ev.location ? ' | Location: ' + ev.location : ''}\n`;
            text += `    SourceTag: ${this.getCalendarSourceTag(ev)}\n\n`;
          });
        } else {
          text += `No scheduled meetings found on Google Calendar.\n\n`;
        }
        const emails = filteredData.matchedEmails || [];
        if (emails.length > 0) {
          text += `=== MEETING-RELATED EMAILS ===\n`;
          emails.forEach((e, i) => {
            text += `[Email ${i + 1}] Subject: "${e.subject}" | From: ${e.sender} | Date: ${e.receivedAt}\n`;
            if (e.snippet) text += `    Snippet: ${e.snippet.substring(0, 140)}\n`;
            text += `    SourceTag: ${this.getEmailSourceTag(e)}\n\n`;
          });
        }
        break;
      }

      case 'opportunities': {
        text += `=== CAREER & INTERNSHIP OPPORTUNITIES ===\n`;
        const oppTasks = filteredData.opportunityTasks || [];
        const oppEmails = filteredData.opportunityEmails || [];
        if (oppTasks.length === 0 && oppEmails.length === 0) {
          text += `No internship, job, or career opportunity records found in user connected accounts.\n\n`;
        } else {
          oppTasks.forEach((t, i) => {
            const dueText = t.dueDate ? `${t.dueDate.substring(0, 10)}${t.dueTime ? ' at ' + t.dueTime : ''}` : 'No strict deadline';
            text += `[Task/Responsibility ${i + 1}] Title: "${t.title}" | Deadline: ${dueText} | Priority: ${t.priority.toUpperCase()}\n`;
            if (t.action) text += `    Action: ${t.action}\n`;
            if (t.description) text += `    Description: ${t.description.substring(0, 150)}\n`;
            text += `    SourceTag: ${this.getTaskSourceTag(t)}\n\n`;
          });
          oppEmails.forEach((e, i) => {
            text += `[Opportunity Email ${i + 1}] Subject: "${e.subject}" | From: ${e.sender} | Date: ${e.receivedAt}\n`;
            if (e.snippet) text += `    Snippet: ${e.snippet.substring(0, 150)}\n`;
            text += `    SourceTag: ${this.getEmailSourceTag(e)}\n\n`;
          });
        }
        break;
      }

      default: {
        text += `Active responsibilities: ${filteredData.prioritizedTasks?.length || 0}\n`;
        break;
      }
    }

    return text;
  }

  /**
   * Calls the configured LLM with grounding instructions tailored specifically to the user's intent.
   */
  private async callLLMForChat(
    classification: ClassificationResult,
    contextData: string,
    history: ChatMessage[],
    question: string
  ): Promise<string> {
    const apiKey = env.LLM_API_KEY;
    const provider = env.LLM_PROVIDER || 'gemini';
    const model = env.LLM_MODEL || 'gemini-flash-lite-latest';

    const systemPrompt = `You are LifeSynch AI Assistant, the user's personal digital life and task assistant.
Your job is to understand what the user is asking and answer that specific question directly with the right amount of detail.
DO NOT return a full data dump.

CORE RULES:
1. STRICT FACTUAL ACCURACY: Only mention responsibilities, dates, times, and actions present in the provided context snapshot. NEVER invent deadlines or facts.
2. ANSWER DIRECTLY & CONCISELY: Give the direct answer first. Include only details needed to answer the question, with a short explanation where useful. Prefer 1–3 relevant items or a brief paragraph.
3. NEVER APPEND UNRELATED SECTIONS: Do not automatically append ongoing programs, unrelated calendar events, or email dumps just because data exists.
4. INTENT-SPECIFIC INSTRUCTIONS:
   - "What should I focus on today?": Recommend STRICTLY the top 1–3 most important actionable responsibilities for today based on actual priority, deadlines, overdue status, and context. Briefly explain why each matters. Do NOT list ongoing programs, unrelated calendar events, or email dumps.
   - "What am I overdue on?": Show ONLY incomplete responsibilities whose deadlines have passed. Exclude ongoing informational activities and future deadlines. If none, explicitly state: "You have no overdue responsibilities."
   - "What is happening today?": Answer using BOTH today's scheduled calendar events and time-sensitive responsibilities due today.
   - "What does this email mean?": Explain the actual message in plain language and identify any action required, if one exists.
   - "Do I need to do anything about this email?": Explain whether action is required, what the action is, who should take it, and any genuine deadline.
   - "What is on my calendar today?": Show relevant calendar events for today. Do NOT replace with or append a responsibility report.
   - "What deadlines are coming up?": Show upcoming actionable deadlines ordered chronologically by nearest deadline. If asking specifically about tomorrow, show ONLY tomorrow's items.
   - "When is my meeting?" / "Do I have any meetings today?": If scheduled meeting(s) exist, state the exact time, date, title, and location/link of the scheduled meeting(s). If no meetings are scheduled for today (or no upcoming meetings on the calendar), state clearly: "You don't have any meetings scheduled for today." (or "You don't have any upcoming meetings scheduled on your calendar."). Never say "I could not find any record of that item in your connected accounts..." when asked about scheduled meetings.
   - "Any new internships?" / Career opportunities: Highlight matching career opportunities and internships from connected messages or records. Include the organization, role/program, and key dates. If none exist, clearly say so.
   - "Summarize my important emails.": Summarize only relevant important emails, distinguishing actionable requests from informational messages.
   - Specific entity/person/topic lookups (e.g. asking about a specific person, project code, or item that does not exist): If no matching record was found in the user data snapshot, state clearly: "I could not find any record of that item in your connected accounts."
   - Follow-up questions: Answer the specific follow-up question (e.g. why urgent, what action needed, who sent) about the entity referenced from conversation history.
5. CLICKABLE SOURCE LINKS: Use the exact SourceTag provided in the context snapshot at the end of each item (e.g. [Source: Gmail - <Sender> | id:<id>] or [Source: Calendar | id:<id>] or [Source: Task | id:<id>]).`;

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

      const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

      const contextPreamble = `${systemPrompt}\n\nUSER REAL DATA SNAPSHOT:\n${contextData}\n\n---`;
      contents.push({
        role: 'user',
        parts: [{ text: contextPreamble }]
      });
      contents.push({
        role: 'model',
        parts: [{ text: "Understood. I will answer the user's specific question directly and concisely based strictly on this filtered data." }]
      });

      const recentHistory = history.slice(-4);
      for (const msg of recentHistory) {
        contents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        });
      }

      contents.push({
        role: 'user',
        parts: [{ text: question }]
      });

      let lastErrorText = '';
      for (const m of candidateModels) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
        const payload = {
          contents,
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 500
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
          logger.warn(`Gemini assistant call on model ${m} returned HTTP ${res.status}: ${lastErrorText.substring(0, 120)}`);
          if (res.status === 429 || res.status === 401 || res.status === 403) {
            break;
          }
          if (res.status !== 404 && res.status !== 503 && res.status !== 500) {
            break;
          }
        }
      }

      throw new Error(`Gemini assistant invocation failed: ${lastErrorText}`);
    } else {
      const baseUrl = provider === 'groq'
        ? 'https://api.groq.com/openai/v1/chat/completions'
        : 'https://api.openai.com/v1/chat/completions';

      const messages: Array<{ role: string; content: string }> = [
        {
          role: 'system',
          content: `${systemPrompt}\n\nUSER REAL DATA SNAPSHOT:\n${contextData}`
        }
      ];

      const recentHistory = history.slice(-4);
      for (const msg of recentHistory) {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      }

      messages.push({
        role: 'user',
        content: question
      });

      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.1,
          max_tokens: 500
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`${provider} chat completion failed: ${res.status} ${errText}`);
      }

      const json = await res.json() as any;
      const content = json.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from LLM provider.');
      }
      return content;
    }
  }

  /**
   * Deterministic answer generation based directly on the user's structured data.
   * Guarantees 100% adherence to real data, strict intent relevance, and no hallucination.
   */
  public generateDeterministicAnswer(params: {
    question: string;
    classification: ClassificationResult;
    filteredData: FilteredAssistantData;
    todayStr: string;
    tomorrowStr: string;
    currentTimeStr: string;
    currentIso?: string;
    thisWeekStartStr?: string;
    thisWeekEndStr?: string;
    nextWeekStartStr?: string;
    nextWeekEndStr?: string;
    activeTasks: Responsibility[];
    allTasks: Responsibility[];
    calendarEvents: CalendarEventRecord[];
    emails: EmailRecord[];
  }): string {
    const {
      classification,
      filteredData,
      todayStr,
      tomorrowStr,
      currentTimeStr,
      nextWeekStartStr,
      nextWeekEndStr,
      thisWeekEndStr,
      activeTasks
    } = params;

    switch (classification.intent) {
      // 1. “What should I focus on today?” / "What should I do today?" (Actionable Your Day items only)
      case 'prioritization': {
        if (classification.subType === 'highest_single') {
          const topTasks = filteredData.prioritizedTasks || [];
          const overdueTasks = filteredData.overdueTasks || [];
          const top = topTasks[0] || activeTasks[0];

          if (!top) {
            return "You have no pending tasks or responsibilities right now. You're completely caught up!";
          }

          const dueStr = this.formatDueString(top, todayStr, tomorrowStr);
          const prioStr = ` [${top.priority.toUpperCase()} priority]`;
          const actionText = top.action ? ` Action needed: ${top.action}.` : '';
          const srcTag = this.getTaskSourceTag(top);

          let resp = `The most important thing you need to do is **${top.title}**${prioStr}, which is due **${dueStr}**.${actionText} ${srcTag}`;

          if (overdueTasks.length > 0 && overdueTasks[0].id !== top.id) {
            const od = overdueTasks[0];
            const odDate = od.dueDate ? od.dueDate.substring(0, 10) : 'an earlier date';
            resp += `\n\n*(Note: You also have an overdue item requiring urgent resolution: **${od.title}**, missed deadline on **${odDate}**). ${this.getTaskSourceTag(od)}*`;
          }

          return resp;
        }

        const yourDay = filteredData.yourDayItems || [];
        const topTasks = filteredData.prioritizedTasks || [];
        const items = yourDay.length > 0 ? yourDay : topTasks.map(t => ({
          id: t.id,
          title: t.title,
          summary: t.action || t.description || '',
          formattedScheduleText: t.dueTime ? `Today by ${t.dueTime}` : 'Today',
          time: t.dueTime,
          rawResponsibility: t
        } as any));

        if (items.length === 0) {
          return "You have no actionable responsibilities or deadlines due today in Your Day. You're completely caught up!";
        }

        const lines: string[] = [
          `Here ${items.length === 1 ? 'is the' : 'are the'} ${items.length} actionable ${items.length === 1 ? 'responsibility' : 'responsibilities'} to focus on today in **Your Day**:`
        ];

        items.forEach(it => {
          const reason = it.rawResponsibility
            ? this.getPriorityReason(it.rawResponsibility, todayStr, currentTimeStr)
            : (it.time ? `Scheduled for today at ${it.time}.` : 'Scheduled for today.');
          const actionText = it.summary ? ` ${it.summary}.` : '';
          const srcTag = this.getItemSourceTag(it);
          lines.push(`* **${it.title}**: ${reason}${actionText} ${srcTag}`);
        });

        return lines.join('\n');
      }

      // 2. “What should I focus on tomorrow?” / Tomorrow Queries
      case 'focus_tomorrow': {
        const tomorrowTasks = filteredData.tomorrowTasks || [];
        const tomorrowEvents = filteredData.tomorrowEvents || [];
        const isEventsOnly = classification.subType === 'events_only' || /\bevents?\b/i.test(params.question);
        const isTasksOnly = classification.subType === 'tasks_only' || /\btasks?\b/i.test(params.question);

        if (isEventsOnly) {
          if (tomorrowEvents.length === 0) {
            return `You have no calendar events or meetings scheduled for tomorrow (**Friday, ${tomorrowStr}**).`;
          }
          const lines = [`Here ${tomorrowEvents.length === 1 ? 'is your event' : 'are your events'} scheduled for tomorrow (**Friday, ${tomorrowStr}**):`];
          tomorrowEvents.forEach(ev => {
            const time = ev.startTime.includes('T') ? ev.startTime.split('T')[1].substring(0, 5) : 'All Day';
            const loc = ev.location ? ` at ${ev.location}` : '';
            lines.push(`* **${ev.summary}**: Scheduled event at **${time}**${loc}. ${this.getCalendarSourceTag(ev)}`);
          });
          return lines.join('\n');
        }

        if (isTasksOnly) {
          if (tomorrowTasks.length === 0) {
            return `You have no tasks or responsibilities due tomorrow (**Friday, ${tomorrowStr}**).`;
          }
          const lines = [`Here ${tomorrowTasks.length === 1 ? 'is the task' : 'are the tasks'} due tomorrow (**Friday, ${tomorrowStr}**):`];
          tomorrowTasks.forEach(t => {
            const timeStr = t.dueTime ? ` by ${t.dueTime}` : '';
            const actionText = t.action ? ` Action: ${t.action}.` : '';
            const srcTag = this.getTaskSourceTag(t);
            lines.push(`* **${t.title}**: Due **Tomorrow (${tomorrowStr})${timeStr}** [${t.priority.toUpperCase()} priority].${actionText} ${srcTag}`);
          });
          return lines.join('\n');
        }

        // Default focus for tomorrow: combines tomorrow tasks and calendar events
        if (tomorrowTasks.length === 0 && tomorrowEvents.length === 0) {
          return `You have no tasks due tomorrow and no calendar events scheduled for tomorrow (**Friday, ${tomorrowStr}**). You're completely free!`;
        }

        const lines: string[] = [`Here is what you should focus on tomorrow (**Friday, ${tomorrowStr}**):`];

        if (tomorrowTasks.length > 0) {
          lines.push(`\n### Tasks & Deadlines Due Tomorrow`);
          tomorrowTasks.forEach(t => {
            const timeStr = t.dueTime ? ` by ${t.dueTime}` : '';
            const actionText = t.action ? ` Action: ${t.action}.` : '';
            const srcTag = this.getTaskSourceTag(t);
            lines.push(`* **${t.title}**: Due **Tomorrow (${tomorrowStr})${timeStr}** [${t.priority.toUpperCase()} priority].${actionText} ${srcTag}`);
          });
        }

        lines.push(`\n### Calendar Schedule Tomorrow`);
        if (tomorrowEvents.length > 0) {
          tomorrowEvents.forEach(ev => {
            const time = ev.startTime.includes('T') ? ev.startTime.split('T')[1].substring(0, 5) : 'All Day';
            const loc = ev.location ? ` at ${ev.location}` : '';
            lines.push(`* **${ev.summary}**: Scheduled event at **${time}**${loc}. ${this.getCalendarSourceTag(ev)}`);
          });
        } else {
          lines.push(`* You have no calendar events or meetings scheduled for tomorrow.`);
        }

        return lines.join('\n');
      }

      // 3. “What are my upcoming events?”
      case 'upcoming_events': {
        const events = filteredData.upcomingEvents || [];
        if (events.length === 0) {
          return "You have no upcoming calendar events scheduled.";
        }
        const lines: string[] = ["Here are your upcoming calendar events:"];
        events.forEach(ev => {
          const dateStr = ev.startTime.substring(0, 10);
          const time = ev.startTime.includes('T') ? ev.startTime.split('T')[1].substring(0, 5) : 'All Day';
          const loc = ev.location ? ` at ${ev.location}` : '';
          lines.push(`* **${ev.summary}**: **${dateStr}** at ${time}${loc}. ${this.getCalendarSourceTag(ev)}`);
        });
        return lines.join('\n');
      }

      // 4. “What is scheduled next week / this week?”
      case 'week_schedule': {
        const isNextWeek = classification.subType === 'next_week';
        const label = isNextWeek ? `next week (${nextWeekStartStr || 'Nov 9'} – ${nextWeekEndStr || 'Nov 15'})` : `this week (through ${thisWeekEndStr || 'Nov 8'})`;
        const weekTasks = filteredData.weekTasks || [];
        const weekEvents = filteredData.weekEvents || [];
        const asksForEvents = /\bevents?\b/i.test(params.question);

        if (asksForEvents) {
          if (weekEvents.length === 0) {
            return `You have no calendar events scheduled for ${label}.`;
          }
          const lines = [`Here are your scheduled events for ${label}:`];
          weekEvents.forEach(ev => {
            const dateStr = ev.startTime.substring(0, 10);
            const time = ev.startTime.includes('T') ? ev.startTime.split('T')[1].substring(0, 5) : 'All Day';
            lines.push(`* **${ev.summary}**: **${dateStr}** at ${time}. ${this.getCalendarSourceTag(ev)}`);
          });
          return lines.join('\n');
        }

        if (weekTasks.length === 0 && weekEvents.length === 0) {
          return `You have no tasks or calendar events scheduled for ${label}.`;
        }

        const lines = [`Here is what is scheduled for ${label}:`];
        if (weekTasks.length > 0) {
          lines.push(`\n### Tasks & Deadlines`);
          weekTasks.forEach(t => {
            const dueStr = t.dueDate ? t.dueDate.substring(0, 10) : 'Next week';
            const actionText = t.action ? ` Action: ${t.action}.` : '';
            lines.push(`* **${t.title}**: Due **${dueStr}** [${t.priority.toUpperCase()} priority].${actionText} ${this.getTaskSourceTag(t)}`);
          });
        }
        if (weekEvents.length > 0) {
          lines.push(`\n### Calendar Events`);
          weekEvents.forEach(ev => {
            const dateStr = ev.startTime.substring(0, 10);
            const time = ev.startTime.includes('T') ? ev.startTime.split('T')[1].substring(0, 5) : 'All Day';
            lines.push(`* **${ev.summary}**: **${dateStr}** at ${time}. ${this.getCalendarSourceTag(ev)}`);
          });
        } else {
          lines.push(`\n### Calendar Events\n* You have no calendar events scheduled for ${label}.`);
        }
        return lines.join('\n');
      }

      // 5. “Show my pending applications”
      case 'pending_applications': {
        const apps = filteredData.pendingApplications || [];
        const opps = filteredData.opportunityDiscoveries || [];
        if (apps.length === 0 && opps.length === 0) {
          return "You currently have no pending applications or registrations in your records.";
        }

        const lines = ["Here are your pending applications and registration deadlines:"];
        const seen = new Set<string>();

        apps.forEach(t => {
          seen.add(t.title.toLowerCase());
          const dueStr = t.dueDate ? `Due: **${this.formatDueString(t, todayStr, tomorrowStr)}**` : 'Active / Pending';
          const actionText = t.action ? ` Action: ${t.action}.` : '';
          const srcTag = this.getTaskSourceTag(t);
          lines.push(`* **${t.title}**: ${dueStr} [${t.priority.toUpperCase()} priority].${actionText} ${srcTag}`);
        });

        opps.forEach(d => {
          if (!seen.has(d.title.toLowerCase())) {
            seen.add(d.title.toLowerCase());
            const dateStr = d.primaryDate ? ` [Closing: **${d.primaryDate}**]` : '';
            const srcTag = d.sourceType === 'calendar' ? `[Source: Calendar | id:${d.sourceId}]` : `[Source: Gmail | id:${d.sourceId}]`;
            lines.push(`* **${d.title}**: ${d.explanation}${dateStr} ${srcTag}`);
          }
        });

        return lines.join('\n');
      }

      // 6. “Summarize my latest placement emails”
      case 'placement_updates': {
        const emails = filteredData.placementEmails || [];
        const tasks = filteredData.placementTasks || [];

        if (emails.length === 0 && tasks.length === 0) {
          return "You have no recent placement or campus recruitment updates in your connected accounts.";
        }

        const lines = ["Here is a summary of your latest placement and recruitment communications:"];

        emails.forEach(e => {
          const sender = this.cleanSender(e.sender);
          const snippet = e.snippet ? ` — ${e.snippet.substring(0, 140).trim()}...` : '';
          const srcTag = this.getEmailSourceTag(e);
          lines.push(`* **${e.subject || 'Placement Notice'}**: From ${sender}${snippet} ${srcTag}`);
        });

        if (tasks.length > 0) {
          lines.push(`\n### Associated Placement Tasks`);
          tasks.forEach(t => {
            const dueStr = t.dueDate ? ` (Due: **${this.formatDueString(t, todayStr, tomorrowStr)}**)` : '';
            lines.push(`* **${t.title}**${dueStr}: ${t.action || t.description || 'Action required.'} ${this.getTaskSourceTag(t)}`);
          });
        }

        return lines.join('\n');
      }

      // 7. “What is the latest update about my internship?”
      case 'internship_updates': {
        const emails = filteredData.internshipEmails || [];
        const tasks = filteredData.internshipTasks || [];

        if (emails.length === 0 && tasks.length === 0) {
          return "You have no recent internship updates or announcements in your connected accounts.";
        }

        const lines = ["Here is the latest update regarding internships and student opportunities:"];

        emails.forEach(e => {
          const sender = this.cleanSender(e.sender);
          const snippet = e.snippet ? ` — ${e.snippet.substring(0, 140).trim()}...` : '';
          const srcTag = this.getEmailSourceTag(e);
          lines.push(`* **${e.subject || 'Internship Opportunity'}**: From ${sender}${snippet} ${srcTag}`);
        });

        if (tasks.length > 0) {
          lines.push(`\n### Associated Internship Tasks`);
          tasks.forEach(t => {
            const dueStr = t.dueDate ? ` (Due: **${this.formatDueString(t, todayStr, tomorrowStr)}**)` : '';
            lines.push(`* **${t.title}**${dueStr}: ${t.action || t.description || 'Action required.'} ${this.getTaskSourceTag(t)}`);
          });
        }

        return lines.join('\n');
      }

      // 8. “What has passed?” / "Which tasks are overdue?"
      case 'passed':
      case 'overdue': {
        const passedItems = filteredData.passedItems || [];
        const overdue = filteredData.overdueTasks || [];
        const items = overdue.length > 0 ? overdue.map(t => ({
          id: t.id,
          title: t.title,
          summary: t.action || t.description || '',
          formattedScheduleText: t.dueDate ? `${t.dueDate.substring(0, 10)}${t.dueTime ? ' at ' + t.dueTime : ''}` : 'past deadline',
          date: t.dueDate,
          time: t.dueTime,
          rawResponsibility: t
        } as any)) : passedItems;

        if (items.length === 0) {
          return "You have no overdue responsibilities! All of your scheduled obligations are up to date.";
        }

        const count = items.length;
        const lines = [
          `You have ${count} overdue ${count === 1 ? 'task' : 'tasks'} whose deadline${count === 1 ? ' has' : 's have'} passed:`
        ];

        items.slice(0, 8).forEach(it => {
          const dateStr = it.formattedScheduleText || (it.date ? it.date.substring(0, 10) : 'earlier date');
          const prioStr = it.rawResponsibility ? ` [${it.rawResponsibility.priority.toUpperCase()} priority]` : '';
          const actionText = it.summary ? ` Action: ${it.summary}.` : ` Missed deadline on ${dateStr}.`;
          const srcTag = this.getItemSourceTag(it);
          lines.push(`* **${it.title}**: Missed deadline on **${dateStr}**${prioStr}.${actionText} ${srcTag}`);
        });

        return lines.join('\n');
      }

      // 9. “What deadlines are coming up?” / "What are my upcoming tasks?"
      case 'upcoming_deadlines': {
        if (classification.subType === 'tomorrow_only') {
          const tomorrowTasks = filteredData.tomorrowTasks || [];
          const tomorrowEvents = filteredData.tomorrowEvents || [];
          const tomorrowItems = filteredData.tomorrowItems || [];
          const items = tomorrowItems.length > 0 ? tomorrowItems : tomorrowTasks.map(t => ({
            id: t.id,
            title: t.title,
            summary: t.action || t.description || '',
            time: t.dueTime,
            rawResponsibility: t
          } as any));

          if (items.length === 0 && tomorrowEvents.length === 0) {
            return "You have no responsibilities due tomorrow and no calendar events scheduled for tomorrow.";
          }

          const lines: string[] = [];
          if (items.length > 0) {
            lines.push(`You have ${items.length} ${items.length === 1 ? 'responsibility' : 'responsibilities'} due tomorrow:`);
            items.forEach(t => {
              const time = t.time ? ` at ${t.time}` : (t.rawResponsibility?.dueTime ? ` at ${t.rawResponsibility.dueTime}` : '');
              const prio = t.rawResponsibility ? ` [${t.rawResponsibility.priority.toUpperCase()} priority]` : '';
              const action = t.summary ? ` Action: ${t.summary}.` : '';
              const srcTag = this.getItemSourceTag(t);
              lines.push(`* **${t.title}**: Due **Tomorrow**${time}${prio}.${action} ${srcTag}`);
            });
          }

          if (tomorrowEvents.length > 0) {
            if (lines.length > 0) lines.push('');
            lines.push(`Tomorrow's scheduled events:`);
            tomorrowEvents.forEach(ev => {
              const time = ev.startTime.includes('T') ? ev.startTime.split('T')[1].substring(0, 5) : 'All Day';
              lines.push(`* **${ev.summary}**: Scheduled event at **${time}**. [Source: Calendar | id:${ev.id}]`);
            });
          }

          return lines.join('\n');
        }

        const upcomingTasks = filteredData.upcomingTasks || [];
        const upcomingEvents = filteredData.upcomingEvents || [];
        const isTasksOnly = classification.subType === 'tasks_only' || /\btasks?\b/i.test(params.question);

        if (upcomingTasks.length === 0 && (isTasksOnly || upcomingEvents.length === 0)) {
          return "You currently have no upcoming tasks or deadlines scheduled.";
        }

        const lines: string[] = [];

        if (isTasksOnly) {
          lines.push("Here are your upcoming tasks, ordered by nearest deadline:");
          upcomingTasks.slice(0, 8).forEach(t => {
            const dueStr = this.formatDueString(t, todayStr, tomorrowStr);
            const prioStr = ` [${t.priority.toUpperCase()} priority]`;
            const actionText = t.action ? ` Action: ${t.action}.` : '';
            const srcTag = this.getTaskSourceTag(t);
            lines.push(`* **${t.title}**: Due **${dueStr}**${prioStr}.${actionText} ${srcTag}`);
          });
          return lines.join('\n');
        }

        lines.push("Here are your upcoming deadlines and approaching commitments:");

        if (upcomingTasks.length > 0) {
          lines.push(`\n### Upcoming Deadlines`);
          upcomingTasks.slice(0, 8).forEach(t => {
            const dueStr = this.formatDueString(t, todayStr, tomorrowStr);
            const prioStr = ` [${t.priority.toUpperCase()} priority]`;
            const actionText = t.action ? ` Action: ${t.action}.` : '';
            const srcTag = this.getTaskSourceTag(t);
            lines.push(`* **${t.title}**: Due **${dueStr}**${prioStr}.${actionText} ${srcTag}`);
          });
        }

        if (upcomingEvents.length > 0) {
          lines.push(`\n### Scheduled Events & Meetings`);
          upcomingEvents.slice(0, 3).forEach(ev => {
            const isToday = ev.startTime.startsWith(todayStr);
            const isTomorrow = ev.startTime.startsWith(tomorrowStr);
            const dateStr = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : ev.startTime.substring(0, 10);
            const time = ev.startTime.includes('T') ? ev.startTime.split('T')[1].substring(0, 5) : 'All Day';
            const loc = ev.location ? ` at ${ev.location}` : '';
            lines.push(`* **${ev.summary}**: **${dateStr}** at ${time}${loc}. [Source: Calendar | id:${ev.id}]`);
          });
        }

        return lines.join('\n');
      }

      // 4. Academic Updates Query ("Show my academic updates")
      case 'academic_updates': {
        const academic = filteredData.academicItems || [];
        const discs = filteredData.opportunityDiscoveries || [];
        const tasks = filteredData.matchedTasks || [];
        if (academic.length === 0 && discs.length === 0 && tasks.length === 0) {
          return "You currently have no academic updates or responsibilities in your records.";
        }
        const lines: string[] = ["Here are your academic updates and learning records:"];
        if (discs.length > 0) {
          discs.forEach(d => {
            const srcTag = d.sourceType === 'calendar' ? `[Source: Calendar | id:${d.sourceId}]` : `[Source: Gmail | id:${d.sourceId}]`;
            lines.push(`* **${d.title}**: ${d.explanation} ${srcTag}`);
          });
        }
        const seen = new Set<string>();
        academic.slice(0, 8).forEach(it => {
          seen.add(it.title.toLowerCase());
          const sched = it.formattedScheduleText && it.formattedScheduleText !== 'No deadline' ? ` [${it.formattedScheduleText}]` : '';
          const action = it.summary ? ` ${it.summary}.` : '';
          const srcTag = this.getItemSourceTag(it);
          lines.push(`* **${it.title}**: ${action || 'Academic notice.'}${sched} ${srcTag}`);
        });
        tasks.slice(0, 4).forEach(t => {
          if (!seen.has(t.title.toLowerCase())) {
            seen.add(t.title.toLowerCase());
            const dueStr = this.formatDueString(t, todayStr, tomorrowStr);
            const srcTag = this.getTaskSourceTag(t);
            lines.push(`* **${t.title}**: Due ${dueStr}. ${t.action || ''} ${srcTag}`);
          }
        });
        return lines.join('\n');
      }

      // 4. “What is on my calendar today?” / Calendar Schedule
      case 'calendar_schedule': {
        const events = filteredData.todayEvents || [];

        if (events.length === 0) {
          return "You have no calendar events scheduled for today.";
        }

        const lines: string[] = ["Here is what is on your calendar today:"];
        events.forEach(ev => {
          const time = ev.startTime.includes('T') ? ev.startTime.split('T')[1].substring(0, 5) : 'All Day';
          const loc = ev.location ? ` at ${ev.location}` : '';
          lines.push(`* **${ev.summary}**: Scheduled event at ${time}${loc}. [Source: Calendar | id:${ev.id}]`);
        });

        return lines.join('\n');
      }

      // 5. “What is happening today?” (Calendar events AND time-sensitive responsibilities)
      case 'today_overview': {
        const events = filteredData.todayEvents || [];
        const tasks = filteredData.todayTasks || [];

        if (events.length === 0 && tasks.length === 0) {
          return "You have no calendar events and no responsibilities scheduled for today.";
        }

        const lines: string[] = ["Here is what is happening today:"];

        if (events.length > 0) {
          lines.push(`\n### Today's Calendar Events`);
          events.forEach(ev => {
            const time = ev.startTime.includes('T') ? ev.startTime.split('T')[1].substring(0, 5) : 'All Day';
            const loc = ev.location ? ` at ${ev.location}` : '';
            lines.push(`* **${ev.summary}**: Scheduled event at ${time}${loc}. [Source: Calendar | id:${ev.id}]`);
          });
        }

        if (tasks.length > 0) {
          lines.push(`\n### Today's Time-Sensitive Responsibilities`);
          tasks.forEach(t => {
            const time = t.dueTime ? ` by ${t.dueTime}` : '';
            const actionText = t.action ? ` (${t.action})` : '';
            const srcTag = this.getTaskSourceTag(t);
            lines.push(`* **${t.title}**: Due today${time} [${t.priority.toUpperCase()} priority].${actionText} ${srcTag}`);
          });
        }

        return lines.join('\n');
      }

      // 6. “What does this email mean?”
      case 'email_explanation': {
        const email = filteredData.targetEmail || filteredData.matchedEmails?.[0];
        if (!email) {
          return "I could not find the email you are referring to in your connected account.";
        }

        const sender = this.cleanSender(email.sender);
        const tasks = filteredData.matchedTasks || [];
        const srcTag = this.getEmailSourceTag(email);

        const lines: string[] = [
          `**Email**: "${email.subject}" from ${sender}.`,
          `\n**What the sender is communicating**:`
        ];

        if (email.snippet) {
          lines.push(`> ${email.snippet}`);
        }

        if (tasks.length > 0) {
          const t = tasks[0];
          const dueStr = t.dueDate ? ` by ${this.formatDueString(t, todayStr, tomorrowStr)}` : '';
          lines.push(`\n**Action Required**: Yes, you are expected to **${t.action || t.title}**${dueStr}. [${t.priority.toUpperCase()} priority]`);
        } else {
          lines.push(`\n**Action Required**: No action is required from you. This email is informational.`);
        }

        lines.push(`\n${srcTag}`);
        return lines.join('\n');
      }

      // 7. “Do I need to do anything about this email?”
      case 'email_action_check': {
        const email = filteredData.targetEmail || filteredData.matchedEmails?.[0];
        if (!email) {
          return "I could not find the email you are referring to in your connected account.";
        }

        const sender = this.cleanSender(email.sender);
        const tasks = filteredData.matchedTasks || [];
        const srcTag = this.getEmailSourceTag(email);

        if (tasks.length > 0) {
          const t = tasks[0];
          const dueStr = t.dueDate ? ` Deadline: ${this.formatDueString(t, todayStr, tomorrowStr)}.` : ' No strict deadline specified.';
          return `**Yes, action is required.**\n* **Action**: ${t.action || t.title}\n* **Responsible**: You (the recipient)\n* **Deadline**: ${dueStr}\n* **From**: ${sender}\n\n${srcTag}`;
        }

        return `**No action is required from you.** This email from ${sender} is informational only and does not establish any personal responsibility or deadline.\n\n${srcTag}`;
      }

      // 5. “Summarize my important emails.”
      case 'email_summary': {
        const actionable = filteredData.actionableEmails || [];
        const informational = filteredData.informationalEmails || [];

        if (actionable.length === 0 && informational.length === 0) {
          return "No synced emails were found in your connected account.";
        }

        const lines: string[] = ["Here is a summary of your recent important emails:"];

        if (actionable.length > 0) {
          lines.push(`\n### Actionable Requests`);
          actionable.forEach(e => {
            const sender = this.cleanSender(e.sender);
            const snippet = e.snippet ? ` — ${e.snippet.substring(0, 110).trim()}...` : '';
            lines.push(`* **${e.subject || 'Action Required'}**: From ${sender}${snippet} [Source: Gmail - ${sender} | id:${e.id}]`);
          });
        }

        if (informational.length > 0) {
          lines.push(`\n### Informational Updates`);
          informational.forEach(e => {
            const sender = this.cleanSender(e.sender);
            const snippet = e.snippet ? ` — ${e.snippet.substring(0, 110).trim()}...` : '';
            lines.push(`* **${e.subject || 'Announcement'}**: From ${sender}${snippet} [Source: Gmail - ${sender} | id:${e.id}]`);
          });
        }

        return lines.join('\n');
      }

      // 6. Priority Rationale Query ("Why is this responsibility high priority?")
      case 'priority_rationale': {
        const matched = filteredData.matchedTasks || [];
        if (matched.length === 0) {
          return "You currently do not have any responsibilities marked as high priority.";
        }
        const top = matched[0];
        const dueInfo = top.dueDate ? `due ${this.formatDueString(top, todayStr, tomorrowStr)}` : 'an urgent pending action';
        const sender = top.sourceContext?.sender ? ` received from ${top.sourceContext.sender}` : '';
        const srcTag = this.getTaskSourceTag(top);
        return `**${top.title}** is marked high priority because it is ${dueInfo}${sender}, requiring prompt action: "${top.action || top.title}". LifeSynch automatically prioritizes obligations approaching deadlines or requiring formal submission. ${srcTag}`;
      }

      // 7. Follow-up query
      case 'follow_up': {
        const matchedTasks = filteredData.matchedTasks || [];
        const matchedEmails = filteredData.matchedEmails || [];
        const matchedEvents = filteredData.matchedEvents || [];

        if (matchedTasks.length > 0) {
          const t = matchedTasks[0];
          const srcTag = this.getTaskSourceTag(t);

          if (params.question.toLowerCase().includes('why') && (params.question.toLowerCase().includes('priority') || params.question.toLowerCase().includes('urgent'))) {
            const dueInfo = t.dueDate ? `due ${this.formatDueString(t, todayStr, tomorrowStr)}` : 'urgent pending action';
            return `**${t.title}** is marked high priority because it is ${dueInfo}, requiring prompt action: "${t.action || t.title}". ${srcTag}`;
          }

          if (params.question.toLowerCase().includes('action') || params.question.toLowerCase().includes('submit') || params.question.toLowerCase().includes('portal') || params.question.toLowerCase().includes('how')) {
            const actionText = t.action || t.description || 'Submit required documentation on the portal';
            return `For **${t.title}**, the action required is: "${actionText}". ${srcTag}`;
          }

          if (params.question.toLowerCase().includes('who') || params.question.toLowerCase().includes('sender')) {
            const sender = t.sourceContext?.sender || t.source;
            return `**${t.title}** was received from ${sender}. ${srcTag}`;
          }

          const dueStr = t.dueDate ? `Deadline: ${this.formatDueString(t, todayStr, tomorrowStr)}.` : 'No strict deadline.';
          const action = t.action ? ` Action: ${t.action}.` : '';
          return `* **${t.title}** [${t.priority.toUpperCase()} priority]: ${dueStr}${action} ${srcTag}`;
        }

        if (matchedEmails.length > 0) {
          const e = matchedEmails[0];
          const sender = this.cleanSender(e.sender);
          return `**${e.subject}**: Received from ${sender}. Snippet: "${e.snippet || 'No preview'}" [Source: Gmail - ${sender} | id:${e.id}]`;
        }

        if (matchedEvents.length > 0) {
          const ev = matchedEvents[0];
          return `**${ev.summary}**: Scheduled event at ${ev.startTime}${ev.location ? ' at ' + ev.location : ''}. [Source: Calendar | id:${ev.id}]`;
        }

        return `I could not resolve which specific item you are referring to from previous messages. Could you please specify the responsibility or event name?`;
      }

      // 8. Specific questions / Lookups
      case 'specific_lookup': {
        const matchedTasks = filteredData.matchedTasks || [];
        const matchedEmails = filteredData.matchedEmails || [];
        const matchedEvents = filteredData.matchedEvents || [];

        if (matchedTasks.length === 0 && matchedEmails.length === 0 && matchedEvents.length === 0) {
          return `I could not find any record of "${classification.targetEntity}" in your connected accounts. That information is currently unavailable.`;
        }

        const lines: string[] = [];

        if (matchedTasks.length > 0) {
          matchedTasks.forEach(t => {
            const dueStr = t.dueDate ? `Deadline: ${this.formatDueString(t, todayStr, tomorrowStr)}.` : 'No strict deadline.';
            const action = t.action ? ` Action: ${t.action}.` : '';
            const desc = t.description && t.description !== t.action ? ` ${t.description.substring(0, 140)}` : '';
            const srcTag = this.getTaskSourceTag(t);
            lines.push(`* **${t.title}** [${t.priority.toUpperCase()} priority]: ${dueStr}${action}${desc} ${srcTag}`);
          });
        } else if (matchedEmails.length > 0) {
          matchedEmails.forEach(e => {
            const sender = this.cleanSender(e.sender);
            const snippet = e.snippet ? ` ${e.snippet.substring(0, 140)}` : '';
            lines.push(`* **${e.subject || 'Email'}**: Received from ${sender}.${snippet} [Source: Gmail - ${sender} | id:${e.id}]`);
          });
        } else if (matchedEvents.length > 0) {
          matchedEvents.forEach(ev => {
            const time = ev.startTime.includes('T') ? ev.startTime.split('T')[1].substring(0, 5) : 'All Day';
            lines.push(`* **${ev.summary}**: Scheduled event at ${time}. [Source: Calendar | id:${ev.id}]`);
          });
        }

        return lines.join('\n');
      }

      // 9. Meeting Lookup
      case 'meeting_lookup': {
        const events = filteredData.matchedEvents || [];
        const emails = filteredData.matchedEmails || [];

        if (events.length > 0) {
          const nextEv = events[0];
          const isToday = nextEv.startTime.startsWith(todayStr);
          const isTomorrow = nextEv.startTime.startsWith(tomorrowStr);
          const dateLabel = isToday ? 'today' : isTomorrow ? 'tomorrow' : nextEv.startTime.substring(0, 10);
          const time = nextEv.startTime.includes('T') ? nextEv.startTime.split('T')[1].substring(0, 5) : 'All Day';
          const loc = nextEv.location ? ` in ${nextEv.location}` : '';
          const srcTag = this.getCalendarSourceTag(nextEv);

          if (events.length === 1) {
            return `Your next scheduled meeting is **${nextEv.summary}** ${dateLabel} at **${time}**${loc}. ${srcTag}`;
          }

          const lines: string[] = [`Here are your scheduled meetings:`];
          events.forEach(ev => {
            const evToday = ev.startTime.startsWith(todayStr);
            const evTomorrow = ev.startTime.startsWith(tomorrowStr);
            const dLabel = evToday ? 'Today' : evTomorrow ? 'Tomorrow' : ev.startTime.substring(0, 10);
            const t = ev.startTime.includes('T') ? ev.startTime.split('T')[1].substring(0, 5) : 'All Day';
            const l = ev.location ? ` at ${ev.location}` : '';
            lines.push(`* **${ev.summary}**: Scheduled for ${dLabel} at **${t}**${l}. ${this.getCalendarSourceTag(ev)}`);
          });
          return lines.join('\n');
        }

        if (emails.length > 0) {
          const e = emails[0];
          const sender = this.cleanSender(e.sender);
          return `You do not have a confirmed calendar event, but you received a meeting notification: **${e.subject}** from ${sender}. ${e.snippet ? `"${e.snippet.substring(0, 120)}..."` : ''} ${this.getEmailSourceTag(e)}`;
        }

        const isTodayQuery = classification.subType === 'today_only' || /\b(today|tonight|this morning|this afternoon)\b/i.test(params.question);
        if (isTodayQuery) {
          return "You don't have any meetings scheduled for today.";
        }

        return "You have no meetings scheduled on your calendar for today or the immediate future.";
      }

      // 10. Career Opportunities & Internships
      case 'opportunities': {
        const discs = filteredData.opportunityDiscoveries || [];
        const career = filteredData.careerItems || [];
        const oppTasks = filteredData.opportunityTasks || [];
        const oppEmails = filteredData.opportunityEmails || [];

        if (discs.length === 0 && career.length === 0 && oppTasks.length === 0 && oppEmails.length === 0) {
          return "I searched your connected Gmail and Responsibilities, but found no new internship, job, or placement opportunity announcements at this time.";
        }

        const lines: string[] = ["Here are the career and internship opportunities found in your connected accounts:"];
        const seenTitles = new Set<string>();

        discs.forEach(d => {
          seenTitles.add(d.title.toLowerCase());
          const datePart = d.primaryDate ? ` [Closing: ${d.primaryDate}]` : '';
          const srcTag = d.sourceType === 'calendar' ? `[Source: Calendar | id:${d.sourceId}]` : `[Source: Gmail | id:${d.sourceId}]`;
          lines.push(`* **${d.title}**: ${d.explanation}${datePart} ${srcTag}`);
        });

        career.forEach(it => {
          if (!seenTitles.has(it.title.toLowerCase())) {
            seenTitles.add(it.title.toLowerCase());
            const sched = it.formattedScheduleText && it.formattedScheduleText !== 'No deadline' ? ` [${it.formattedScheduleText}]` : '';
            const srcTag = this.getItemSourceTag(it);
            lines.push(`* **${it.title}**: ${it.summary || 'Career opportunity / drive.'}${sched} ${srcTag}`);
          }
        });

        oppTasks.forEach(t => {
          if (!seenTitles.has(t.title.toLowerCase())) {
            seenTitles.add(t.title.toLowerCase());
            const dueStr = t.dueDate ? `Due: **${this.formatDueString(t, todayStr, tomorrowStr)}**` : 'Informational / No strict deadline';
            const actionText = t.action ? ` ${t.action}.` : (t.description ? ` ${t.description.substring(0, 120)}` : '');
            const srcTag = this.getTaskSourceTag(t);
            lines.push(`* **${t.title}**: ${dueStr}.${actionText} ${srcTag}`);
          }
        });

        oppEmails.forEach(e => {
          const subject = e.subject || 'Opportunity';
          if (!seenTitles.has(subject.toLowerCase())) {
            seenTitles.add(subject.toLowerCase());
            const sender = this.cleanSender(e.sender);
            const snippet = e.snippet ? ` — ${e.snippet.substring(0, 130).trim()}...` : '';
            const srcTag = this.getEmailSourceTag(e);
            lines.push(`* **${subject}**: From ${sender}${snippet} ${srcTag}`);
          }
        });

        return lines.join('\n');
      }

      // 11. Ambiguous query
      case 'ambiguous': {
        return "Could you please clarify what you would like to know? For example, you can ask about your daily focus, upcoming deadlines, overdue tasks, today's calendar schedule, or an email summary.";
      }

      // 10. General question fallback
      case 'general':
      default: {
        if (activeTasks.length > 0) {
          const top = activeTasks[0];
          return `Based on your connected accounts, you have ${activeTasks.length} active responsibilities. Your top priority item is **${top.title}**${top.dueDate ? ' (due ' + top.dueDate.substring(0, 10) + ')' : ''}. Ask me what to focus on today, what deadlines are coming up, or to summarize your important emails!`;
        }
        return 'I am your LifeSynch assistant. Ask me what to focus on today, what deadlines are coming up, what you are overdue on, or to summarize your important emails!';
      }
    }
  }

  /**
   * Helper: Explains why a top responsibility matters for today's focus.
   */
  private getPriorityReason(t: Responsibility, todayStr: string, currentTimeStr: string): string {
    const isDueToday = t.dueDate && t.dueDate.startsWith(todayStr);
    const isOverdue = t.status === 'OVERDUE' || (t.dueDate && (t.dueDate.substring(0, 10) < todayStr || (t.dueDate.substring(0, 10) === todayStr && t.dueTime && t.dueTime < currentTimeStr)));

    if (isDueToday) {
      if (t.dueTime) {
        return `Scheduled for today at ${t.dueTime}. ${t.action || 'Requires prompt attention.'}`;
      }
      return `High-priority deadline closing today. ${t.action || 'Requires submission or action today.'}`;
    }

    if (isOverdue) {
      return `Overdue deadline (${t.dueDate?.substring(0, 10)}). ${t.action || 'Requires urgent follow-up.'}`;
    }

    if (t.priority === 'high') {
      return `High-priority obligation approaching soon (${t.dueDate ? t.dueDate.substring(0, 10) : 'active'}). ${t.action || 'Key priority.'}`;
    }

    return t.action || t.description || 'Important responsibility to progress today.';
  }

  /**
   * Helper: Formats due string with readable relative markers (Today, Tomorrow, Date).
   */
  public formatDueString(task: Responsibility, todayStr: string, tomorrowStr: string): string {
    if (!task.dueDate) return 'No deadline';
    const dateOnly = task.dueDate.substring(0, 10);
    const timeStr = task.dueTime ? ` at ${task.dueTime}` : '';

    if (dateOnly === todayStr) return `Today${timeStr}`;
    if (dateOnly === tomorrowStr) return `Tomorrow${timeStr}`;
    return `${dateOnly}${timeStr}`;
  }

  /**
   * Helper: Cleans email sender address for readable presentation.
   */
  public cleanSender(sender?: string): string {
    if (!sender) return 'System';
    const stripped = sender.replace(/<.*>/, '').trim();
    return stripped || 'Gmail';
  }

  /**
   * Helper: Formats unified ClassifiedLifeItem source tag.
   */
  public getItemSourceTag(item: ClassifiedLifeItem): string {
    if (item.rawResponsibility) {
      return this.getTaskSourceTag(item.rawResponsibility);
    }
    if (item.rawEmail) {
      return this.getEmailSourceTag(item.rawEmail);
    }
    if (item.rawCalendarEvent) {
      return this.getCalendarSourceTag(item.rawCalendarEvent);
    }
    if (item.sourceType === 'calendar') {
      return `[Source: Calendar | id:${item.sourceId}]`;
    }
    if (item.sourceType === 'gmail') {
      const sender = this.cleanSender(item.sender);
      return `[Source: Gmail - ${sender} | id:${item.sourceId}]`;
    }
    return `[Source: Task | id:${item.id}]`;
  }

  /**
   * Helper: Formats source tag with ID for UI clickability.
   */
  public getTaskSourceTag(task: Responsibility): string {
    const messageId = (task.sourceContext as any)?.messageId;
    const sender = this.cleanSender(task.sourceContext?.sender || task.sourceDisplay || task.source);

    if (task.source === 'gmail' || messageId) {
      return messageId ? `[Source: Gmail - ${sender} | id:${messageId}]` : `[Source: Gmail - ${sender} | id:${task.id}]`;
    }
    if (task.source === 'calendar' || (task.sourceContext as any)?.calendarEventId) {
      const calId = (task.sourceContext as any)?.calendarEventId || task.id;
      return `[Source: Calendar | id:${calId}]`;
    }
    return `[Source: Task | id:${task.id}]`;
  }

  public getEmailSourceTag(email: EmailRecord): string {
    const sender = this.cleanSender(email.sender);
    return `[Source: Gmail - ${sender} | id:${email.id}]`;
  }

  public getCalendarSourceTag(event: CalendarEventRecord): string {
    return `[Source: Calendar | id:${event.id}]`;
  }

  /**
   * Generates 2-3 contextual, high-value suggested follow-up questions for the chat UI.
   */
  public generateSuggestedQuestions(
    classification: ClassificationResult,
    filteredData: FilteredAssistantData,
    allTasks: Responsibility[],
    emails: EmailRecord[],
    calendarEvents: CalendarEventRecord[]
  ): string[] {
    switch (classification.intent) {
      case 'focus_tomorrow': {
        return [
          'What are my upcoming tasks?',
          'What should I focus on today?',
          'Do I have any meetings tomorrow?'
        ];
      }

      case 'upcoming_events': {
        return [
          'What deadlines are approaching?',
          'What should I focus on today?',
          'What is on my calendar today?'
        ];
      }

      case 'week_schedule': {
        return [
          'What should I focus on tomorrow?',
          'What deadlines are approaching?',
          'Show my upcoming tasks'
        ];
      }

      case 'pending_applications': {
        return [
          'What deadlines are approaching?',
          'Show my upcoming tasks',
          'What is the most important thing I need to do?'
        ];
      }

      case 'placement_updates': {
        return [
          'Show my pending applications',
          'What deadlines are approaching?',
          'What is the most important thing I need to do?'
        ];
      }

      case 'internship_updates': {
        return [
          'Show my pending applications',
          'What deadlines are approaching?',
          'What should I focus on today?'
        ];
      }

      case 'prioritization': {
        const top = filteredData.prioritizedTasks?.[0];
        const suggestions: string[] = [];
        if (top) {
          const shortTitle = top.title.length > 30 ? top.title.substring(0, 30) + '...' : top.title;
          suggestions.push(`Tell me more about ${shortTitle}`);
        }
        suggestions.push('What deadlines are coming up?');
        suggestions.push('Do I have any meetings today?');
        return suggestions.slice(0, 3);
      }

      case 'upcoming_deadlines': {
        return [
          'What should I focus on today?',
          'What am I overdue on?',
          'Do I have any meetings today?'
        ];
      }

      case 'opportunities': {
        const oppTitle = filteredData.opportunityTasks?.[0]?.title || filteredData.opportunityEmails?.[0]?.subject;
        const suggestions: string[] = [];
        if (oppTitle) {
          const shortTitle = oppTitle.length > 30 ? oppTitle.substring(0, 30) + '...' : oppTitle;
          suggestions.push(`Tell me more about ${shortTitle}`);
        }
        suggestions.push('What deadlines are coming up?');
        suggestions.push('What should I focus on today?');
        return suggestions.slice(0, 3);
      }

      case 'meeting_lookup': {
        return [
          'What else is on my schedule today?',
          'What should I focus on today?',
          'Summarize my important emails'
        ];
      }

      case 'academic_updates': {
        return [
          'What should I do today?',
          'What deadlines are coming up?',
          'Any new career opportunities?'
        ];
      }

      case 'passed':
      case 'overdue': {
        return [
          'What should I focus on today?',
          'What deadlines are coming up?',
          'Summarize my important emails'
        ];
      }

      case 'email_explanation':
      case 'email_action_check': {
        return [
          'Do I need to take any action on this?',
          'When is the deadline?',
          'What should I focus on today?'
        ];
      }

      case 'email_summary': {
        return [
          'Do I have any actionable emails?',
          'What should I focus on today?',
          'What deadlines are coming up?'
        ];
      }

      case 'calendar_schedule':
      case 'today_overview': {
        return [
          'What should I focus on today?',
          'What deadlines are coming up?',
          'Summarize my important emails'
        ];
      }

      case 'specific_lookup': {
        const target = classification.targetEntity;
        if (target) {
          return [
            `What action do I need to take for ${target}?`,
            'What should I focus on today?',
            'What deadlines are coming up?'
          ];
        }
        return [
          'What should I focus on today?',
          'What deadlines are coming up?',
          'Any new internships or opportunities?'
        ];
      }

      default: {
        return [
          'What should I focus on today?',
          'What deadlines are coming up?',
          'Any new internships or opportunities?'
        ];
      }
    }
  }
}

export const assistantService = new AssistantService();
