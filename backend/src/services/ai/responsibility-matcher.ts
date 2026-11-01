import { ExtractedTask, Responsibility, TaskPriority, TaskSourceType } from '@lifesynch/shared';

// Common stop words to exclude when analyzing title semantics
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'for', 'in', 'on', 'at', 'to', 'of', 'by',
  'is', 'are', 'was', 'were', 'will', 'be', 'with', 'about', 'from', 'as',
  'your', 'my', 'our', 'this', 'that', 'it', 'its', 'please', 'scheduled',
  'discussion', 'meeting', 'reminder', 'invite', 'invitation', 're', 'fwd',
  'sub', 'submission', 'submit', 'task', 'event', 'session'
]);

/**
 * Extracts normalized semantic tokens from a title string.
 */
export function extractSemanticTokens(title: string): Set<string> {
  if (!title) return new Set();

  // Strip prefixes like "Re:", "Fwd:", "Reminder:", "Meeting:"
  const cleanTitle = title
    .replace(/^(re|fwd|fw|reminder|invitation|invite)\s*:\s*/gi, '')
    // Remove date patterns like "Sept 28", "September 28", "2026-09-28", "10:00 AM", "5 PM"
    .replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2}(st|nd|rd|th)?\b/gi, '')
    .replace(/\b\d{1,2}(st|nd|rd|th)?\s+(of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/gi, '')
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, '')
    .replace(/\b\d{1,2}(:\d{2})?\s*(am|pm)\b/gi, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();

  const rawWords = cleanTitle.split(/\s+/).filter(w => w.length > 2);
  const meaningfulWords = rawWords.filter(w => !STOP_WORDS.has(w));

  // If all words were stop words, fall back to raw words
  const finalWords = meaningfulWords.length > 0 ? meaningfulWords : rawWords;
  return new Set(finalWords);
}

/**
 * Computes Jaccard similarity and token overlap between two token sets.
 */
export function calculateTokenSimilarity(tokensA: Set<string>, tokensB: Set<string>): number {
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersectionCount = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      intersectionCount++;
    } else {
      // Check for partial substring match (e.g. "report" and "reports", "project" and "projects")
      for (const tB of tokensB) {
        if (token.startsWith(tB) || tB.startsWith(token)) {
          intersectionCount += 0.85;
          break;
        }
      }
    }
  }

  const unionSize = tokensA.size + tokensB.size - Math.floor(intersectionCount);
  const minSize = Math.min(tokensA.size, tokensB.size);

  const jaccard = intersectionCount / Math.max(unionSize, 1);
  const overlap = intersectionCount / Math.max(minSize, 1);

  // Return weighted metric (favoring significant subset overlap)
  return Math.max(jaccard, overlap);
}

/**
 * Checks whether two ISO date strings represent the same day or are within a 24-hour window.
 */
export function areDatesCompatible(
  dateA?: string | null,
  dateB?: string | null
): { compatible: boolean; sameDay: boolean } {
  if (!dateA || !dateB) {
    // If one or both lack a specific date, they can still be compatible if titles match strongly
    return { compatible: true, sameDay: false };
  }

  const dA = new Date(dateA);
  const dB = new Date(dateB);

  if (isNaN(dA.getTime()) || isNaN(dB.getTime())) {
    return { compatible: true, sameDay: false };
  }

  // Exact calendar date check
  const sameDay = dA.toISOString().split('T')[0] === dB.toISOString().split('T')[0];
  if (sameDay) {
    return { compatible: true, sameDay: true };
  }

  // Within 24-hour window check (accounts for UTC timezone differences)
  const diffHours = Math.abs(dA.getTime() - dB.getTime()) / (1000 * 60 * 60);
  if (diffHours <= 24) {
    return { compatible: true, sameDay: false };
  }

  // If dates are more than 24 hours apart, they refer to different deadlines/events
  return { compatible: false, sameDay: false };
}

/**
 * Detects if two titles describe conflicting sequential items (e.g. Assignment 7 vs Assignment 8, Lab 1 vs Lab 2).
 */
