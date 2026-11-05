import { Responsibility, CalendarEventRecord, EmailRecord } from '@lifesynch/shared';

export interface ScoredResult<T> {
  item: T;
  score: number;
}

export interface GlobalSearchResults {
  query: string;
  responsibilities: ScoredResult<Responsibility>[];
  calendarEvents: ScoredResult<CalendarEventRecord>[];
  emails: ScoredResult<EmailRecord>[];
  totalCount: number;
}

/**
 * Calculates Damerau-Levenshtein distance for small spelling variation tolerance
 */
function levenshteinDistance(a: string, b: string): number {
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;
  if (Math.abs(al - bl) > 3) return 99; // Quick bail out if length difference is too large

  const matrix: number[][] = [];
  for (let i = 0; i <= al; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= bl; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let min = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );

      // Transposition
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        min = Math.min(min, matrix[i - 2][j - 2] + cost);
      }

      matrix[i][j] = min;
    }
  }

  return matrix[al][bl];
}

/**
 * Checks if a search token matches any word in the text either exactly, as prefix/substring,
 * or with minor spelling error tolerance (1 edit for words >= 4 chars, 2 edits for words >= 7 chars).
 */
function scoreTokenAgainstWords(token: string, words: string[]): { matched: boolean; score: number } {
  const tokenLen = token.length;
  let bestScore = 0;

  for (const word of words) {
    if (!word) continue;
    // Exact word match
    if (word === token) {
      return { matched: true, score: 10 };
    }
    // Prefix match
    if (word.startsWith(token)) {
      bestScore = Math.max(bestScore, 8);
      continue;
    }
    // Substring match
    if (word.includes(token)) {
      bestScore = Math.max(bestScore, 6);
      continue;
    }
    // Spelling variation tolerance for words of sufficient length
    if (tokenLen >= 4 && word.length >= 3) {
      const dist = levenshteinDistance(token, word);
      if (dist === 1) {
        bestScore = Math.max(bestScore, 4);
      } else if (dist === 2 && tokenLen >= 7 && word.length >= 6) {
        bestScore = Math.max(bestScore, 3);
      }
    }
  }

  return { matched: bestScore > 0, score: bestScore };
}

/**
 * Clean & tokenize text
 */
function tokenize(text?: string | null): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Match Responsibilities / Tasks
 */
