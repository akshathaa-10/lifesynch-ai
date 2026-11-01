import { 
  Responsibility, 
  EmailRecord, 
  CalendarEventRecord, 
  TaskCategory 
} from '@lifesynch/shared';
export type { 
  IntelligentDiscovery, 
  DiscoveryType 
} from './intelligentDiscoveryService';
export { 
  generateIntelligentDiscoveries 
} from './intelligentDiscoveryService';

export type LifeCategoryId = 'academic' | 'career' | 'personal' | 'finance' | 'general';

export type LifeItemType = 
  | 'responsibility' // actionable task or deadline
  | 'event'          // calendar event or scheduled meeting
  | 'application'    // application / opportunity window (internship, hackathon, contest)
  | 'announcement'   // official academic or administrative circular / announcement
  | 'information';   // general informative email or communication

export interface ClassifiedLifeItem {
  id: string; // unique item id
  title: string;
  summary: string;
  category: LifeCategoryId;
  itemType: LifeItemType;
  sourceType: 'gmail' | 'calendar' | 'responsibility';
  sourceId: string; // original messageId, eventId, or task id
  date?: string; // relevant date if available (due date, event start, or receivedAt)
  time?: string; // relevant time string
  confidence: number; // 0.0 to 1.0
  isConfidenceUncertain?: boolean;
  actionRequired?: boolean;
  sender?: string;
  location?: string;
  htmlLink?: string;
  // Link to existing records
  responsibilityId?: string;
  rawResponsibility?: Responsibility;
  rawEmail?: EmailRecord;
  rawCalendarEvent?: CalendarEventRecord;
}

export interface LifeCategoryMeta {
  id: LifeCategoryId;
  name: string;
  shortDescription: string;
  detailedDescription: string;
  iconName: 'GraduationCap' | 'Briefcase' | 'Heart' | 'Landmark' | 'Compass';
  themeColor: string; // hex
  badgeBg: string;
  badgeText: string;
  borderHover: string;
  gradientBg: string;
}

export const LIFE_CATEGORIES: Record<LifeCategoryId, LifeCategoryMeta> = {
  academic: {
    id: 'academic',
    name: 'Academic & Learning',
    shortDescription: 'Courses, NPTEL, exams, workshops, syllabus & academic updates',
    detailedDescription: 'All academic notices, classroom lectures, NPTEL certifications, course submissions, and examinations.',
    iconName: 'GraduationCap',
    themeColor: '#4f46e5',
    badgeBg: 'bg-indigo-50 border-indigo-200/80',
    badgeText: 'text-indigo-700',
    borderHover: 'hover:border-indigo-300 hover:shadow-indigo-100/60',
    gradientBg: 'from-indigo-50/60 via-white to-white'
  },
  career: {
    id: 'career',
    name: 'Career & Opportunities',
    shortDescription: 'Internships, placements, recruitment, hackathons & competitions',
    detailedDescription: 'Campus placement drives, job openings, pre-placement interviews (PPI), coding competitions, and hackathons.',
    iconName: 'Briefcase',
    themeColor: '#d97706',
    badgeBg: 'bg-amber-50 border-amber-200/80',
    badgeText: 'text-amber-800',
    borderHover: 'hover:border-amber-300 hover:shadow-amber-100/60',
    gradientBg: 'from-amber-50/60 via-white to-white'
  },
  personal: {
    id: 'personal',
    name: 'Personal & Lifestyle',
    shortDescription: 'Appointments, health, travel, celebrations & personal schedules',
    detailedDescription: 'Personal calendar appointments, travel itineraries, celebrations, health checkups, and lifestyle events.',
    iconName: 'Heart',
    themeColor: '#059669',
    badgeBg: 'bg-emerald-50 border-emerald-200/80',
    badgeText: 'text-emerald-800',
    borderHover: 'hover:border-emerald-300 hover:shadow-emerald-100/60',
    gradientBg: 'from-emerald-50/60 via-white to-white'
  },
  finance: {
    id: 'finance',
    name: 'Finance & Administration',
    shortDescription: 'Tuition fees, receipts, bills, clearance & administrative circulars',
    detailedDescription: 'College fee receipts, payment reminders, official clearance documents, registrar notices, and administration.',
    iconName: 'Landmark',
    themeColor: '#7c3aed',
    badgeBg: 'bg-purple-50 border-purple-200/80',
    badgeText: 'text-purple-800',
    borderHover: 'hover:border-purple-300 hover:shadow-purple-100/60',
    gradientBg: 'from-purple-50/60 via-white to-white'
  },
  general: {
    id: 'general',
    name: 'General & Other',
    shortDescription: 'Club communications, community updates, digests & general notes',
    detailedDescription: 'Communications, newsletters, club updates, and other items that do not belong to the primary four categories.',
    iconName: 'Compass',
    themeColor: '#475569',
    badgeBg: 'bg-slate-100 border-slate-200',
    badgeText: 'text-slate-700',
    borderHover: 'hover:border-slate-300 hover:shadow-slate-100/60',
    gradientBg: 'from-slate-50 via-white to-white'
  }
};

const OVERRIDES_STORAGE_KEY = 'lifesynch_category_overrides';

export function getPersistedOverrides(): Record<string, LifeCategoryId> {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(OVERRIDES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function persistCategoryOverride(sourceIdOrId: string, category: LifeCategoryId): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const current = getPersistedOverrides();
    current[sourceIdOrId] = category;
    localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(current));
  } catch (err) {
    console.warn('Failed to persist category override:', err);
  }
}