export function hasConflictingSequenceNumber(titleA: string, titleB: string): boolean {
  const extractNumbers = (t: string) => {
    const matches = t.match(/\b(assignment|week|lab|quiz|module|part|phase|round|milestone|session|ls)\s*[-:#]?\s*(\d+)\b/gi) || [];
    return matches.map(m => m.toLowerCase().replace(/[^a-z0-9]/g, ''));
  };

  const numsA = extractNumbers(titleA);
  const numsB = extractNumbers(titleB);

  if (numsA.length > 0 && numsB.length > 0) {
    for (const na of numsA) {
      const prefixA = na.replace(/\d+/g, '');
      for (const nb of numsB) {
        const prefixB = nb.replace(/\d+/g, '');
        if (prefixA === prefixB && na !== nb) {
          return true; // Conflicting sequence numbers!
        }
      }
    }
  }

  return false;
}

/**
 * Detects if two titles describe incompatible obligation types (e.g. Exam vs Assignment vs Workshop vs Payment).
 */
export function hasConflictingActivityType(titleA: string, titleB: string): boolean {
  const lowA = titleA.toLowerCase();
  const lowB = titleB.toLowerCase();

  const isExamA = /\b(exam|examination|viva|midterm|endsem|assessment|quiz|test)\b/i.test(lowA);
  const isExamB = /\b(exam|examination|viva|midterm|endsem|assessment|quiz|test)\b/i.test(lowB);

  const isAssignmentA = /\b(assignment|homework|lab report|problem statement|code submission)\b/i.test(lowA);
  const isAssignmentB = /\b(assignment|homework|lab report|problem statement|code submission)\b/i.test(lowB);

  const isSessionA = /\b(session|webinar|workshop|lecture|class|meetup|talk)\b/i.test(lowA);
  const isSessionB = /\b(session|webinar|workshop|lecture|class|meetup|talk)\b/i.test(lowB);

  const isFinanceA = /\b(fee|fees|tuition|payment|invoice|bill)\b/i.test(lowA);
  const isFinanceB = /\b(fee|fees|tuition|payment|invoice|bill)\b/i.test(lowB);

  if (isExamA !== isExamB && (isExamA || isExamB)) {
    if ((isExamA && (isAssignmentB || isSessionB || isFinanceB)) ||
        (isExamB && (isAssignmentA || isSessionA || isFinanceA))) {
      return true;
    }
  }

  if (isAssignmentA !== isAssignmentB && (isAssignmentA || isAssignmentB)) {
    if ((isAssignmentA && (isSessionB || isFinanceB)) ||
        (isAssignmentB && (isSessionA || isFinanceA))) {
      return true;
    }
  }

  return false;
}

/**
 * Determines whether two items represent the same underlying obligation or task.
 * Employs smart cross-source signals (Gmail + Calendar) while preventing false merges
 * of distinct obligations that share generic course/institutional words.
 */
export function isSameObligation(
  itemA: {
    title: string;
    dueDate?: string | null;
    dueTime?: string | null;
    sourceId?: string | null;
    secondarySourceId?: string | null;
    sourceType?: string | null;
    sourceContext?: Record<string, unknown> | null;
  },
  itemB: {
    title: string;
    dueDate?: string | null;
    dueTime?: string | null;
    sourceId?: string | null;
    secondarySourceId?: string | null;
    sourceType?: string | null;
    sourceContext?: Record<string, unknown> | null;
  }
): boolean {
  // 1. Direct and Secondary ID Match
  if (itemA.sourceId && itemB.sourceId && itemA.sourceId === itemB.sourceId) {
    return true;
  }

  const secA = (itemA as any).secondarySourceId as string | undefined;
  const secB = (itemB as any).secondarySourceId as string | undefined;
  if ((itemA.sourceId && secB && itemA.sourceId === secB) ||
      (itemB.sourceId && secA && itemB.sourceId === secA) ||
      (secA && secB && secA === secB)) {
    return true;
  }

  const calIdA = (itemA.sourceContext?.calendarEventId as string) || 
    (itemA.sourceType === 'calendar' ? itemA.sourceId : undefined) ||
    secA;
  const calIdB = (itemB.sourceContext?.calendarEventId as string) || 
    (itemB.sourceType === 'calendar' ? itemB.sourceId : undefined) ||
    secB;
  if (calIdA && calIdB && calIdA === calIdB) {
    return true;
  }

  const msgIdA = (itemA.sourceContext?.messageId as string) || 
    (itemA.sourceType === 'gmail' ? itemA.sourceId : undefined) ||
    (itemA.sourceType === 'both' ? itemA.sourceId : undefined);
  const msgIdB = (itemB.sourceContext?.messageId as string) || 
    (itemB.sourceType === 'gmail' ? itemB.sourceId : undefined) ||
    (itemB.sourceType === 'both' ? itemB.sourceId : undefined);
  if (msgIdA && msgIdB && msgIdA === msgIdB) {
    return true;
  }

  // 2. Conflict Guards: Never merge distinct obligations even if they share broad course/context words
  if (hasConflictingSequenceNumber(itemA.title, itemB.title)) {
    return false;
  }

  if (hasConflictingActivityType(itemA.title, itemB.title)) {
    return false;
  }

  // 3. Date Compatibility Check
  const dateCheck = areDatesCompatible(itemA.dueDate, itemB.dueDate);

  // 4. Normalized Title & Semantic Token Matching
  const tokensA = extractSemanticTokens(itemA.title);
  const tokensB = extractSemanticTokens(itemB.title);
  const similarity = calculateTokenSimilarity(tokensA, tokensB);

  const cleanA = itemA.title.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanB = itemB.title.toLowerCase().replace(/[^a-z0-9]/g, '');

  const exactCleanMatch = cleanA === cleanB || 
    (cleanA.length >= 6 && cleanB.length >= 6 && (cleanA.includes(cleanB) || cleanB.includes(cleanA)));

  // Cross-source contextual snippet / subject matching
  const contextA = `${itemA.sourceContext?.snippet || ''} ${itemA.sourceContext?.subject || ''} ${itemA.sourceContext?.description || ''}`.toLowerCase();
  const contextB = `${itemB.sourceContext?.snippet || ''} ${itemB.sourceContext?.subject || ''} ${itemB.sourceContext?.description || ''}`.toLowerCase();

  const tokensInContextA = Array.from(tokensB).filter(t => t.length > 2 && contextA.includes(t)).length;
  const tokensInContextB = Array.from(tokensA).filter(t => t.length > 2 && contextB.includes(t)).length;
  const contextReferenceMatch = 
    (tokensB.size >= 2 && tokensInContextA >= 2) ||
    (tokensA.size >= 2 && tokensInContextB >= 2) ||
    (cleanA.length >= 8 && contextB.includes(cleanA)) ||
    (cleanB.length >= 8 && contextA.includes(cleanB));

  // If exact or very high semantic similarity (>= 0.70) or direct context reference:
  if (exactCleanMatch || similarity >= 0.70 || contextReferenceMatch) {
    if (dateCheck.compatible) {
      return true;
    }

    // Dates differ by more than 24 hours: check if within an extension/rescheduling window (<= 14 days)
    // or if the titles indicate a deadline extension/reminder/update
    if (itemA.dueDate && itemB.dueDate) {
      const dA = new Date(itemA.dueDate);
      const dB = new Date(itemB.dueDate);
      if (!isNaN(dA.getTime()) && !isNaN(dB.getTime())) {
        const diffDays = Math.abs(dA.getTime() - dB.getTime()) / (1000 * 60 * 60 * 24);
        const isExtensionOrUpdate = /exten|postpone|reschedule|update|revised|reminder|deadline|submission/i.test(
          itemA.title + ' ' + itemB.title + ' ' + contextA + ' ' + contextB
        );
        if (diffDays <= 14 || isExtensionOrUpdate) {
          return true;
        }
      }
    }
    // If one has date and one doesn't, high similarity means it's the same obligation with date added
    if (!itemA.dueDate || !itemB.dueDate) {
      return true;
    }
  }

  // Moderate similarity (0.50 - 0.69) requires same day or compatible date
  if (dateCheck.sameDay && similarity >= 0.50) {
    return true;
  }
  if (dateCheck.compatible && similarity >= 0.60) {
    return true;
  }

  return false;
}

/**
 * Normalizes priority strictly to 'high' | 'medium' | 'low'.
 */
export function normalizePriority(p?: string): TaskPriority {
  if (!p) return 'medium';
  const lower = p.toLowerCase().trim();
  if (lower === 'urgent' || lower === 'high') return 'high';
  if (lower === 'low') return 'low';
  return 'medium';
}

export interface PriorityContextInput {
  title: string;
  description?: string;
  action?: string;
  dueDate?: string | null;
  dueTime?: string | null;
  category?: string;
  sourceType?: string;
  sourceContext?: {
    sender?: string;
    subject?: string;
    snippet?: string;
    [key: string]: unknown;
  };
  aiSuggestedPriority?: string;
  existingPriority?: TaskPriority;
  now?: Date;
}

export interface DeadlineUrgencyAnalysis {
  hasDeadline: boolean;
  isDueToday: boolean;
  isDueTomorrow: boolean;
  isOverdue: boolean;
  isImminent: boolean; // <= 48 hours or due today/tomorrow/overdue
  isNear: boolean;     // 2 to 7 days
  isDistant: boolean;  // > 14 days
  diffHours: number | null;
  dayDiff: number | null;
  effectiveDeadline: Date | null;
}

/**
 * Calculates deadline proximity and urgency considering:
 * - Exact deadline (ISO date + clock time)
 * - Date without time (valid through 23:59:59.999 UTC of that calendar date)
 * - All-day calendar events (whole day validity)
 * - No deadline (returns hasDeadline: false, never invents a deadline or false urgency)
 */
export function calculateDeadlineUrgency(
  dueDate?: string | null,
  dueTime?: string | null,
  now?: Date
): DeadlineUrgencyAnalysis {
  if (!dueDate) {
    return {
      hasDeadline: false,
      isDueToday: false,
      isDueTomorrow: false,
      isOverdue: false,
      isImminent: false,
      isNear: false,
      isDistant: false,
      diffHours: null,
      dayDiff: null,
      effectiveDeadline: null
    };
  }

  const rawDate = new Date(dueDate);
  if (isNaN(rawDate.getTime())) {
    return {
      hasDeadline: false,
      isDueToday: false,
      isDueTomorrow: false,
      isOverdue: false,
      isImminent: false,
      isNear: false,
      isDistant: false,
      diffHours: null,
      dayDiff: null,
      effectiveDeadline: null
    };
  }

  const refNow = now ? new Date(now) : new Date();
  const effective = new Date(rawDate);

  const hasExactTime = Boolean(dueTime && /^\d{1,2}:\d{2}$/.test(dueTime.trim()));
  if (hasExactTime) {
    // Exact deadline: date + specific clock time
    const [hh, mm] = dueTime!.trim().split(':').map(Number);
    effective.setUTCHours(hh, mm, 0, 0);
  } else {
    // Date without specific clock time or all-day calendar event:
    // Obligation is active for the whole day, due by end of that day (23:59:59.999 UTC)
    effective.setUTCHours(23, 59, 59, 999);
  }

  const diffHours = (effective.getTime() - refNow.getTime()) / (1000 * 60 * 60);

  // Calendar day difference (UTC based)
  const targetDateStr = rawDate.toISOString().split('T')[0];
  const nowDateStr = refNow.toISOString().split('T')[0];
  const targetDayMs = new Date(`${targetDateStr}T00:00:00.000Z`).getTime();
  const nowDayMs = new Date(`${nowDateStr}T00:00:00.000Z`).getTime();
  const dayDiff = Math.round((targetDayMs - nowDayMs) / (1000 * 60 * 60 * 24));

  const isOverdue = hasExactTime ? diffHours < 0 : dayDiff < 0;
  const isDueToday = !isOverdue && (dayDiff === 0 || (diffHours >= 0 && diffHours <= 24));
  const isDueTomorrow = !isOverdue && (dayDiff === 1 || (diffHours > 24 && diffHours <= 48));

  // Imminent urgency: due today, due tomorrow, or recently overdue within 48 hours
  const isImminent = isDueToday || isDueTomorrow || (diffHours >= -48 && diffHours <= 48);
  const isNear = !isImminent && !isOverdue && ((dayDiff >= 2 && dayDiff <= 7) || (diffHours > 48 && diffHours <= 168));
  const isDistant = !isImminent && (dayDiff > 14 || diffHours > 336);

  return {
    hasDeadline: true,
    isDueToday,
    isDueTomorrow,
    isOverdue,
    isImminent,
    isNear,
    isDistant,
    diffHours,
    dayDiff,
    effectiveDeadline: effective
  };
}

/**
 * Detects if text describes program schedules, event date ranges, or general event dates
 * rather than an actual submission deadline or personal task obligation.
 * Examples:
 * - "The SDP program will run from the 13th to the 17th" -> program schedule, NOT a deadline.
 * - "sessions will be held from Oct 13 to 17" -> event dates, NOT a deadline.
 */
export function isProgramScheduleOrEventDateRange(text?: string | null): boolean {
  if (!text) return false;
  const clean = text.toLowerCase();

  // Date range patterns (e.g. "run from the 13th to the 17th", "taking place across campus from Nov 12 to Nov 14")
  const rangePattern = /\b(run|running|held|conducted|scheduled|taking\s+place|take\s+place|sessions?)\b([^\n.]{0,40}?)\b(from|between)\s+(\w+\s+)?\d{1,2}(st|nd|rd|th)?\s+(to|through|until|-)\s+(\w+\s+)?\d{1,2}\b/i;
  if (rangePattern.test(clean)) return true;

  const willRunPattern = /\b(will\s+run|will\s+be\s+held|will\s+be\s+conducted|to\s+be\s+held|will\s+take\s+place)\b([^\n.]{0,40}?)\b(from|on)\s+(\w+\s+)?\d{1,2}\b/i;
  if (willRunPattern.test(clean)) return true;

  // Program schedule phrases
  const programSchedulePattern = /\b(sdp|fdp|skill\s+development|faculty\s+development|workshop|training\s+program|conference|symposium|webinar\s+series)\b.*\b(run\s+from|take\s+place|from\s+\d{1,2}|dates?\s*:|duration\s*:)/i;
  if (programSchedulePattern.test(clean)) return true;

  return false;
}

/**
 * Checks whether an item represents an informational email rather than a genuine responsibility.
 * Rules:
 * - A date or date range alone must NEVER create a responsibility or deadline.
 * - Distinguish event dates, program schedules, registration dates, submission deadlines, and general dates.
 * - Create responsibilities only when the source supports a genuine action, obligation, or task for the user.
 * - General announcements, circulars, newsletters, and program information are NOT responsibilities.
 */
export function isInformationalEmailNotResponsibility(item: {
  title: string;
  action?: string | null;
  description?: string | null;
  reasoning?: string | null;
  sourceType?: string | null;
  sourceContext?: { subject?: string; snippet?: string; [key: string]: unknown } | null;
}): boolean {
  const title = (item.title || '').toLowerCase();
  const action = (item.action || '').toLowerCase().trim();
  const description = (item.description || '').toLowerCase();
  const subject = String(item.sourceContext?.subject || '').toLowerCase();
  const snippet = String(item.sourceContext?.snippet || '').toLowerCase();

  const corpus = `${title} ${action} ${description} ${subject} ${snippet}`;

  // 1. Passive / no-action explicit indicators
  if (
    action === '' ||
    action === 'none' ||
    action === 'n/a' ||
    action.startsWith('no action') ||
    action.includes('no action required') ||
    action.includes('informational only') ||
    action.startsWith('note that') ||
    action.startsWith('be aware') ||
    action.startsWith('for your information') ||
    action.startsWith('fyi')
  ) {
    return true;
  }

  // 2. Program information & schedules without user submission or personal assignment
  // e.g. "The SDP program will run from the 13th to the 17th"
  const isProgramInfo = isProgramScheduleOrEventDateRange(corpus);
  const hasSubmissionObligation = /\b(submit|submission|upload|pay|payment|tuition|fee|exam|viva|assessment|test|interview|apply\s+by|register\s+before|last\s+date\s+to\s+apply)\b/i.test(corpus);

  if (isProgramInfo && !hasSubmissionObligation) {
    return true;
  }

  // 3. Passive program attendance phrasing from email source:
  // e.g. "Attend the SDP sessions from October 13th to October 17th" or "Participate in the music club auditions on October 14th"
  // When coming purely from Gmail (not a confirmed user Calendar event) and phrased as attending general program sessions
  const isGmailOnly = item.sourceType === 'gmail' || (!item.sourceType && !item.sourceContext?.calendarEventId);
  if (isGmailOnly) {
    const isGeneralProgramAttendance = 
      /\b(attend|participate\s+in)\s+([^.]*?\b)?(program|sdp|fdp|skill\s+development|sessions?\s+from|music\s+club|club\s+audition|auditions|webinar|workshop|conference|seminar|orientation|celebration)\b/i.test(action || title) ||
      /\binvitation\s+to\s+(attend|participate)\b/i.test(corpus) ||
      /\b(audition\s+call|auditions?\s+for|open\s+auditions?)\b/i.test(corpus);
    if (isGeneralProgramAttendance && !hasSubmissionObligation) {
      return true;
    }

    // 4. General announcements, circulars, and newsletters
    const isAnnouncementOrNewsletter = /\b(newsletter|weekly\s+digest|monthly\s+update|general\s+announcement|circular\s+regarding|circular\s+no|information\s+circular|bulletin)\b/i.test(corpus);
    if (isAnnouncementOrNewsletter && !hasSubmissionObligation) {
      return true;
    }

    // 5. Action ownership directed to others or automated system notifications
    const isOthersActionOrSystem = 
      /\b(will\s+be\s+handled\s+by|assigned\s+to\s+(?!you|me)|[a-z]+\s+will\s+(submit|review|handle|prepare)|team\s+will|fyi\s+only|no\s+action\s+needed\s+from\s+you)\b/i.test(corpus) ||
      /\b(order\s+confirmed|package\s+delivered|receipt\s+for|payment\s+received|security\s+alert|sign-in\s+from|password\s+reset\s+successful)\b/i.test(corpus);
    if (isOthersActionOrSystem && !hasSubmissionObligation) {
      return true;
    }
  }

  return false;
}

/**
 * Validates and sanitizes extracted deadlines:
 * - If the date mentioned in the email is just an event date, program schedule range, announcement date,
 *   email received date, or application opening date (not a submission/closing deadline),
 *   unsets the deadline (dueDate: null, dueTime: null).
 * - Genuine deadlines (e.g. "submit application by 12th", "upload presentation before 5 PM") are preserved.
 * - Distinguishes calendar events (type: 'appointment') vs deadlines (type: 'deadline').
 */
export function sanitizeTaskDeadline(item: {
  title: string;
  action?: string | null;
  description?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
  type?: string | null;
  sourceType?: string | null;
  sourceContext?: Record<string, unknown> | null;
}): { dueDate: string | null; dueTime: string | null; isInformationalDate: boolean } {
  if (!item.dueDate) {
    return { dueDate: null, dueTime: null, isInformationalDate: false };
  }

  const corpus = `${item.title} ${item.action || ''} ${item.description || ''} ${String(item.sourceContext?.subject || '')} ${String(item.sourceContext?.snippet || '')}`.toLowerCase();

  // If text describes a program schedule / date range (e.g. "will run from 13th to 17th", "sessions from Oct 13 to 17"):
  // That date is an EVENT / PROGRAM DATE, NOT a submission deadline!
  const isScheduleDate = isProgramScheduleOrEventDateRange(corpus);
  const hasGenuineSubmissionDeadline = /\b(submit\s+by|submission\s+deadline|due\s+by|due\s+on|last\s+date|upload\s+before|pay\s+before|apply\s+by|register\s+by|deadline\s*:)\b/i.test(corpus);

  if (isScheduleDate && !hasGenuineSubmissionDeadline) {
    // Unset the deadline — it is program information, NOT a deadline
    return { dueDate: null, dueTime: null, isInformationalDate: true };
  }

  // If the email is a general session/audition/announcement without an explicit deadline directive:
  if (item.sourceType === 'gmail' && !item.sourceContext?.calendarEventId) {
    const isEventOnlyFromEmail = /\b(auditions?\s+(on|at|for)|orientation\s+session\s+(at|on)|interactive\s+session\s+(at|on)|celebration\s+on|music\s+club|club\s+auditions?)\b/i.test(corpus);
    if (isEventOnlyFromEmail && !hasGenuineSubmissionDeadline) {
      return { dueDate: null, dueTime: null, isInformationalDate: true };
    }
  }

  // Guard against using email received date as a deadline when no explicit deadline exists
  const receivedAt = (item.sourceContext?.receivedAt as string) || '';
  if (receivedAt && item.dueDate) {
    const dueDay = item.dueDate.split('T')[0];
    const recDay = receivedAt.split('T')[0];
    if (dueDay === recDay && !hasGenuineSubmissionDeadline) {
      return { dueDate: null, dueTime: null, isInformationalDate: true };
    }
  }

  return { dueDate: item.dueDate, dueTime: item.dueTime || null, isInformationalDate: false };
}

/**
 * Intelligently determines responsibility priority based on:
 * 1. Deadline proximity (due today/tomorrow/<=48h -> HIGH, near 2-7d -> MEDIUM, distant >14d -> LOW)
 * 2. Importance of the obligation (exams, vivas, placements, submissions vs optional workshops)
 * 3. Whether user action is strictly required
 * 4. Source context (sender authority and explicit urgency markers)
 * Never invents urgency or fake deadlines when the source does not support it.
 */
export function determineIntelligentPriority(input: PriorityContextInput): TaskPriority {
  const textCorpus = [
    input.title || '',
    input.action || '',
    input.description || '',
    input.sourceContext?.subject || '',
    input.sourceContext?.snippet || ''
  ].join(' ').toLowerCase();

  const sender = (input.sourceContext?.sender || '').toLowerCase();

  // 1. High-Stakes Importance Keywords
  const isHighStakesObligation = /(\bexam\b|\bexams\b|\bquiz\b|\bquizzes\b|\bviva\b|\btest\b|\btests\b|\bassessment\b|\bevaluations?\b|\bhall ticket\b|\badmit card\b|\bfinal submission\b|\bproblem statement\b|\bproject report\b|\bthesis\b|\bplacement\b|\bfidelity\b|\binterview\b|\bjob offer\b|\binternship assessment\b|\btuition fee\b|\bfee payment\b|\bconsent letter\b|\bsih\b)/i.test(textCorpus);

  // 2. Explicit Urgency Indicators in Subject or Title
  const hasUrgencyDirective = /(\bimportant\b|\burgent\b|\burgently\b|\bfinal reminder\b|\blast date\b|\bimmediate\b|\bclosing today\b|\btomorrow\b|\bmandatory\b|\bcritical\b|\baction required\b)/i.test(textCorpus);

  // 3. Authoritative Source Context
  const isAuthoritativeSender = /(placement|hod|principal|dean|exam|office|professor|sumanthcm|onlinecourses@nptel)/i.test(sender);

  // 4. Low-Stakes / Optional Indicators
  const isLowStakesOrOptional = /(\bwebinar\b|\bworkshop\b|\borientation\b|\bseminar\b|\bguest lecture\b|\btalk\b|\bcommunity\b|\bclub\b|\bexplore\b|\boptional\b|\bvoluntary\b)/i.test(textCorpus);

  // 5. Deadline Proximity Evaluation via Deadline Intelligence
  const urgency = calculateDeadlineUrgency(input.dueDate, input.dueTime, input.now);

  // 6. Synthesis Rules:
  // Rule A: Imminent deadline (due today, due tomorrow, <= 48h) on actionable obligation -> HIGH
  if (urgency.isImminent && !isLowStakesOrOptional) {
    return 'high';
  }

  // Rule B: High-stakes obligation (exam, final submission, placement, viva) -> HIGH
  if (isHighStakesObligation) {
    return 'high';
  }

  // Rule C: Urgent directives from authoritative sender -> HIGH
  if (hasUrgencyDirective && isAuthoritativeSender) {
    return 'high';
  }

  // Rule D: Low-stakes or optional items (webinars, orientations, workshops without strict deadline) -> LOW
  if (isLowStakesOrOptional && !urgency.isImminent && !isHighStakesObligation) {
    return 'low';
  }

  // Rule E: Distant deadline (> 14 days) without high-stakes or urgency -> LOW (never inventing urgency)
  if (urgency.isDistant && !isHighStakesObligation && !hasUrgencyDirective) {
    return 'low';
  }

  // Rule F: Near-deadline tasks (2-7 days) or regular academic/work commitments -> MEDIUM
  if (urgency.isNear || input.category === 'academic' || input.category === 'work') {
    return 'medium';
  }

  // Default fallback (never inventing urgency)
  return normalizePriority(input.aiSuggestedPriority || input.existingPriority);
}

/**
 * Combines an incoming task into an existing responsibility, merging sources, contexts, and details.
 */
export function mergeResponsibilityData(
  existing: Responsibility,
  incoming: ExtractedTask
): {
  id?: string;
  title: string;
  description: string;
  action: string;
  dueDate?: string;
  dueTime?: string;
  priority: TaskPriority;
  source: TaskSourceType;
  sources: TaskSourceType[];
  sourceContext: Record<string, unknown>;
  confidence: number;
  tags: string[];
} {
  // 1. Combine sources
  const existingSources = new Set<TaskSourceType>(
    existing.sources || (existing.source === 'both' ? ['gmail', 'calendar'] : [existing.source])
  );
  if (incoming.sourceType === 'both') {
    existingSources.add('gmail');
    existingSources.add('calendar');
  } else if (incoming.sourceType) {
    existingSources.add(incoming.sourceType as TaskSourceType);
  }
  if (incoming.sources) {
    incoming.sources.forEach(s => existingSources.add(s as TaskSourceType));
  }

  const combinedSourcesList = Array.from(existingSources);
  const isBoth = combinedSourcesList.includes('gmail') && combinedSourcesList.includes('calendar');
  const finalSource: TaskSourceType = isBoth ? 'both' : (combinedSourcesList[0] || 'manual');

  // 2. Merge Source Context
  const mergedContext: Record<string, unknown> = {
    ...(existing.sourceContext || {})
  };

  if (incoming.sourceType === 'gmail' && incoming.sourceId) {
    mergedContext.messageId = incoming.sourceId;
  } else if (incoming.sourceType === 'calendar' && incoming.sourceId) {
    mergedContext.calendarEventId = incoming.sourceId;
  }
  if (incoming.secondarySourceId) {
    if (incoming.sourceType === 'gmail') {
      mergedContext.calendarEventId = incoming.secondarySourceId;
    } else {
      mergedContext.messageId = incoming.secondarySourceId;
    }
  }

  if (incoming.classification) mergedContext.classification = incoming.classification;
  if (incoming.deadlineType) mergedContext.deadlineType = incoming.deadlineType;
  if (incoming.responsibleParty) mergedContext.responsibleParty = incoming.responsibleParty;
  if (incoming.nextStep) mergedContext.nextStep = incoming.nextStep;
  if (incoming.windowStartDate) mergedContext.windowStartDate = incoming.windowStartDate;
  if (incoming.windowEndDate) mergedContext.windowEndDate = incoming.windowEndDate;

  // 3. Due Date & Time: Use updated source deadline/time if valid, else keep existing
  let finalDueDate = existing.dueDate;
  if (incoming.dueDate) {
    const parsed = new Date(incoming.dueDate);
    if (!isNaN(parsed.getTime())) {
      finalDueDate = parsed.toISOString();
    }
  }

  let finalDueTime = existing.dueTime;
  if (incoming.dueTime && /^\d{1,2}:\d{2}$/.test(incoming.dueTime.trim())) {
    finalDueTime = incoming.dueTime.trim();
  }

  // 4. Action: Prefer the more descriptive action
  const existingAction = existing.action || '';
  const incomingAction = incoming.action || '';
  const finalAction = incomingAction.length >= existingAction.length ? incomingAction : existingAction;

  // 5. Description: Use incoming or keep existing
  const finalDescription = incoming.description && incoming.description.length > (existing.description || '').length
    ? incoming.description
    : existing.description || incoming.description || '';

  // 6. Title: Keep cleaner or more complete title
  const finalTitle = incoming.title.length > existing.title.length && !incoming.title.toLowerCase().startsWith('re:')
    ? incoming.title
    : existing.title;

  // 7. Intelligent Priority Selection: recalculate priority with updated source info and deadline proximity
  const finalPriority: TaskPriority = determineIntelligentPriority({
    title: finalTitle,
    description: finalDescription,
    action: finalAction,
    dueDate: finalDueDate,
    dueTime: finalDueTime,
    category: (incoming.category as string) || existing.category,
    sourceType: finalSource,
    sourceContext: mergedContext as any,
    aiSuggestedPriority: incoming.priority,
    existingPriority: existing.priority
  });

  // 8. Tags Union
  const mergedTags = Array.from(new Set([...(existing.tags || []), ...(incoming.tags || [])]));

  return {
    id: existing.id,
    title: finalTitle,
    description: finalDescription,
    action: finalAction,
    dueDate: finalDueDate,
    dueTime: finalDueTime,
    priority: finalPriority,
    source: finalSource,
    sources: combinedSourcesList,
    sourceContext: mergedContext,
    confidence: Math.max(existing.confidence || 0.85, incoming.confidence || 0.85),
    tags: mergedTags
  };
}

/**
 * Deduplicates and matches incoming extracted tasks within the batch itself
 * (e.g. if the LLM output generated one task from email and one from calendar for the same item).
 */
export function deduplicateExtractedBatch(tasks: ExtractedTask[]): ExtractedTask[] {
  const mergedBatch: ExtractedTask[] = [];

  for (const current of tasks) {
    const isUsefulEventOrOpportunity =
      current.classification === 'program_schedule' ||
      current.classification === 'opportunity_window' ||
      current.classification === 'event_meeting';

    if (!current.actionRequired && !isUsefulEventOrOpportunity) continue;

    const existingIndex = mergedBatch.findIndex(existing =>
      isSameObligation(
        {
          title: existing.title,
          dueDate: existing.dueDate,
          sourceId: existing.sourceId,
          secondarySourceId: existing.secondarySourceId,
          sourceType: existing.sourceType
        } as any,
        {
          title: current.title,
          dueDate: current.dueDate,
          sourceId: current.sourceId,
          secondarySourceId: current.secondarySourceId,
          sourceType: current.sourceType
        } as any
      )
    );

    if (existingIndex !== -1) {
      // Merge with the existing item in the batch
      const existing = mergedBatch[existingIndex];
      const isBoth = (existing.sourceType === 'gmail' && current.sourceType === 'calendar') ||
                     (existing.sourceType === 'calendar' && current.sourceType === 'gmail') ||
                     existing.sourceType === 'both' || current.sourceType === 'both';

      const combinedTitle = current.title.length > existing.title.length ? current.title : existing.title;
      const combinedDueDate = current.dueDate || existing.dueDate;
      const combinedDueTime = current.dueTime || existing.dueTime;
      const combinedAction = (current.action || '').length > (existing.action || '').length ? current.action : existing.action;

      const combinedPriority = determineIntelligentPriority({
        title: combinedTitle,
        description: current.description || existing.description,
        action: combinedAction,
        dueDate: combinedDueDate,
        dueTime: combinedDueTime,
        category: current.category || existing.category,
        aiSuggestedPriority: current.priority,
        existingPriority: existing.priority
      });

      const secondaryId = existing.secondarySourceId || 
        current.secondarySourceId || 
        (current.sourceId !== existing.sourceId ? current.sourceId : undefined);

      mergedBatch[existingIndex] = {
        ...existing,
        title: combinedTitle,
        description: current.description || existing.description,
        action: combinedAction,
        dueDate: combinedDueDate,
        dueTime: combinedDueTime,
        priority: combinedPriority,
        sourceType: isBoth ? 'both' : existing.sourceType,
        sources: isBoth ? ['gmail', 'calendar'] : existing.sources,
        secondarySourceId: secondaryId,
        tags: Array.from(new Set([...(existing.tags || []), ...(current.tags || [])])),
        confidence: Math.max(existing.confidence, current.confidence)
      };
    } else {
      const priority = determineIntelligentPriority({
        title: current.title,
        description: current.description,
        action: current.action,
        dueDate: current.dueDate,
        dueTime: current.dueTime,
        category: current.category,
        sourceType: current.sourceType,
        aiSuggestedPriority: current.priority
      });

      mergedBatch.push({
        ...current,
        priority
      });
    }
  }

  return mergedBatch;
}

export type ResponsibilityLifecycleStatus =
  | 'UPCOMING'
  | 'DUE_TODAY'
  | 'OVERDUE'
  | 'COMPLETED'
  | 'CANCELLED';

export interface StatusContextInput {
  title?: string;
  action?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
  existingStatus?: string;
  isCancelled?: boolean;
  completionEvidence?: boolean;
  sourceContext?: Record<string, unknown> | null;
  now?: Date;
}

/**
 * Automatically determines the lifecycle status of a responsibility:
 * - UPCOMING: Active obligations due in the future, or active tasks with no fixed deadline
 * - DUE_TODAY: Active obligations due on current calendar date
 * - OVERDUE: Active obligations whose actual deadline has passed without completion
 * - COMPLETED: Strictly marked completed when evidence of completion is present or when meeting/event has concluded
 * - CANCELLED: Source calendar event or email explicitly cancelled or obsolete
 */
export function determineResponsibilityStatus(input: StatusContextInput): ResponsibilityLifecycleStatus {
  // 1. Cancellation check
  if (input.isCancelled) {
    return 'CANCELLED';
  }
  const normExisting = (input.existingStatus || '').toUpperCase();
  if (normExisting === 'CANCELLED' || normExisting === 'DISMISSED') {
    return 'CANCELLED';
  }

  const sub = String(input.sourceContext?.subject || '').toLowerCase();
  const title = String(input.title || input.sourceContext?.title || '').toLowerCase();
  const snippet = String(input.sourceContext?.snippet || '').toLowerCase();
  const textCorpus = `${sub} ${title} ${snippet}`;

  if (
    textCorpus.includes('cancelled') ||
    textCorpus.includes('canceled') ||
    textCorpus.includes('session cancelled') ||
    textCorpus.includes('meeting cancelled') ||
    textCorpus.includes('event cancelled')
  ) {
    return 'CANCELLED';
  }

  // 2. Evidence of Completion check (NEVER mark completed unless real evidence exists)
  if (input.completionEvidence || normExisting === 'COMPLETED') {
    return 'COMPLETED';
  }

  const hasCompletionNotice = /(\bsuccessfully submitted\b|\bsubmission confirmed\b|\bpayment successful\b|\breceipt confirmed\b|\btest completed\b|\bexam submitted\b|\bassignment submitted\b)/i.test(textCorpus);
  if (hasCompletionNotice) {
    return 'COMPLETED';
  }

  // 3. For meetings and events, use their actual start/end times and event status rather than treating start time as a submission deadline.
  const isEvent =
    input.sourceContext?.classification === 'event_meeting' ||
    input.sourceContext?.deadlineType === 'event_time' ||
    input.sourceContext?.isCalendarEvent === true ||
    (input.title && /\b(meeting|appointment|review|viva|interview)\b/i.test(input.title));

  if (isEvent) {
    if (input.dueDate) {
      const refNow = input.now ? new Date(input.now) : new Date();
      const rawDate = new Date(input.dueDate);
      if (!isNaN(rawDate.getTime())) {
        const eventEnd = new Date(rawDate);
        const endTimeStr = (input.sourceContext?.endTime as string) || (input.sourceContext?.dueTimeEnd as string);
        if (endTimeStr && /^\d{1,2}:\d{2}$/.test(endTimeStr.trim())) {
          const [eh, em] = endTimeStr.trim().split(':').map(Number);
          eventEnd.setUTCHours(eh, em, 0, 0);
        } else if (input.dueTime && /^\d{1,2}:\d{2}$/.test(input.dueTime.trim())) {
          const [sh, sm] = input.dueTime.trim().split(':').map(Number);
          eventEnd.setUTCHours(sh + 1, sm, 0, 0);
        } else {
          eventEnd.setUTCHours(23, 59, 59, 999);
        }

        if (eventEnd.getTime() < refNow.getTime()) {
          return 'COMPLETED'; // Concluded event
        }
      }
    }
    return 'UPCOMING';
  }

  // 4. Informational items, program schedules, and application windows must NEVER be marked OVERDUE
  const isInformationalSchedule =
    input.sourceContext?.classification === 'program_schedule' ||
    input.sourceContext?.classification === 'informational' ||
    input.sourceContext?.classification === 'opportunity_window' ||
    input.sourceContext?.deadlineType === 'program_duration' ||
    input.sourceContext?.deadlineType === 'application_window' ||
    input.sourceContext?.isInformationalDate === true ||
    isProgramScheduleOrEventDateRange(textCorpus);

  if (isInformationalSchedule) {
    return 'UPCOMING';
  }

  // 5. Genuine actionable deadline status
  if (!input.dueDate) {
    return 'UPCOMING';
  }

  const urgency = calculateDeadlineUrgency(input.dueDate, input.dueTime, input.now);
  if (!urgency.hasDeadline) {
    return 'UPCOMING';
  }

  if (urgency.isOverdue) {
    return 'OVERDUE';
  }

  if (urgency.isDueToday) {
    return 'DUE_TODAY';
  }

  return 'UPCOMING';
}