export function searchResponsibilities(tasks: Responsibility[], query: string): ScoredResult<Responsibility>[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];
  const queryTokens = tokenize(trimmed);
  if (queryTokens.length === 0) return [];

  const results: ScoredResult<Responsibility>[] = [];
  const seenIds = new Set<string>();

  for (const task of tasks) {
    if (seenIds.has(task.id)) continue;

    const titleTokens = tokenize(task.title);
    const actionTokens = tokenize(task.action);
    const descTokens = tokenize(task.description);
    const catTokens = tokenize(task.category);
    const sourceTokens = tokenize(task.sourceContext?.sender || task.sourceContext?.subject || task.sourceContext?.snippet);

    const fullTitle = (task.title || '').toLowerCase();
    const fullAction = (task.action || '').toLowerCase();
    const fullDesc = (task.description || '').toLowerCase();

    let totalScore = 0;
    let tokensMatched = 0;

    // Exact phrase match bonus
    if (fullTitle.includes(trimmed)) totalScore += 40;
    else if (fullAction.includes(trimmed)) totalScore += 25;
    else if (fullDesc.includes(trimmed)) totalScore += 15;

    for (const token of queryTokens) {
      const inTitle = scoreTokenAgainstWords(token, titleTokens);
      const inAction = scoreTokenAgainstWords(token, actionTokens);
      const inCat = scoreTokenAgainstWords(token, catTokens);
      const inSource = scoreTokenAgainstWords(token, sourceTokens);
      const inDesc = scoreTokenAgainstWords(token, descTokens);

      if (inTitle.matched || inAction.matched || inCat.matched || inSource.matched || inDesc.matched) {
        tokensMatched++;
        totalScore += (inTitle.score * 3) + (inAction.score * 2) + (inCat.score * 1.5) + (inSource.score * 1.2) + inDesc.score;
      }
    }

    // Require at least one token match
    if (tokensMatched > 0) {
      // Bonus if all tokens matched
      if (tokensMatched === queryTokens.length) {
        totalScore += 20;
      }
      seenIds.add(task.id);
      results.push({ item: task, score: totalScore });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Match Calendar Events
 */
export function searchCalendarEvents(events: CalendarEventRecord[], query: string): ScoredResult<CalendarEventRecord>[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];
  const queryTokens = tokenize(trimmed);
  if (queryTokens.length === 0) return [];

  const results: ScoredResult<CalendarEventRecord>[] = [];
  const seenIds = new Set<string>();

  for (const event of events) {
    if (seenIds.has(event.id)) continue;

    const summaryTokens = tokenize(event.summary);
    const descTokens = tokenize(event.description);
    const locTokens = tokenize(event.location);
    const attendeeTokens = (event.attendees || []).flatMap(a => [
      ...tokenize(a.displayName),
      ...tokenize(a.email)
    ]);

    const fullSummary = (event.summary || '').toLowerCase();
    const fullDesc = (event.description || '').toLowerCase();
    const fullLoc = (event.location || '').toLowerCase();

    let totalScore = 0;
    let tokensMatched = 0;

    // Exact phrase match bonus
    if (fullSummary.includes(trimmed)) totalScore += 40;
    else if (fullLoc.includes(trimmed)) totalScore += 20;
    else if (fullDesc.includes(trimmed)) totalScore += 15;

    for (const token of queryTokens) {
      const inSummary = scoreTokenAgainstWords(token, summaryTokens);
      const inLoc = scoreTokenAgainstWords(token, locTokens);
      const inAttendees = scoreTokenAgainstWords(token, attendeeTokens);
      const inDesc = scoreTokenAgainstWords(token, descTokens);

      if (inSummary.matched || inLoc.matched || inAttendees.matched || inDesc.matched) {
        tokensMatched++;
        totalScore += (inSummary.score * 3) + (inLoc.score * 2) + (inAttendees.score * 1.5) + inDesc.score;
      }
    }

    if (tokensMatched > 0) {
      if (tokensMatched === queryTokens.length) {
        totalScore += 20;
      }
      seenIds.add(event.id);
      results.push({ item: event, score: totalScore });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Match Emails
 */
export function searchEmails(emails: EmailRecord[], query: string): ScoredResult<EmailRecord>[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];
  const queryTokens = tokenize(trimmed);
  if (queryTokens.length === 0) return [];

  const results: ScoredResult<EmailRecord>[] = [];
  const seenIds = new Set<string>();

  for (const email of emails) {
    if (seenIds.has(email.id)) continue;

    const subjectTokens = tokenize(email.subject);
    const senderTokens = tokenize(email.sender);
    const snippetTokens = tokenize(email.snippet);
    const bodyTokens = email.bodyText ? tokenize(email.bodyText.slice(0, 1500)) : [];

    const fullSubject = (email.subject || '').toLowerCase();
    const fullSender = (email.sender || '').toLowerCase();
    const fullSnippet = (email.snippet || '').toLowerCase();

    let totalScore = 0;
    let tokensMatched = 0;

    // Exact phrase match bonus
    if (fullSubject.includes(trimmed)) totalScore += 40;
    else if (fullSender.includes(trimmed)) totalScore += 25;
    else if (fullSnippet.includes(trimmed)) totalScore += 15;

    for (const token of queryTokens) {
      const inSubject = scoreTokenAgainstWords(token, subjectTokens);
      const inSender = scoreTokenAgainstWords(token, senderTokens);
      const inSnippet = scoreTokenAgainstWords(token, snippetTokens);
      const inBody = scoreTokenAgainstWords(token, bodyTokens);

      if (inSubject.matched || inSender.matched || inSnippet.matched || inBody.matched) {
        tokensMatched++;
        totalScore += (inSubject.score * 3) + (inSender.score * 2.5) + (inSnippet.score * 1.5) + (inBody.score * 0.8);
      }
    }

    if (tokensMatched > 0) {
      if (tokensMatched === queryTokens.length) {
        totalScore += 20;
      }
      seenIds.add(email.id);
      results.push({ item: email, score: totalScore });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Perform comprehensive Global Search across all connected LifeSynch data
 */
export function performGlobalSearch(
  tasks: Responsibility[],
  calendarEvents: CalendarEventRecord[],
  emails: EmailRecord[],
  query: string
): GlobalSearchResults {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      query: '',
      responsibilities: [],
      calendarEvents: [],
      emails: [],
      totalCount: 0,
    };
  }

  const responsibilities = searchResponsibilities(tasks, trimmed);
  const events = searchCalendarEvents(calendarEvents, trimmed);
  const emailResults = searchEmails(emails, trimmed);

  return {
    query: trimmed,
    responsibilities,
    calendarEvents: events,
    emails: emailResults,
    totalCount: responsibilities.length + events.length + emailResults.length,
  };
}