// Convert shared TaskCategory to LifeCategoryId
export function mapTaskCategoryToLifeCategory(taskCat?: string): LifeCategoryId {
  if (!taskCat) return 'general';
  const norm = taskCat.toLowerCase();
  if (norm === 'academic') return 'academic';
  if (norm === 'work' || norm === 'career') return 'career';
  if (norm === 'personal') return 'personal';
  if (norm === 'finance') return 'finance';
  return 'general';
}

// Convert LifeCategoryId back to TaskCategory for backend persistence
export function mapLifeCategoryToTaskCategory(lifeCat: LifeCategoryId): TaskCategory {
  switch (lifeCat) {
    case 'academic': return 'academic';
    case 'career': return 'work';
    case 'personal': return 'personal';
    case 'finance': return 'finance';
    default: return 'general';
  }
}

// Deep AI rule classification for texts, subjects, and senders
interface ClassificationAnalysis {
  category: LifeCategoryId;
  itemType: LifeItemType;
  confidence: number;
  isConfidenceUncertain: boolean;
}

function containsWord(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
}

export function analyzeLifeClassification(
  title: string,
  content: string = '',
  sender: string = '',
  knownTaskCategory?: string,
  knownClassification?: string
): ClassificationAnalysis {
  const combined = `${title} ${content} ${sender}`.toLowerCase();

  // 1. Personal & Lifestyle (Check first for personal healthcare/appointments/travel)
  const personalPatterns = [
    'appointment', 'doctor', 'dentist', 'clinic', 'hospital', 'flight', 'hotel', 
    'booking', 'trip', 'vacation', 'birthday', 'anniversary', 'gym', 'workout', 
    'ticket', 'train', 'irctc', 'dinner', 'celebration', 'personal'
  ];
  if (personalPatterns.some(p => containsWord(combined, p))) {
    let itemType: LifeItemType = 'event';
    if (combined.includes('appointment') || combined.includes('meeting')) {
      itemType = 'event';
    } else if (combined.includes('pay') || combined.includes('book')) {
      itemType = 'responsibility';
    } else {
      itemType = 'information';
    }
    return {
      category: 'personal',
      itemType,
      confidence: 0.88,
      isConfidenceUncertain: false
    };
  }

  // 2. Finance & Administration
  const financePatterns = [
    'fee receipt', 'tuition fee', 'collection of fees', 'fee payment', 'fees receipt', 
    'mess fee', 'hostel fee', 'exam fee', 'payment receipt', 'invoice', 'bank', 
    'transaction', 'challan', 'clearance', 'registrar', 'admission fee', 'administrative'
  ];
  const isFinanceSender = sender.toLowerCase().includes('studentfee') || 
                          sender.toLowerCase().includes('finance') || 
                          sender.toLowerCase().includes('accounts') ||
                          sender.toLowerCase().includes('fee');

  if (isFinanceSender || financePatterns.some(p => combined.includes(p)) || containsWord(combined, 'sbi')) {
    let itemType: LifeItemType = 'announcement';
    if (combined.includes('before the due date') || combined.includes('pay') || combined.includes('submit')) {
      itemType = 'responsibility';
    } else if (combined.includes('receipt') || combined.includes('acknowledgement')) {
      itemType = 'information';
    }
    return {
      category: 'finance',
      itemType,
      confidence: 0.94,
      isConfidenceUncertain: false
    };
  }

  // 3. Career & Opportunities
  const careerPhrases = [
    'internship', 'placement', 'recruitment', 'stipend', 
    'hackathon', 'hiring', 'campus drive', 'job opportunity', 'unstop', 'challenge', 
    'contest', 'competition', 'eurogrip', 'adobe', 'tvs credit', 'pre-placement', 
    'resume', 'shortlist', 'screening test', 'recruiter', 'apply now', 'applications closing'
  ];
  const careerShortWords = ['ppi', 'ppo', 'ctc'];
  const isCareerSender = sender.toLowerCase().includes('placement') || 
                         sender.toLowerCase().includes('unstop') || 
                         sender.toLowerCase().includes('career') || 
                         sender.toLowerCase().includes('recruitment');

  if (
    isCareerSender || 
    careerPhrases.some(p => combined.includes(p)) ||
    careerShortWords.some(w => containsWord(combined, w))
  ) {
    let itemType: LifeItemType = 'application';
    if (combined.includes('interview') || combined.includes('meeting') || combined.includes('scheduled at')) {
      itemType = 'event';
    } else if (combined.includes('deadline') || combined.includes('submit') || combined.includes('action required')) {
      itemType = 'responsibility';
    } else if (combined.includes('results') || combined.includes('newsletter') || combined.includes('hiring alert')) {
      itemType = 'application';
    }
    return {
      category: 'career',
      itemType,
      confidence: 0.92,
      isConfidenceUncertain: false
    };
  }

  // 4. Academic & Learning
  const academicPhrases = [
    'nptel', 'course', 'submission', 'exam', 'examination', 
    'viva', 'workshop', 'seminar', 'faculty', 'professor', 'mentor', 
    'syllabus', 'curriculum', 'lecture', 'assignment', 'homework', 'attendance', 
    'grade', 'result', 'midterm', 'evaluation', 'project review', 'design review'
  ];
  const academicShortWords = ['sih', 'cie', 'lab', 'quiz', 'test'];
  const isAcademicSender = sender.toLowerCase().includes('nptel') || 
                           sender.toLowerCase().includes('swayam') || 
                           sender.toLowerCase().includes('nie.ac.in') || 
                           sender.toLowerCase().includes('classroom') ||
                           sender.toLowerCase().includes('faculty');

  if (
    academicPhrases.some(p => combined.includes(p)) || 
    academicShortWords.some(w => containsWord(combined, w)) ||
    isAcademicSender
  ) {
    let itemType: LifeItemType = 'announcement';
    if (combined.includes('submit') || combined.includes('submission') || combined.includes('assignment') || combined.includes('due date')) {
      itemType = 'responsibility';
    } else if (combined.includes('review') || combined.includes('viva') || combined.includes('evaluation') || combined.includes('session') || combined.includes('meeting')) {
      itemType = 'event';
    } else if (combined.includes('circular') || combined.includes('notice') || combined.includes('information')) {
      itemType = 'announcement';
    }
    return {
      category: 'academic',
      itemType,
      confidence: 0.90,
      isConfidenceUncertain: false
    };
  }

  // Fallback on knownTaskCategory if provided
  if (knownTaskCategory && knownTaskCategory !== 'general') {
    const mapped = mapTaskCategoryToLifeCategory(knownTaskCategory);
    let itemType: LifeItemType = 'information';
    if (knownClassification === 'action_required') itemType = 'responsibility';
    else if (knownClassification === 'opportunity_window') itemType = 'application';
    else if (knownClassification === 'event_meeting') itemType = 'event';
    return {
      category: mapped,
      itemType,
      confidence: 0.80,
      isConfidenceUncertain: false
    };
  }

  // 5. General & Other
  return {
    category: 'general',
    itemType: 'information',
    confidence: 0.50,
    isConfidenceUncertain: true
  };
}

