import { EmailRecord, CalendarEventRecord, Responsibility } from '@lifesynch/shared';
import { IntelligentDiscovery } from '../services/intelligentDiscoveryService';
import { LifeCategoryId } from '../services/lifeCategoryService';
import { cleanEmailDescription, deriveSpecificNextStep } from './textUtils';

export interface WorthKnowingDetails {
  title: string;
  category: LifeCategoryId;
  badgeLabel: string;
  sourceType: 'gmail' | 'calendar' | 'cross_source';

  // 1. What is this about? – Short, clear explanation.
  about: string;

  // 2. Important details – Relevant dates, announcements, instructions or information.
  importantDetails: {
    datesAndSchedule?: string;
    windowDates?: { start?: string; end?: string };
    announcementsOrInstructions?: string[];
    location?: string;
    connectedSources?: Array<{ title: string; date?: string; type: string }>;
  };

  // 3. What should I know? – The key takeaway for the user.
  whatShouldIKnow: string;

  // 4. Action required – Clearly state whether the user needs to do anything or if it is informational only.
  action: {
    isRequired: boolean;
    text: string;
    subtext?: string;
  };

  // 5. Deadline – Show only if an actual deadline exists in the email.
  deadline?: {
    dueDate: string;
    dueTime?: string;
    formatted: string;
  };

  // 6. Source – Original email details, available separately if needed.
  source: {
    sender?: string;
    receivedAt?: string;
    subject?: string;
    rawBody?: string;
    sourceId: string;
    eventId?: string;
  };

  matchedResponsibility?: Responsibility;
}

/**
 * Formats date and time cleanly matching the style of the Responsibilities page.
 */
export function formatTableDueDate(dueStr?: string, dueTimeStr?: string): string {
  if (!dueStr) return 'No deadline';
  const d = new Date(dueStr);
  if (isNaN(d.getTime())) return dueStr;

  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const day = d.getDate();
  const datePart = `${month} ${day}`;

  if (dueTimeStr) {
    const [hStr, mStr] = dueTimeStr.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr || '00';
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    const timePart = m === '00' ? `${h} ${ampm}` : `${h}:${m} ${ampm}`;
    return `${datePart} ${timePart}`;
  }

  if (dueStr.includes('T') && !dueStr.includes('T00:00:00')) {
    const timePart = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return `${datePart} ${timePart}`;
  }

  return datePart;
}

/**
 * Extracts key instruction/announcement sentences from an email text without displaying the raw body.
 */
function extractImportantSentences(rawText: string): string[] {
  const cleaned = cleanEmailDescription(rawText);
  if (!cleaned) return [];

  // Split into sentences
  const sentences = cleaned
    .split(/(?<=[.!?])\s+|\n+/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.length < 220);

  const keywords = [
    'stipend', 'ppo', 'prize', 'award', '₹', 'rs.', 'lakh', 'cash prize',
    'eligibility', 'eligible', 'selection', 'rounds', 'mode', 'platform',
    'venue', 'link', 'register', 'apply', 'seats', 'accommodate', 'session',
    'scheduled', 'runs from', 'conducted on', 'guidelines', 'test series',
    'participants', 'transport', 'bus no', 'corrigendum', 'rescheduled'
  ];

  const matched: string[] = [];
  for (const s of sentences) {
    const lower = s.toLowerCase();
    if (keywords.some(kw => lower.includes(kw))) {
      // Avoid duplicates or near duplicates
      if (!matched.some(m => m.toLowerCase().includes(s.toLowerCase().slice(0, 30)))) {
        matched.push(s);
      }
    }
    if (matched.length >= 4) break;
  }

  return matched;
}

/**
 * Derives a short, clear explanation of what the item is about.
 */
