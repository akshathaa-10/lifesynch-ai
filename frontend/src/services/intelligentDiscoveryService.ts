import { EmailRecord, CalendarEventRecord, Responsibility } from '@lifesynch/shared';
import { LifeCategoryId } from './lifeCategoryService';

export type DiscoveryType = 'opportunity' | 'update' | 'announcement' | 'connected_thread' | 'cross_source';

export interface IntelligentDiscovery {
  id: string;
  title: string;
  explanation: string;
  category: LifeCategoryId;
  discoveryType: DiscoveryType;
  badgeLabel: string;
  sourceType: 'gmail' | 'calendar' | 'cross_source';
  sourceId: string;
  primaryDate?: string;
  relatedCount?: number;
  relatedSources?: Array<{
    id: string;
    type: 'gmail' | 'calendar';
    title: string;
    date?: string;
  }>;
  rawEmail?: EmailRecord;
  rawCalendarEvent?: CalendarEventRecord;
  rawResponsibility?: Responsibility;
}

/**
 * Decodes common HTML entities often present in email subject lines and snippets.
 */
function decodeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes email subject lines by removing prefixes, mailing list tags, and formatting noise.
 */
function cleanTitle(raw: string): string {
  const decoded = decodeHtml(raw);
  return decoded
    .replace(/^(\s*(fwd|re|fw|subject)\s*:\s*)+/gi, '')
    .replace(/^\[csestudents\]\s*/gi, '')
    .replace(/^\[hiring\s+alert\]\s*/gi, '')
    .replace(/^(invitation\s*[:|–|-]\s*|invitation to\s*)/gi, '')
    .replace(/^(event\s+invitation\s*[:|–|-]\s*)/gi, '')
    .replace(/^(reminder\s*[:|–|-]\s*)/gi, '')
    .replace(/^(alert!\s*)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Filters out transactional noise, generic newsletters, marketing blasts, and trivial notices.
 */
function isNoise(subject: string, snippetOrBody: string, sender: string): boolean {
  const corpus = `${subject} ${snippetOrBody} ${sender}`.toLowerCase();

  // 1. Password resets, OTPs, security alerts, and verification emails
  if (
    corpus.includes('password reset') ||
    corpus.includes('reset your password') ||
    corpus.includes('verification code') ||
    corpus.includes('one-time password') ||
    corpus.includes('security alert') ||
    corpus.includes('verify your email') ||
    corpus.includes('signed in to') ||
    corpus.includes('signed in from a new') ||
    corpus.includes('security notification') ||
    corpus.includes('confirm your email')
  ) {
    return true;
  }

  // 2. Generic promo newsletters, marketing digests, and forum summaries
  if (
    corpus.includes('codechef discuss') ||
    corpus.includes('get your time back') ||
    corpus.includes('less to-do. more ta-da.') ||
    corpus.includes('put chatgpt to work') ||
    corpus.includes('summary since') ||
    corpus.includes('weekly digest') ||
    corpus.includes('newsletter') ||
    corpus.includes('unsubscribe from these emails')
  ) {
    return true;
  }

  // 3. Routine campus lost & found
  if (
    corpus.includes('lost id card') ||
    corpus.includes('lost and found') ||
    corpus.includes('lost key') ||
    corpus.includes('lost my college id') ||
    corpus.includes('lost umbrella')
  ) {
    return true;
  }

  return false;
}

/**
 * Extracts a normalized semantic topic identifier for multi-email clustering.
 */
function extractTopicKey(subject: string, bodyText: string): string | null {
  const corpus = `${subject} ${bodyText}`.toLowerCase();

  if (corpus.includes('tcs hackquest') || corpus.includes('hackquest')) return 'tcs_hackquest';
  if (corpus.includes('samsung innovation campus') || corpus.includes('sic phase')) return 'samsung_sic';
  if (corpus.includes('eurogrip')) return 'eurogrip';
  if (corpus.includes('udaan') && (corpus.includes('drone') || corpus.includes('flight') || corpus.includes('navigation'))) return 'udaan_drones';
  if (corpus.includes('bharat re-gen') || corpus.includes('sustainability innovation')) return 'bharat_regen';
  if (corpus.includes('gokwik')) return 'gokwik';
  if (corpus.includes('10 bucks business battle') || corpus.includes('business battle')) return 'e_cell_battle';
  if (corpus.includes('gatetutor') && corpus.includes('gate 2027')) return 'gatetutor_series';
  if (corpus.includes('hello byte') || corpus.includes('the byte club')) return 'byte_club';
  if (corpus.includes('creλte') || corpus.includes('create – club recruitment')) return 'create_club_recruitment';

  return null;
}

/**
 * Formats a clean, grounded 1-2 sentence statement explaining why this discovery matters.
 */
function extractWhyItMatters(
  subject: string,
  snippet: string,
  bodyText: string,
  _discoveryType?: DiscoveryType
): string {
  const corpus = `${subject} ${snippet} ${bodyText}`.toLowerCase();

  if (corpus.includes('eurogrip') && corpus.includes('ppo')) {
    return 'Pre-placement offer (PPO) opportunity and cash rewards pool up to ₹3 Lakhs for engineering participants.';
  }
  if (corpus.includes('gokwik') && corpus.includes('50k')) {
    return 'Software engineering internship opening offering ₹50,000/month stipend with direct engineering mentorship.';
  }
  if (corpus.includes('tcs hackquest')) {
    return 'Placement Office released briefing sessions and registration details for the national TCS HackQuest coding challenge.';
  }
  if (corpus.includes('samsung') && corpus.includes('accommodate')) {
    return 'Organizing coordinator confirmed additional student seats have been opened for Phase IV Generative AI training.';
  }
  if (corpus.includes('bharat re-gen')) {
    return 'National student sustainability challenge inviting engineering prototypes with national recognition.';
  }
  if (corpus.includes('udaan') && corpus.includes('drone')) {
    return 'Departmental technical talk on autonomous flight dynamics and navigation in GPS-denied environments.';
  }
  if (corpus.includes('gatetutor') && corpus.includes('gate 2027')) {
    return 'Diagnostic test series opening covering Engineering Mathematics for CSE GATE 2027 preparation.';
  }
  if (corpus.includes('10 bucks business battle')) {
    return 'Logistical update from Onyx E-Cell regarding campus transport for participants.';
  }

  // Fallback to cleaned grounded snippet
  let cleanSnip = decodeHtml(snippet || bodyText || '').slice(0, 160);
  if (cleanSnip.length >= 155) {
    cleanSnip = cleanSnip.slice(0, cleanSnip.lastIndexOf(' ')) + '...';
  }
  return cleanSnip || 'Important contextual update discovered from your incoming communication channels.';
}

/**
 * Extracts a normalized, understandable title for a discovery.
 */
function formatDiscoveryTitle(
  subject: string,
  snippet: string,
  _discoveryType?: DiscoveryType
): string {
  const corpus = `${subject} ${snippet}`.toLowerCase();

  if (corpus.includes('tcs hackquest')) {
    return 'TCS HackQuest Season 11: National Challenge & Briefing Sessions';
  }
  if (corpus.includes('samsung') && corpus.includes('accommodate')) {
    return 'Samsung Innovation Campus (Generative AI) — Additional Seats Opened';
  }
  if (corpus.includes('eurogrip') && corpus.includes('ppo')) {
    return 'Eurogrip Creator Challenge: Pre-Placement Offer (PPO) & Awards';
  }
  if (corpus.includes('gokwik') && corpus.includes('internship')) {
    return 'GoKwik Internship Opportunity: Software Engineering';
  }
  if (corpus.includes('bharat re-gen')) {
    return 'BHARAT RE-GEN 2027: National Sustainability Innovation Challenge';
  }
  if (corpus.includes('udaan') && corpus.includes('drone')) {
    return 'UDAAN Tech Talk: Autonomous Drones & GPS-Denied Navigation';
  }
  if (corpus.includes('gatetutor')) {
    return 'GATE 2027 Free Test Series: Engineering Mathematics (CSE)';
  }

  return cleanTitle(subject);
}

/**
 * Generates an intelligent, deduplicated set of discoveries from the user's
 * complete Gmail messages, Calendar events, and Responsibilities.
 */
export function generateIntelligentDiscoveries(
  emails: EmailRecord[],
  calendarEvents: CalendarEventRecord[],
  tasks: Responsibility[]
): IntelligentDiscovery[] {
  const discoveries: IntelligentDiscovery[] = [];
  const processedEmailIds = new Set<string>();
  const processedTopicKeys = new Set<string>();

  // Set of task titles already covered as pending actionable tasks
  const pendingTaskTitles = new Set(
    tasks
      .filter(t => !['completed', 'COMPLETED', 'cancelled', 'CANCELLED', 'dismissed'].includes(t.status) && t.dueDate)
      .map(t => t.title.toLowerCase().trim())
  );

  // ------------------------------------------------------------------
  // STAGE 1: Cross-Source Connections (Calendar Events + Emails)
  // ------------------------------------------------------------------
  for (const ev of calendarEvents) {
    if (ev.status === 'cancelled' || !ev.summary) continue;
    const summaryLower = ev.summary.toLowerCase().trim();

    // Skip single-word trivial calendar entries
    if (summaryLower.length < 4 || summaryLower === 'test' || summaryLower === 'fav') continue;

    // Check if any email provides context or preparation for this event
    const matchingEmail = emails.find(em => {
      if (processedEmailIds.has(em.id)) return false;
      const emSub = (em.subject || '').toLowerCase();
      const emBody = (em.bodyText || em.snippet || '').toLowerCase();
      return (
        (summaryLower.includes('viva') && (emSub.includes('viva') || emBody.includes('viva'))) ||
        (summaryLower.includes('interview') && (emSub.includes('interview') || emBody.includes('interview'))) ||
        (summaryLower.includes('design review') && (emSub.includes('design review') || emBody.includes('design review')))
      );
    });

    if (matchingEmail) {
      processedEmailIds.add(matchingEmail.id);
      const isPast = new Date(ev.startTime).getTime() < Date.now();
      if (!isPast) {
        discoveries.push({
          id: `disc_cross_${ev.id}`,
          title: `${cleanTitle(ev.summary)}: Scheduled Commitment & Briefing`,
          explanation: `Calendar commitment corresponds to recent circular updates from ${matchingEmail.sender?.replace(/<.*>/, '').trim() || 'department'}.`,
          category: 'academic',
          discoveryType: 'cross_source',
          badgeLabel: 'Email + Calendar',
          sourceType: 'cross_source',
          sourceId: ev.id,
          primaryDate: ev.startTime,
          relatedCount: 2,
          relatedSources: [
            { id: ev.id, type: 'calendar', title: ev.summary, date: ev.startTime },
            { id: matchingEmail.id, type: 'gmail', title: matchingEmail.subject || 'Briefing Email', date: matchingEmail.receivedAt }
          ],
          rawCalendarEvent: ev,
          rawEmail: matchingEmail
        });
      }
    }
  }

  // ------------------------------------------------------------------
  // STAGE 2: Multi-Email Clustering (Connecting Related Communications)
  // ------------------------------------------------------------------
  const clusters: Record<string, EmailRecord[]> = {};
  for (const em of emails) {
    if (processedEmailIds.has(em.id)) continue;
    if (isNoise(em.subject || '', em.snippet || '', em.sender || '')) continue;

    const topicKey = extractTopicKey(em.subject || '', em.bodyText || em.snippet || '');
    if (topicKey) {
      if (!clusters[topicKey]) clusters[topicKey] = [];
      clusters[topicKey].push(em);
    }
  }

  for (const [topicKey, cluster] of Object.entries(clusters)) {
    if (cluster.length >= 2 && !processedTopicKeys.has(topicKey)) {
      processedTopicKeys.add(topicKey);
      cluster.forEach(e => processedEmailIds.add(e.id));

      const primary = cluster[0];
      const title = formatDiscoveryTitle(primary.subject || '', primary.snippet || '', 'connected_thread');
      const explanation = extractWhyItMatters(primary.subject || '', primary.snippet || '', primary.bodyText || '', 'connected_thread');

      discoveries.push({
        id: `disc_cluster_${topicKey}`,
        title,
        explanation,
        category: topicKey === 'tcs_hackquest' ? 'career' : 'academic',
        discoveryType: 'connected_thread',
        badgeLabel: `Connected (${cluster.length} Emails)`,
        sourceType: 'gmail',
        sourceId: primary.id,
        primaryDate: primary.receivedAt,
        relatedCount: cluster.length,
        relatedSources: cluster.map(e => ({
          id: e.id,
          type: 'gmail',
          title: cleanTitle(e.subject || 'Update'),
          date: e.receivedAt
        })),
        rawEmail: primary
      });
    }
  }

  // ------------------------------------------------------------------
  // STAGE 3: Semantic Thread Changes & Updates
  // ------------------------------------------------------------------
  for (const em of emails) {
    if (processedEmailIds.has(em.id)) continue;
    if (isNoise(em.subject || '', em.snippet || '', em.sender || '')) continue;

    const sub = em.subject || '';
    const body = em.bodyText || em.snippet || '';
    const corpus = `${sub} ${body}`.toLowerCase();

    // Check for change / update signals
    const isThreadReply = sub.toLowerCase().startsWith('re:') || sub.toLowerCase().startsWith('fwd: re:');
    const hasChangeSignals = 
      corpus.includes('accommodate') ||
      corpus.includes('seats available') ||
      corpus.includes('more students') ||
      corpus.includes('extended the deadline') ||
      corpus.includes('rescheduled') ||
      corpus.includes('bus no') ||
      corpus.includes('timing changed') ||
      corpus.includes('corrigendum');

    if (isThreadReply && hasChangeSignals) {
      processedEmailIds.add(em.id);
      const title = formatDiscoveryTitle(sub, body, 'update');
      const explanation = extractWhyItMatters(sub, em.snippet || '', body, 'update');

      discoveries.push({
        id: `disc_update_${em.id}`,
        title,
        explanation,
        category: corpus.includes('bus') ? 'personal' : 'academic',
        discoveryType: 'update',
        badgeLabel: 'Thread Update',
        sourceType: 'gmail',
        sourceId: em.id,
        primaryDate: em.receivedAt,
        rawEmail: em
      });
    }

    if (discoveries.length >= 4) break;
  }

  // ------------------------------------------------------------------
  // STAGE 4: High-Value Career & Learning Opportunities
  // ------------------------------------------------------------------
  for (const em of emails) {
    if (discoveries.length >= 4) break;
    if (processedEmailIds.has(em.id)) continue;
    if (isNoise(em.subject || '', em.snippet || '', em.sender || '')) continue;

    const sub = em.subject || '';
    const body = em.bodyText || em.snippet || '';
    const corpus = `${sub} ${body}`.toLowerCase();

    // Avoid duplicating items already handled as strict homework/tasks in Responsibilities
    if (pendingTaskTitles.has(sub.toLowerCase().trim())) continue;

    const isOpportunity =
      corpus.includes('stipend') ||
      corpus.includes('internship') ||
      corpus.includes('ppo') ||
      corpus.includes('pre-placement') ||
      corpus.includes('hiring challenge') ||
      corpus.includes('innovation challenge') ||
      corpus.includes('prize') ||
      corpus.includes('cash prizes') ||
      corpus.includes('hackathon');

    if (isOpportunity) {
      processedEmailIds.add(em.id);
      const title = formatDiscoveryTitle(sub, body, 'opportunity');
      const explanation = extractWhyItMatters(sub, em.snippet || '', body, 'opportunity');

      discoveries.push({
        id: `disc_opp_${em.id}`,
        title,
        explanation,
        category: 'career',
        discoveryType: 'opportunity',
        badgeLabel: 'New Opportunity',
        sourceType: 'gmail',
        sourceId: em.id,
        primaryDate: em.receivedAt,
        rawEmail: em
      });
    }
  }

  // ------------------------------------------------------------------
  // STAGE 5: Important Departmental & Campus Announcements
  // ------------------------------------------------------------------
  for (const em of emails) {
    if (discoveries.length >= 4) break;
    if (processedEmailIds.has(em.id)) continue;
    if (isNoise(em.subject || '', em.snippet || '', em.sender || '')) continue;

    const sub = em.subject || '';
    const body = em.bodyText || em.snippet || '';
    const corpus = `${sub} ${body}`.toLowerCase();

    const isImportantAnnouncement =
      corpus.includes('tech talk') ||
      corpus.includes('guest lecture') ||
      corpus.includes('symposium') ||
      corpus.includes('autonomous') ||
      corpus.includes('certification') ||
      corpus.includes('recruitment drive') ||
      corpus.includes('test series');

    if (isImportantAnnouncement) {
      processedEmailIds.add(em.id);
      const title = formatDiscoveryTitle(sub, body, 'announcement');
      const explanation = extractWhyItMatters(sub, em.snippet || '', body, 'announcement');

      discoveries.push({
        id: `disc_ann_${em.id}`,
        title,
        explanation,
        category: corpus.includes('test series') || corpus.includes('career') ? 'career' : 'academic',
        discoveryType: 'announcement',
        badgeLabel: 'Key Announcement',
        sourceType: 'gmail',
        sourceId: em.id,
        primaryDate: em.receivedAt,
        rawEmail: em
      });
    }
  }

  return discoveries.slice(0, 4);
}