/**
 * Aggregates all responsibilities, calendar events, and emails into a unified,
 * deduplicated collection of ClassifiedLifeItem records.
 */
export function aggregateAndClassifyAll(
  tasks: Responsibility[] = [],
  emails: EmailRecord[] = [],
  calendarEvents: CalendarEventRecord[] = []
): {
  items: ClassifiedLifeItem[];
  counts: Record<LifeCategoryId, number>;
  categoryItemsMap: Record<LifeCategoryId, ClassifiedLifeItem[]>;
} {
  const overrides = getPersistedOverrides();
  const classifiedItems: ClassifiedLifeItem[] = [];
  const processedSourceIds = new Set<string>();

  // 1. Process Responsibilities (Primary source for items already known to LifeSynch)
  for (const t of tasks) {
    if (t.isArchived || (t.status || '').toUpperCase() === 'CANCELLED') continue;

    // Track original source IDs to prevent duplicates
    if (t.sourceId) processedSourceIds.add(t.sourceId);
    if (t.secondarySourceId) processedSourceIds.add(t.secondarySourceId);
    if (t.sourceContext?.calendarEventId) processedSourceIds.add(t.sourceContext.calendarEventId);
    if (t.id) processedSourceIds.add(t.id);

    // Classification
    const override = overrides[t.id] || (t.sourceId ? overrides[t.sourceId] : undefined);
    const analysis = analyzeLifeClassification(
      t.title,
      t.description || t.sourceContext?.snippet || '',
      t.sourceContext?.sender || '',
      t.category,
      t.sourceContext?.classification
    );

    const category = override || analysis.category;

    // Item Type Determination
    let itemType: LifeItemType = analysis.itemType;
    if (t.sourceContext?.classification === 'opportunity_window') {
      itemType = 'application';
    } else if (t.sourceContext?.classification === 'event_meeting' || t.source === 'calendar') {
      itemType = 'event';
    } else if (t.dueDate || t.sourceContext?.classification === 'action_required') {
      itemType = 'responsibility';
    } else if (t.sourceContext?.classification === 'informational' || t.sourceContext?.classification === 'program_schedule') {
      itemType = analysis.itemType === 'application' ? 'application' : 'announcement';
    }

    classifiedItems.push({
      id: `task_${t.id}`,
      title: t.title,
      summary: t.sourceContext?.nextStep || t.description || t.sourceContext?.snippet || '',
      category,
      itemType,
      sourceType: 'responsibility',
      sourceId: t.sourceId || t.id,
      date: t.dueDate || t.sourceContext?.receivedAt,
      time: t.dueTime,
      confidence: analysis.confidence,
      isConfidenceUncertain: category === 'general',
      actionRequired: itemType === 'responsibility',
      sender: t.sourceContext?.sender,
      location: t.sourceContext?.location,
      responsibilityId: t.id,
      rawResponsibility: t
    });
  }

  // 2. Process Calendar Events (Exclude those already tied to a responsibility)
  for (const ev of calendarEvents) {
    if (ev.status === 'cancelled') continue;
    if (processedSourceIds.has(ev.id) || processedSourceIds.has(ev.eventId)) {
      continue;
    }
    processedSourceIds.add(ev.id);
    if (ev.eventId) processedSourceIds.add(ev.eventId);

    const override = overrides[ev.id] || overrides[ev.eventId];
    const analysis = analyzeLifeClassification(
      ev.summary,
      ev.description || '',
      ev.location || ''
    );

    const category = override || (analysis.category === 'general' ? 'personal' : analysis.category);

    classifiedItems.push({
      id: `cal_${ev.id}`,
      title: ev.summary || '(Untitled Event)',
      summary: ev.description || (ev.location ? `Location: ${ev.location}` : 'Scheduled Calendar Event'),
      category,
      itemType: 'event',
      sourceType: 'calendar',
      sourceId: ev.id,
      date: ev.startTime,
      confidence: analysis.confidence,
      isConfidenceUncertain: false,
      actionRequired: false,
      location: ev.location,
      htmlLink: ev.htmlLink,
      rawCalendarEvent: ev
    });
  }

  // 3. Process Emails (Exclude emails already processed into responsibilities)
  for (const em of emails) {
    if (processedSourceIds.has(em.id) || processedSourceIds.has(em.messageId)) {
      continue;
    }
    processedSourceIds.add(em.id);
    if (em.messageId) processedSourceIds.add(em.messageId);

    const override = overrides[em.id] || overrides[em.messageId];
    const analysis = analyzeLifeClassification(
      em.subject || '',
      em.snippet || em.bodyText || '',
      em.sender || ''
    );

    const category = override || analysis.category;

    classifiedItems.push({
      id: `email_${em.id}`,
      title: em.subject || '(No Subject)',
      summary: em.snippet || '',
      category,
      itemType: analysis.itemType,
      sourceType: 'gmail',
      sourceId: em.id,
      date: em.receivedAt,
      confidence: analysis.confidence,
      isConfidenceUncertain: category === 'general',
      actionRequired: analysis.itemType === 'responsibility',
      sender: em.sender,
      rawEmail: em
    });
  }

  // Compute category counts and items map
  const counts: Record<LifeCategoryId, number> = {
    academic: 0,
    career: 0,
    personal: 0,
    finance: 0,
    general: 0
  };

  const categoryItemsMap: Record<LifeCategoryId, ClassifiedLifeItem[]> = {
    academic: [],
    career: [],
    personal: [],
    finance: [],
    general: []
  };

  for (const item of classifiedItems) {
    counts[item.category] = (counts[item.category] || 0) + 1;
    categoryItemsMap[item.category].push(item);
  }

  return { items: classifiedItems, counts, categoryItemsMap };
}