function extractAboutExplanation(
  discovery: IntelligentDiscovery,
  matchingTask?: Responsibility,
  rawEmail?: EmailRecord,
  rawCalendar?: CalendarEventRecord
): string {
  // 1. If AI task has a meaningful description
  if (matchingTask?.description && matchingTask.description.trim().length > 15) {
    const desc = cleanEmailDescription(matchingTask.description);
    if (desc && desc.toLowerCase() !== matchingTask.title.toLowerCase()) {
      return desc;
    }
  }

  // 2. If email exists, extract clean summary (first 1-2 sentences of clean text)
  if (rawEmail) {
    const bodyClean = cleanEmailDescription(rawEmail.bodyText || rawEmail.snippet || '');
    if (bodyClean) {
      const paragraphs = bodyClean.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
      if (paragraphs.length > 0) {
        const firstPara = paragraphs[0];
        // If first paragraph is a good concise explanation (under 300 chars), use it
        if (firstPara.length <= 320) {
          return firstPara;
        }
        // Otherwise take the first 2 sentences
        const sentences = firstPara.match(/[^.!?]+[.!?]+/g);
        if (sentences && sentences.length > 0) {
          const combined = sentences.slice(0, 2).join(' ').trim();
          if (combined.length >= 30) return combined;
        }
        return firstPara.substring(0, 280).trim() + '...';
      }
    }
  }

  // 3. If calendar event has description
  if (rawCalendar?.description) {
    const calClean = cleanEmailDescription(rawCalendar.description);
    if (calClean) return calClean;
  }

  // 4. Fallback to discovery explanation or title
  return discovery.explanation || discovery.title;
}

/**
 * Finds a matching Responsibility in tasks if not already bound to discovery.
 */
function findMatchingResponsibility(
  discovery: IntelligentDiscovery,
  tasks: Responsibility[] = []
): Responsibility | undefined {
  if (discovery.rawResponsibility) return discovery.rawResponsibility;
  if (!tasks || tasks.length === 0) return undefined;

  const emailId = discovery.rawEmail?.id || (discovery.sourceType === 'gmail' ? discovery.sourceId : undefined);
  const eventId = discovery.rawCalendarEvent?.id || (discovery.sourceType === 'calendar' ? discovery.sourceId : undefined);
  const sub = discovery.rawEmail?.subject || discovery.title;

  return tasks.find(t => {
    if (emailId && (t.sourceId === emailId || (t.sourceContext as any)?.messageId === emailId)) {
      return true;
    }
    if (eventId && (t.sourceId === eventId || (t.sourceContext as any)?.calendarEventId === eventId)) {
      return true;
    }
    if (sub && t.title) {
      const cleanSub = sub.toLowerCase().replace(/^(re|fwd|fw):\s*/i, '').trim();
      const cleanT = t.title.toLowerCase().replace(/^(re|fwd|fw):\s*/i, '').trim();
      if (cleanSub && cleanT && (cleanSub.includes(cleanT) || cleanT.includes(cleanSub))) {
        return true;
      }
    }
    return false;
  });
}

/**
 * Builds the complete structured Worth Knowing Details using the existing AI extraction pipeline.
 */
export function extractWorthKnowingDetails(
  discovery: IntelligentDiscovery,
  tasks: Responsibility[] = []
): WorthKnowingDetails {
  const matchingTask = findMatchingResponsibility(discovery, tasks);
  const rawEmail = discovery.rawEmail;
  const rawCalendar = discovery.rawCalendarEvent;

  // 1. What is this about? – Short, clear explanation.
  const about = extractAboutExplanation(discovery, matchingTask, rawEmail, rawCalendar);

  // 2. What should I know? – The key takeaway for the user.
  // Reuses the AI-extracted "why it matters" explanation from the intelligent discovery engine.
  const whatShouldIKnow = discovery.explanation || 'Relevant opportunity and information surfaced from your connected communications.';

  // 3. Important details – Relevant dates, announcements, instructions or information.
  const importantSentences = extractImportantSentences(rawEmail?.bodyText || rawEmail?.snippet || '');
  
  // Application window if available from task
  const windowDates = (matchingTask?.sourceContext?.windowStartDate || matchingTask?.sourceContext?.windowEndDate)
    ? {
        start: matchingTask.sourceContext.windowStartDate ? formatTableDueDate(matchingTask.sourceContext.windowStartDate) : undefined,
        end: matchingTask.sourceContext.windowEndDate ? formatTableDueDate(matchingTask.sourceContext.windowEndDate) : undefined
      }
    : undefined;

  // Connected sources if multi-email cluster or cross-source
  const connectedSources = discovery.relatedSources && discovery.relatedSources.length > 1
    ? discovery.relatedSources.map(r => ({
        title: r.title,
        date: r.date ? new Date(r.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : undefined,
        type: r.type
      }))
    : undefined;

  const datesAndSchedule = rawCalendar?.startTime
    ? `Scheduled: ${new Date(rawCalendar.startTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
    : undefined;

  const location = (matchingTask?.sourceContext?.location as string | undefined) || rawCalendar?.location;

  // 4. Action required – Clearly state whether the user needs to do anything or if it is informational only.
  // Do NOT invent responsibilities, deadlines or actions.
  let isActionRequired = false;
  let actionText = 'Informational notice — No action required';
  let actionSubtext = 'This item is informational. You do not have any pending obligations or mandatory tasks for this update.';

  if (matchingTask?.action) {
    const cleanAction = matchingTask.action.trim();
    const isInfoClassification = 
      matchingTask.sourceContext?.classification === 'informational' ||
      matchingTask.sourceContext?.classification === 'program_schedule' ||
      cleanAction.toLowerCase().startsWith('no action') ||
      cleanAction.toLowerCase().includes('no action required') ||
      cleanAction.toLowerCase().includes('informational only');

    if (!isInfoClassification) {
      isActionRequired = true;
      const derived = deriveSpecificNextStep(matchingTask.title, cleanAction, false);
      actionText = derived.nextStep;
      actionSubtext = matchingTask.sourceContext?.nextStep || 'Action is required from you as indicated above.';
    }
  } else if (discovery.discoveryType === 'opportunity') {
    actionText = 'Informational opportunity — No action required';
    actionSubtext = 'Participation is optional. Review the opportunity details and apply if interested.';
  }

  // 5. Deadline – Show ONLY if an actual deadline exists in the email/task.
  // Do NOT invent deadlines for program durations or general notices.
  let deadline: WorthKnowingDetails['deadline'] | undefined = undefined;
  if (
    matchingTask?.dueDate &&
    matchingTask.sourceContext?.classification !== 'program_schedule' &&
    matchingTask.sourceContext?.deadlineType !== 'program_duration' &&
    matchingTask.sourceContext?.deadlineType !== 'none'
  ) {
    deadline = {
      dueDate: matchingTask.dueDate,
      dueTime: matchingTask.dueTime,
      formatted: formatTableDueDate(matchingTask.dueDate, matchingTask.dueTime)
    };
  }

  // 6. Source – Original email details, available separately if needed.
  const rawBody = cleanEmailDescription(rawEmail?.bodyText || rawEmail?.snippet || rawCalendar?.description || '');

  return {
    title: discovery.title,
    category: discovery.category,
    badgeLabel: discovery.badgeLabel,
    sourceType: discovery.sourceType,
    about,
    importantDetails: {
      datesAndSchedule,
      windowDates,
      announcementsOrInstructions: importantSentences.length > 0 ? importantSentences : undefined,
      location,
      connectedSources
    },
    whatShouldIKnow,
    action: {
      isRequired: isActionRequired,
      text: actionText,
      subtext: actionSubtext
    },
    deadline,
    source: {
      sender: rawEmail?.sender || matchingTask?.sourceContext?.sender,
      receivedAt: rawEmail?.receivedAt,
      subject: rawEmail?.subject || rawCalendar?.summary,
      rawBody: rawBody || undefined,
      sourceId: discovery.sourceId,
      eventId: rawCalendar?.id || (matchingTask?.sourceContext?.calendarEventId as string | undefined)
    },
    matchedResponsibility: matchingTask
  };
}