export interface DailyBriefingSummary {
  headline: string;
  narrativeOverview: string;
  domainBriefs: Array<{
    category: LifeCategoryId;
    categoryTitle: string;
    summary: string;
    itemCount: number;
  }>;
  generatedAt: string;
}

/**
 * Generates an intelligent, grounded Daily Briefing based strictly on the user's
 * actual classified items without repeating task lists or hallucinating.
 */
export function generateDailyBriefing(
  items: ClassifiedLifeItem[],
  categoryItemsMap: Record<LifeCategoryId, ClassifiedLifeItem[]>,
  userName: string = 'there'
): DailyBriefingSummary {
  const firstName = userName.split(' ')[0] || 'there';

  const careerItems = categoryItemsMap.career || [];
  const academicItems = categoryItemsMap.academic || [];
  const financeItems = categoryItemsMap.finance || [];
  const personalItems = categoryItemsMap.personal || [];

  const domainBriefs: Array<{
    category: LifeCategoryId;
    categoryTitle: string;
    summary: string;
    itemCount: number;
  }> = [];

  // Career overview
  if (careerItems.length > 0) {
    const notable = careerItems
      .map(i => i.title.replace(/fwd:\s*|\[hiring alert\]\s*|\[career opportunity\]\s*/gi, '').trim())
      .slice(0, 3);
    const summary = `Active career engagements include opportunities such as ${notable.join(', ')}.`;
    domainBriefs.push({
      category: 'career',
      categoryTitle: 'Career & Opportunities',
      summary,
      itemCount: careerItems.length
    });
  }

  // Academic overview
  if (academicItems.length > 0) {
    const academicNotes = academicItems
      .map(i => i.title.replace(/fwd:\s*|important\s*[-–:]\s*/gi, '').trim())
      .slice(0, 2);
    const summary = `Academic channels reflect recent updates on ${academicNotes.join(' and ')}, alongside scheduled reviews.`;
    domainBriefs.push({
      category: 'academic',
      categoryTitle: 'Academic & Learning',
      summary,
      itemCount: academicItems.length
    });
  }

  // Finance overview
  if (financeItems.length > 0) {
    const financeNotes = financeItems.map(i => i.title).slice(0, 2);
    const summary = `Administrative and fee records include updates regarding ${financeNotes.join(', ')}.`;
    domainBriefs.push({
      category: 'finance',
      categoryTitle: 'Finance & Administration',
      summary,
      itemCount: financeItems.length
    });
  }

  // Personal overview
  if (personalItems.length > 0) {
    const personalNotes = personalItems.map(i => i.title).slice(0, 2);
    const summary = `Personal schedule includes ${personalNotes.join(' and ')}.`;
    domainBriefs.push({
      category: 'personal',
      categoryTitle: 'Personal & Lifestyle',
      summary,
      itemCount: personalItems.length
    });
  }

  let headline = `Intelligence briefing for ${firstName}`;
  let narrativeOverview = '';

  if (careerItems.length > 0 && academicItems.length > 0) {
    narrativeOverview = `Your digital footprint reflects active career recruitment opportunities and ongoing academic milestones. Multiple industry opportunities are open for application, while institutional notifications keep you aligned with coursework.`;
  } else if (items.length > 0) {
    narrativeOverview = `LifeSynch has synthesized your synced digital records across ${domainBriefs.length} active life domains, providing continuous contextual clarity.`;
  } else {
    narrativeOverview = `Your incoming channels are currently clear. New updates from Gmail and Google Calendar will be organized and synthesized here as they arrive.`;
  }

  return {
    headline,
    narrativeOverview,
    domainBriefs,
    generatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
}

export interface WorthKnowingItem {
  id: string;
  title: string;
  explanation: string;
  category: LifeCategoryId;
  sourceType: 'gmail' | 'calendar' | 'responsibility';
  sourceId: string;
  badgeLabel: string;
  rawItem: ClassifiedLifeItem;
}

/**
 * Extracts high-value intelligent discoveries ("Worth Knowing") from the user's data.
 */
export function extractWorthKnowing(items: ClassifiedLifeItem[]): WorthKnowingItem[] {
  const discoveries: WorthKnowingItem[] = [];

  for (const item of items) {
    const titleLower = item.title.toLowerCase();
    const summaryLower = (item.summary || '').toLowerCase();

    // Check 1: Notable internship / hiring / challenge (e.g. Adobe, Eurogrip, TVS Credit)
    if (
      titleLower.includes('eurogrip') ||
      titleLower.includes('adobe') ||
      titleLower.includes('tvs credit') ||
      titleLower.includes('stipend') ||
      titleLower.includes('internship') ||
      titleLower.includes('ppi') ||
      titleLower.includes('placement') ||
      summaryLower.includes('stipend') ||
      summaryLower.includes('internship') ||
      summaryLower.includes('placement')
    ) {
      if (!discoveries.some(d => d.title.toLowerCase().includes(item.title.toLowerCase().slice(0, 15)))) {
        discoveries.push({
          id: `wk_${item.id}`,
          title: item.title,
          explanation: item.summary || 'High-value career opportunity with active application or pre-placement engagement.',
          category: 'career',
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          badgeLabel: 'Opportunity',
          rawItem: item
        });
      }
    }

    // Check 2: Academic milestone or final submission (e.g. SIH, NPTEL, exam)
    else if (
      titleLower.includes('sih') ||
      titleLower.includes('nptel') ||
      titleLower.includes('exam') ||
      titleLower.includes('submission') ||
      titleLower.includes('design review')
    ) {
      if (!discoveries.some(d => d.title.toLowerCase().includes(item.title.toLowerCase().slice(0, 15)))) {
        discoveries.push({
          id: `wk_${item.id}`,
          title: item.title,
          explanation: item.summary || 'Crucial academic milestone or departmental notice requiring your awareness.',
          category: 'academic',
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          badgeLabel: 'Academic Update',
          rawItem: item
        });
      }
    }

    // Check 3: Fee clearance or official document
    else if (
      titleLower.includes('fee receipt') ||
      titleLower.includes('collection of fees') ||
      titleLower.includes('clearance')
    ) {
      if (!discoveries.some(d => d.title.toLowerCase().includes(item.title.toLowerCase().slice(0, 15)))) {
        discoveries.push({
          id: `wk_${item.id}`,
          title: item.title,
          explanation: item.summary || 'Administrative update regarding fee clearance and document collection.',
          category: 'finance',
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          badgeLabel: 'Administrative',
          rawItem: item
        });
      }
    }

    if (discoveries.length >= 4) break;
  }

  // If fewer than 2 discoveries found, take top distinctive classified items
  if (discoveries.length < 2) {
    for (const item of items) {
      if (!discoveries.some(d => d.id === `wk_${item.id}`)) {
        discoveries.push({
          id: `wk_${item.id}`,
          title: item.title,
          explanation: item.summary || 'Important information discovered from your digital communication channels.',
          category: item.category,
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          badgeLabel: item.category === 'academic' ? 'Academic' : item.category === 'career' ? 'Career' : 'Update',
          rawItem: item
        });
      }
      if (discoveries.length >= 3) break;
    }
  }

  return discoveries.slice(0, 4);
}

export type ResponsibilitySection = 'yourDay' | 'upcoming' | 'passed' | 'informative';

export interface ItemSectionClassification {
  section: ResponsibilitySection;
  formattedScheduleText: string;
  relevantDate: Date | null;
}

export function parseItemDate(
  dueDate?: string, 
  dueTime?: string, 
  refDate: Date = new Date()
): { targetDate: Date | null; hasTime: boolean; diffDays: number | null } {
  if (!dueDate || !dueDate.trim()) return { targetDate: null, hasTime: false, diffDays: null };
  const d = new Date(dueDate);
  if (isNaN(d.getTime())) return { targetDate: null, hasTime: false, diffDays: null };

  const todayYear = refDate.getFullYear();
  const todayMonth = refDate.getMonth();
  const todayDay = refDate.getDate();
  const today = new Date(todayYear, todayMonth, todayDay);

  const targetYear = d.getFullYear();
  const targetMonth = d.getMonth();
  const targetDayNum = d.getDate();
  let hasTime = false;

  let targetDate = new Date(targetYear, targetMonth, targetDayNum);

  if (dueTime && /^\d{1,2}:\d{2}$/.test(dueTime.trim())) {
    const [h, m] = dueTime.trim().split(':').map(Number);
    targetDate.setHours(h, m, 0, 0);
    hasTime = true;
  } else if (dueDate.includes('T') && !dueDate.includes('T00:00:00')) {
    targetDate = new Date(d);
    hasTime = true;
  }

  const diffDays = Math.round((new Date(targetYear, targetMonth, targetDayNum).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return { targetDate, hasTime, diffDays };
}

export function classifyItemSection(
  item: ClassifiedLifeItem, 
  now: Date = new Date()
): ItemSectionClassification {
  // Case A: Item is a Google Calendar Event without a separate responsibility record
  if (item.rawCalendarEvent && !item.rawResponsibility) {
    const ev = item.rawCalendarEvent;
    const startDate = new Date(ev.startTime);
    const endDate = new Date(ev.endTime || ev.startTime);
    const parsedStart = parseItemDate(ev.startTime, undefined, now);
    const isConcluded = endDate.getTime() < now.getTime();
    const isToday = startDate.toDateString() === now.toDateString();

    const formatEventTime = () => {
      const sh = startDate.getHours();
      const sm = startDate.getMinutes();
      const sAmpm = sh >= 12 ? 'PM' : 'AM';
      const sH = sh % 12 || 12;
      const sM = sm < 10 ? `0${sm}` : sm;

      const eh = endDate.getHours();
      const em = endDate.getMinutes();
      const eAmpm = eh >= 12 ? 'PM' : 'AM';
      const eH = eh % 12 || 12;
      const eM = em < 10 ? `0${em}` : em;

      const timeRange = `${sH}:${sM} ${sAmpm} – ${eH}:${eM} ${eAmpm}`;
      if (parsedStart.diffDays === 0) return `Today · ${timeRange}`;
      if (parsedStart.diffDays === 1) return `Tomorrow · ${timeRange}`;
      if (parsedStart.diffDays === -1) return `Yesterday · ${timeRange}`;

      const month = startDate.toLocaleDateString('en-US', { month: 'short' });
      const day = startDate.getDate();
      const year = startDate.getFullYear();
      const datePart = year === now.getFullYear() ? `${month} ${day}` : `${month} ${day}, ${year}`;
      return `${datePart} · ${timeRange}`;
    };

    const formattedScheduleText = formatEventTime();

    if (isConcluded) {
      return { section: 'passed', formattedScheduleText, relevantDate: startDate };
    }
    if (isToday) {
      return { section: 'yourDay', formattedScheduleText, relevantDate: startDate };
    }
    return { section: 'upcoming', formattedScheduleText, relevantDate: startDate };
  }

  // Case B: Raw Gmail message without responsibility record -> Informative
  if (item.rawEmail && !item.rawResponsibility) {
    return {
      section: 'informative',
      formattedScheduleText: 'No deadline',
      relevantDate: item.rawEmail.receivedAt ? new Date(item.rawEmail.receivedAt) : null
    };
  }

  // Case C: Responsibility Record (Follows exact classification rules from Responsibilities page)
  const t = item.rawResponsibility;
  if (!t) {
    return {
      section: 'informative',
      formattedScheduleText: 'No deadline',
      relevantDate: null
    };
  }

  const isEvent = t.type === 'appointment' || t.sourceContext?.classification === 'event_meeting' || t.sourceContext?.deadlineType === 'event_time' || t.source === 'calendar';
  const classification = (t.sourceContext?.classification as string) || '';
  const deadlineType = (t.sourceContext?.deadlineType as string) || '';
  const isWindow = classification === 'opportunity_window' || classification === 'application_window' || deadlineType === 'application_window' || deadlineType === 'window_close' || !!t.sourceContext?.windowStartDate;
  const isProgram = classification === 'program_schedule' || deadlineType === 'program_duration';

  // 1. Schedule Kind Evaluation
  let scheduleKind: 'event' | 'program' | 'window' | 'deadline' = 'deadline';
  let relevantDate: Date | null = null;
  let scheduleDiffDays: number | null = null;
  let isPast = false;
  let startDate: Date | null = null;
  let endDate: Date | null = null;
  let startTimeStr: string | undefined = undefined;
  let endTimeStr: string | undefined = undefined;
  let openDate: Date | null = null;
  let closeDate: Date | null = null;

  if (isEvent) {
    scheduleKind = 'event';
    const rawDateStr = t.dueDate || (t.sourceContext?.eventDate as string) || (t.sourceContext?.startTime as string);
    startTimeStr = t.dueTime || (t.sourceContext?.startTime as string);
    endTimeStr = (t.sourceContext?.endTime as string) || (t.sourceContext?.dueTimeEnd as string);

    const parsedStart = rawDateStr ? parseItemDate(rawDateStr, startTimeStr, now) : { targetDate: null, hasTime: false, diffDays: null };
    startDate = parsedStart.targetDate;

    if (startDate) {
      endDate = new Date(startDate);
      if (endTimeStr && /^\d{1,2}:\d{2}$/.test(endTimeStr.trim())) {
        const [eh, em] = endTimeStr.trim().split(':').map(Number);
        endDate.setHours(eh, em, 0, 0);
      } else if (parsedStart.hasTime) {
        endDate.setHours(startDate.getHours() + 1, startDate.getMinutes(), 0, 0);
      } else {
        endDate.setHours(23, 59, 59, 999);
      }
    }

    isPast = endDate ? (endDate.getTime() < now.getTime()) : false;
    relevantDate = startDate;
    scheduleDiffDays = parsedStart.diffDays;
  } else if (isProgram) {
    scheduleKind = 'program';
    const rawStartStr = (t.sourceContext?.programStart as string) || (t.sourceContext?.startDate as string) || t.dueDate;
    const rawEndStr = (t.sourceContext?.programEnd as string) || (t.sourceContext?.endDate as string);
    const parsedStart = rawStartStr ? parseItemDate(rawStartStr, undefined, now) : { targetDate: null, hasTime: false, diffDays: null };
    const parsedEnd = rawEndStr ? parseItemDate(rawEndStr, undefined, now) : { targetDate: null, hasTime: false, diffDays: null };
    startDate = parsedStart.targetDate;
    endDate = parsedEnd.targetDate;
    isPast = endDate ? (now.getTime() > endDate.getTime()) : false;
    relevantDate = startDate || endDate;
    scheduleDiffDays = parsedStart.diffDays ?? parsedEnd.diffDays;
  } else if (isWindow) {
    scheduleKind = 'window';
    const rawOpenStr = (t.sourceContext?.windowStartDate as string) || (t.sourceContext?.windowOpen as string);
    const rawCloseStr = (t.sourceContext?.windowEndDate as string) || (t.sourceContext?.windowClose as string) || t.dueDate;
    const parsedOpen = rawOpenStr ? parseItemDate(rawOpenStr, undefined, now) : { targetDate: null, hasTime: false, diffDays: null };
    const parsedClose = rawCloseStr ? parseItemDate(rawCloseStr, t.dueTime, now) : { targetDate: null, hasTime: false, diffDays: null };
    openDate = parsedOpen.targetDate;
    closeDate = parsedClose.targetDate;
    isPast = closeDate ? (now.getTime() > closeDate.getTime()) : false;
    relevantDate = (openDate && openDate.getTime() > now.getTime()) ? openDate : (closeDate || openDate);
    scheduleDiffDays = parsedClose.diffDays ?? parsedOpen.diffDays;
  } else if (t.dueDate && t.dueDate.trim()) {
    scheduleKind = 'deadline';
    const parsed = parseItemDate(t.dueDate, t.dueTime, now);
    relevantDate = parsed.targetDate;
    scheduleDiffDays = parsed.diffDays;
    isPast = parsed.diffDays !== null && (
      parsed.diffDays < 0 ||
      (parsed.diffDays === 0 && parsed.targetDate && parsed.targetDate.getTime() < now.getTime()) ||
      t.status === 'OVERDUE'
    );
  }

  // 2. Schedule Text Formatting (matching Responsibilities table)
  let formattedScheduleText = 'No deadline';
  if (scheduleKind === 'event') {
    if (startDate) {
      let timePart = '';
      if (startTimeStr) {
        const [sh, sm] = startTimeStr.split(':').map(Number);
        const sAmpm = sh >= 12 ? 'PM' : 'AM';
        const sH = sh % 12 || 12;
        const sM = sm < 10 ? `0${sm}` : sm;
        if (endTimeStr) {
          const [eh, em] = endTimeStr.split(':').map(Number);
          const eAmpm = eh >= 12 ? 'PM' : 'AM';
          const eH = eh % 12 || 12;
          const eM = em < 10 ? `0${em}` : em;
          timePart = `${sH}:${sM} ${sAmpm} – ${eH}:${eM} ${eAmpm}`;
        } else {
          timePart = `${sH}:${sM} ${sAmpm}`;
        }
      }
      if (scheduleDiffDays === 0) formattedScheduleText = timePart ? `Today · ${timePart}` : 'Today';
      else if (scheduleDiffDays === 1) formattedScheduleText = timePart ? `Tomorrow · ${timePart}` : 'Tomorrow';
      else if (scheduleDiffDays === -1) formattedScheduleText = timePart ? `Yesterday · ${timePart}` : 'Yesterday';
      else {
        const month = startDate.toLocaleDateString('en-US', { month: 'short' });
        const day = startDate.getDate();
        const year = startDate.getFullYear();
        const isCurrentYear = year === now.getFullYear();
        const datePart = isCurrentYear ? `${month} ${day}` : `${month} ${day}, ${year}`;
        formattedScheduleText = timePart ? `${datePart} · ${timePart}` : datePart;
      }
    }
  } else if (scheduleKind === 'program') {
    const sM = startDate ? startDate.toLocaleDateString('en-US', { month: 'short' }) : '';
    const sD = startDate ? startDate.getDate() : '';
    const eM = endDate ? endDate.toLocaleDateString('en-US', { month: 'short' }) : '';
    const eD = endDate ? endDate.getDate() : '';
    if (sD && eD) formattedScheduleText = sM === eM ? `${sM} ${sD} – ${eD}` : `${sM} ${sD} – ${eM} ${eD}`;
    else if (sD) formattedScheduleText = `${sM} ${sD}`;
    else if (eD) formattedScheduleText = `${eM} ${eD}`;
  } else if (scheduleKind === 'window') {
    const oM = openDate ? openDate.toLocaleDateString('en-US', { month: 'short' }) : '';
    const oD = openDate ? openDate.getDate() : '';
    const cM = closeDate ? closeDate.toLocaleDateString('en-US', { month: 'short' }) : '';
    const cD = closeDate ? closeDate.getDate() : '';
    if (oD && cD) formattedScheduleText = oM === cM ? `${oM} ${oD} – ${cD}` : `${oM} ${oD} – ${cM} ${cD}`;
    else if (cD) {
      let timePart = '';
      if (t.dueTime) {
        const [h, m] = t.dueTime.split(':').map(Number);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const displayH = h % 12 || 12;
        const displayM = m < 10 ? `0${m}` : `${m}`;
        timePart = `${displayH}:${displayM} ${ampm}`;
      }
      formattedScheduleText = timePart ? `${cM} ${cD} · ${timePart}` : `${cM} ${cD}`;
    } else if (oD) formattedScheduleText = `${oM} ${oD}`;
  } else if (t.dueDate && t.dueDate.trim() && classification !== 'informational') {
    const parsed = parseItemDate(t.dueDate, t.dueTime, now);
    if (parsed.targetDate && parsed.diffDays !== null) {
      let timePart = '';
      if (parsed.hasTime) {
        const h = parsed.targetDate.getHours();
        const m = parsed.targetDate.getMinutes();
        const ampm = h >= 12 ? 'PM' : 'AM';
        const displayH = h % 12 || 12;
        const displayM = m < 10 ? `0${m}` : `${m}`;
        timePart = `${displayH}:${displayM} ${ampm}`;
      }
      const month = parsed.targetDate.toLocaleDateString('en-US', { month: 'short' });
      const day = parsed.targetDate.getDate();
      const year = parsed.targetDate.getFullYear();
      const datePart = year === now.getFullYear() ? `${month} ${day}` : `${month} ${day}, ${year}`;

      let baseDate = datePart;
      if (parsed.diffDays === 0) baseDate = 'Today';
      else if (parsed.diffDays === 1) baseDate = 'Tomorrow';
      else if (parsed.diffDays === -1) baseDate = 'Yesterday';

      formattedScheduleText = timePart ? `${baseDate} · ${timePart}` : baseDate;
    }
  }

  // 3. Section Classification Logic (Exact Responsibilities page rules)
  const isScheduledEvent = scheduleKind === 'event' && startDate !== null;
  const actionText = (t.action || '').toLowerCase().trim();
  const combinedCorpus = `${t.title} ${t.action || ''} ${t.description || ''} ${String(t.sourceContext?.subject || '')} ${String(t.sourceContext?.snippet || '')}`.toLowerCase();
  const isProgramSchedule = classification === 'program_schedule' || deadlineType === 'program_duration' || scheduleKind === 'program';
  const isExplicitInformational = classification === 'informational' || classification === 'ambiguous' || t.sourceContext?.isInformationalDate === true;
  const isNoAction = actionText === '' || actionText === 'none' || actionText === 'n/a' || actionText.startsWith('no action') || actionText.includes('no action required') || actionText.includes('informational only') || actionText.startsWith('fyi');
  const hasSubmissionObligation = /\b(submit|submission|upload|pay|payment|tuition|fee|exam|viva|assessment|test|interview|apply\s+by|register\s+before|last\s+date\s+to\s+apply|due\s+by|deadline)\b/i.test(combinedCorpus);
  const isGeneralAnnouncementOrProgramInfo = /\b(program|sdp|fdp|skill\s+development|sessions?\s+from|music\s+club|club\s+audition|auditions|webinar|workshop|conference|seminar|orientation|celebration|announcement|circular|newsletter|bulletin|participation)\b/i.test(combinedCorpus) && !hasSubmissionObligation;

  const isNonActionableInfo = isProgramSchedule || isExplicitInformational || isNoAction || isGeneralAnnouncementOrProgramInfo;

  let hasGenuineDeadline = false;
  let targetDeadlineDate: Date | null = null;
  let deadlineDiffDays: number | null = null;

  if (!isNonActionableInfo) {
    if (scheduleKind === 'window' && closeDate) {
      hasGenuineDeadline = true;
      targetDeadlineDate = closeDate;
      deadlineDiffDays = scheduleDiffDays;
    } else if (t.dueDate && t.dueDate.trim()) {
      const parsed = parseItemDate(t.dueDate, t.dueTime, now);
      if (parsed.targetDate && parsed.diffDays !== null) {
        hasGenuineDeadline = true;
        targetDeadlineDate = parsed.targetDate;
        deadlineDiffDays = parsed.diffDays;
      }
    }
  }

  // Section allocation
  if (!isScheduledEvent && !hasGenuineDeadline) {
    return { section: 'informative', formattedScheduleText, relevantDate };
  }

  if (isPast || (hasGenuineDeadline && deadlineDiffDays !== null && (deadlineDiffDays < 0 || (deadlineDiffDays === 0 && targetDeadlineDate && targetDeadlineDate.getTime() < now.getTime())))) {
    return { section: 'passed', formattedScheduleText, relevantDate };
  }

  if (hasGenuineDeadline && deadlineDiffDays === 0) {
    return { section: 'yourDay', formattedScheduleText, relevantDate: targetDeadlineDate };
  }

  if (isScheduledEvent || (hasGenuineDeadline && (deadlineDiffDays ?? 0) > 0)) {
    if (isScheduledEvent && scheduleDiffDays === 0 && startDate && startDate.getTime() >= now.getTime()) {
      return { section: 'yourDay', formattedScheduleText, relevantDate: startDate };
    }
    return { section: 'upcoming', formattedScheduleText, relevantDate };
  }

  return { section: 'informative', formattedScheduleText, relevantDate };
}

export function groupCategoryItemsBySections(
  items: ClassifiedLifeItem[], 
  now: Date = new Date()
): {
  yourDay: Array<ClassifiedLifeItem & { formattedScheduleText: string }>;
  upcoming: Array<ClassifiedLifeItem & { formattedScheduleText: string }>;
  passed: Array<ClassifiedLifeItem & { formattedScheduleText: string }>;
  informative: Array<ClassifiedLifeItem & { formattedScheduleText: string }>;
} {
  const yourDay: Array<ClassifiedLifeItem & { formattedScheduleText: string; relevantDate: Date | null }> = [];
  const upcoming: Array<ClassifiedLifeItem & { formattedScheduleText: string; relevantDate: Date | null }> = [];
  const passed: Array<ClassifiedLifeItem & { formattedScheduleText: string; relevantDate: Date | null }> = [];
  const informative: Array<ClassifiedLifeItem & { formattedScheduleText: string; relevantDate: Date | null }> = [];

  for (const item of items) {
    const classification = classifyItemSection(item, now);
    const enriched = { ...item, formattedScheduleText: classification.formattedScheduleText, relevantDate: classification.relevantDate };

    if (classification.section === 'yourDay') yourDay.push(enriched);
    else if (classification.section === 'upcoming') upcoming.push(enriched);
    else if (classification.section === 'passed') passed.push(enriched);
    else informative.push(enriched);
  }

  // Sort Your Day: earliest today first
  yourDay.sort((a, b) => (a.relevantDate?.getTime() ?? Infinity) - (b.relevantDate?.getTime() ?? Infinity));

  // Sort Upcoming: nearest future date first
  upcoming.sort((a, b) => (a.relevantDate?.getTime() ?? Infinity) - (b.relevantDate?.getTime() ?? Infinity));

  // Sort Passed: most recently passed/concluded first (descending)
  passed.sort((a, b) => (b.relevantDate?.getTime() ?? 0) - (a.relevantDate?.getTime() ?? 0));

  // Sort Informative: newest received/created first (descending)
  informative.sort((a, b) => {
    const timeA = a.date ? new Date(a.date).getTime() : 0;
    const timeB = b.date ? new Date(b.date).getTime() : 0;
    return timeB - timeA;
  });

  return { yourDay, upcoming, passed, informative };
}
