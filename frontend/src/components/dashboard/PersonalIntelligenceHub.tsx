import React, { useState, useMemo } from 'react';
import { 
  Sparkles, 
  GraduationCap, 
  Briefcase, 
  Heart, 
  Landmark, 
  Compass, 
  ArrowRight, 
  ArrowLeft, 
  Mail, 
  Calendar as CalendarIcon, 
  Clock, 
  X,
  Send,
  HelpCircle,
  ChevronRight,
  AlertTriangle
} from 'lucide-react';
import { 
  Responsibility, 
  EmailRecord, 
  CalendarEventRecord,
  User 
} from '@lifesynch/shared';
import { 
  LifeCategoryId, 
  ClassifiedLifeItem, 
  LIFE_CATEGORIES, 
  aggregateAndClassifyAll, 
  persistCategoryOverride,
  mapLifeCategoryToTaskCategory,
  groupCategoryItemsBySections,
  ResponsibilitySection
} from '../../services/lifeCategoryService';
import { 
  generateIntelligentDiscoveries, 
  IntelligentDiscovery 
} from '../../services/intelligentDiscoveryService';

interface PersonalIntelligenceHubProps {
  user: User | null;
  tasks: Responsibility[];
  emails: EmailRecord[];
  calendarEvents: CalendarEventRecord[];
  onSelectResponsibility: (item: Responsibility) => void;
  onSelectEmail: (emailId: string) => void;
  onSelectCalendarEvent?: (eventId: string) => void;
  onAskQuestion: (question: string) => void;
  onUpdateTaskCategory?: (taskId: string, newCategory: string) => Promise<void>;
}

export const PersonalIntelligenceHub: React.FC<PersonalIntelligenceHubProps> = ({
  user,
  tasks,
  emails,
  calendarEvents,
  onSelectResponsibility,
  onSelectEmail,
  onSelectCalendarEvent,
  onAskQuestion,
  onUpdateTaskCategory
}) => {
  // State for active category detail view
  const [activeCategory, setActiveCategory] = useState<LifeCategoryId | null>(null);
  
  // Smooth scroll to section in category detail view
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  
  // Custom AI input query in the entry point
  const [customInquiry, setCustomInquiry] = useState<string>('');

  // Selected email or event preview modal
  const [previewEmail, setPreviewEmail] = useState<EmailRecord | null>(null);
  const [previewEvent, setPreviewEvent] = useState<CalendarEventRecord | null>(null);

  // Dynamic overrides version trigger for reactive local updates
  const [overrideVersion, setOverrideVersion] = useState<number>(0);

  // Time-based personalized greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const userName = user?.name ? user.name.split(' ')[0] : 'there';

  // Aggregate and classify all unique items reactively
  const { counts, categoryItemsMap } = useMemo(() => {
    void overrideVersion;
    return aggregateAndClassifyAll(tasks, emails, calendarEvents);
  }, [tasks, emails, calendarEvents, overrideVersion]);

  // Extract intelligent discoveries ("Worth Knowing") analyzing complete messages and context
  const worthKnowing = useMemo(() => {
    return generateIntelligentDiscoveries(emails, calendarEvents, tasks);
  }, [emails, calendarEvents, tasks]);

  // Handle changing an item's category
  const handleCategoryChange = async (item: ClassifiedLifeItem, targetCategory: LifeCategoryId) => {
    if (item.category === targetCategory) return;

    persistCategoryOverride(item.sourceId, targetCategory);
    if (item.responsibilityId) {
      persistCategoryOverride(item.responsibilityId, targetCategory);
      if (onUpdateTaskCategory) {
        const mappedTaskCat = mapLifeCategoryToTaskCategory(targetCategory);
        await onUpdateTaskCategory(item.responsibilityId, mappedTaskCat);
      }
    }
    setOverrideVersion(v => v + 1);
  };

  // Open intelligent discovery source
  const handleDiscoveryClick = (discovery: IntelligentDiscovery) => {
    if (discovery.rawResponsibility) {
      onSelectResponsibility(discovery.rawResponsibility);
    } else if (discovery.rawCalendarEvent) {
      if (discovery.rawCalendarEvent.htmlLink) {
        window.open(discovery.rawCalendarEvent.htmlLink, '_blank', 'noopener,noreferrer');
      } else if (onSelectCalendarEvent) {
        onSelectCalendarEvent(discovery.rawCalendarEvent.id);
      } else {
        setPreviewEvent(discovery.rawCalendarEvent);
      }
    } else if (discovery.rawEmail) {
      setPreviewEmail(discovery.rawEmail);
    } else if (discovery.sourceType === 'gmail' && discovery.sourceId) {
      onSelectEmail(discovery.sourceId);
    } else if (discovery.sourceType === 'calendar' && onSelectCalendarEvent) {
      onSelectCalendarEvent(discovery.sourceId);
    }
  };

  // Open item source
  const handleItemClick = (item: ClassifiedLifeItem) => {
    if (item.rawResponsibility) {
      onSelectResponsibility(item.rawResponsibility);
    } else if (item.rawEmail) {
      setPreviewEmail(item.rawEmail);
    } else if (item.rawCalendarEvent) {
      if (item.rawCalendarEvent.htmlLink) {
        window.open(item.rawCalendarEvent.htmlLink, '_blank', 'noopener,noreferrer');
      } else if (onSelectCalendarEvent) {
        onSelectCalendarEvent(item.rawCalendarEvent.id);
      } else {
        setPreviewEvent(item.rawCalendarEvent);
      }
    } else if (item.sourceType === 'gmail' && item.sourceId) {
      onSelectEmail(item.sourceId);
    }
  };

  // Render category icon
  const renderCategoryIcon = (id: LifeCategoryId, className = 'w-5 h-5') => {
    switch (id) {
      case 'academic': return <GraduationCap className={className} />;
      case 'career': return <Briefcase className={className} />;
      case 'personal': return <Heart className={className} />;
      case 'finance': return <Landmark className={className} />;
      default: return <Compass className={className} />;
    }
  };

  // Grouped sections for Category Detail View
  const activeSections = useMemo(() => {
    if (!activeCategory) return { yourDay: [], upcoming: [], passed: [], informative: [] };
    const list = categoryItemsMap[activeCategory] || [];
    return groupCategoryItemsBySections(list, new Date());
  }, [activeCategory, categoryItemsMap]);

  // Section counts for Category Detail View navigation indicators
  const categorySectionCounts = useMemo(() => {
    return {
      yourDay: activeSections.yourDay.length,
      upcoming: activeSections.upcoming.length,
      passed: activeSections.passed.length,
      informative: activeSections.informative.length,
      total: activeCategory ? (categoryItemsMap[activeCategory] || []).length : 0
    };
  }, [activeCategory, categoryItemsMap, activeSections]);

  // Handle inquiry submit
  const handleInquirySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInquiry.trim()) return;
    onAskQuestion(customInquiry.trim());
    setCustomInquiry('');
  };

  // -------------------------------------------------------------
  // RENDER: CATEGORY DETAIL VIEW (ORGANIZED INTO 4 SECTIONS)
  // -------------------------------------------------------------
  if (activeCategory) {
    const meta = LIFE_CATEGORIES[activeCategory];
    const totalMatchingItems = 
      activeSections.yourDay.length +
      activeSections.upcoming.length +
      activeSections.passed.length +
      activeSections.informative.length;

    const renderSectionBlock = (
      sectionKey: ResponsibilitySection,
      sectionTitle: string,
      badgeStyle: string,
      icon: React.ReactNode,
      description: string,
      sectionItems: Array<ClassifiedLifeItem & { formattedScheduleText: string }>
    ) => {
      if (sectionItems.length === 0) {
        return null;
      }

      const sectionId = `section-${sectionKey === 'yourDay' ? 'your-day' : sectionKey}`;

      return (
        <div key={sectionKey} id={sectionId} className="space-y-3 scroll-mt-6">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-200/80">
            <div className="flex items-center gap-3">
              <span className={`text-xs font-bold px-3 py-1 rounded-xl border uppercase tracking-wider flex items-center gap-1.5 shadow-xs ${badgeStyle}`}>
                {icon}
                <span>{sectionTitle}</span>
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {sectionItems.length}
              </span>
            </div>
            <p className="text-xs text-slate-500">{description}</p>
          </div>

          {/* Section Items Table */}
          <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-sm">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/70 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4 w-[36%]">Event / Responsibility</th>
                    <th className="py-3 px-4 w-[28%]">Action Required / Summary</th>
                    <th className="py-3 px-4 w-[22%]">Deadline / Date & Time</th>
                    <th className="py-3 px-4 w-[14%] text-right">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {sectionItems.map(item => {
                    const formattedDate = item.formattedScheduleText;
                    let dateColor = 'text-slate-700';
                    if (formattedDate === 'No deadline') {
                      dateColor = 'text-slate-400';
                    } else if (sectionKey === 'yourDay') {
                      dateColor = 'text-amber-700 font-semibold';
                    } else if (sectionKey === 'passed') {
                      dateColor = 'text-rose-600 font-medium';
                    } else if (sectionKey === 'upcoming') {
                      dateColor = item.itemType === 'event' ? 'text-sky-700 font-medium' : 'text-indigo-700 font-medium';
                    } else if (sectionKey === 'informative') {
                      dateColor = 'text-slate-500';
                    }

                    const conciseAction = item.rawResponsibility?.sourceContext?.nextStep || item.rawResponsibility?.action;

                    return (
                      <tr
                        key={item.id}
                        onClick={() => handleItemClick(item)}
                        className="group hover:bg-slate-50/80 transition-colors cursor-pointer"
                      >
                        {/* Column 1: Event / Responsibility */}
                        <td className="py-3.5 px-4 align-top">
                          <div className="flex items-start gap-2.5">
                            <div className="shrink-0 mt-0.5">
                              {item.itemType === 'event' ? (
                                <div className="w-4 h-4 rounded-full bg-sky-100 border border-sky-300 flex items-center justify-center text-sky-700 text-[9px] font-bold" title="Event / Commitment">
                                  <CalendarIcon className="w-2.5 h-2.5" />
                                </div>
                              ) : item.itemType === 'application' ? (
                                <div className="w-4 h-4 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700 text-[9px] font-bold" title="Opportunity / Window">
                                  W
                                </div>
                              ) : (
                                <div className="w-4 h-4 rounded-full bg-blue-100 border border-blue-300 flex items-center justify-center text-blue-700 text-[9px] font-bold">
                                  •
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <h3 className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors leading-snug line-clamp-2">
                                {item.title}
                              </h3>
                              <div className="flex items-center gap-2 text-xs text-slate-400">
                                {item.sender && (
                                  <span className="truncate max-w-[180px]">From: {item.sender.replace(/<.*>/, '').trim()}</span>
                                )}
                                {item.location && (
                                  <span className="truncate max-w-[140px]">· {item.location}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Column 2: Action Required / Summary */}
                        <td className="py-3.5 px-4 align-top">
                          {conciseAction ? (
                            <div className="flex items-start gap-1.5 text-xs text-blue-700 font-medium pt-0.5">
                              <ArrowRight className="w-3 h-3 text-blue-500 shrink-0 mt-0.5" />
                              <span className="leading-snug line-clamp-2">{conciseAction}</span>
                            </div>
                          ) : item.summary ? (
                            <p className="text-slate-600 text-xs line-clamp-2 pt-0.5">{item.summary}</p>
                          ) : sectionKey === 'informative' ? (
                            <span className="text-slate-500 text-xs pt-0.5 block">No action required</span>
                          ) : (
                            <span className="text-slate-400 text-xs italic pt-0.5 block">Review responsibility</span>
                          )}
                        </td>

                        {/* Column 3: Deadline / Date & Time */}
                        <td className="py-3.5 px-4 align-top">
                          <span className={`text-xs ${dateColor}`}>
                            {formattedDate}
                          </span>
                        </td>

                        {/* Column 4: Source (Clean: only Gmail or Calendar) */}
                        <td className="py-3.5 px-4 align-top text-right" onClick={(e) => e.stopPropagation()}>
                          {item.rawResponsibility?.source === 'both' ? (
                            <div className="inline-flex items-center gap-1.5 justify-end">
                              <button
                                type="button"
                                onClick={() => {
                                  if (item.sourceId) onSelectEmail(item.sourceId);
                                  else handleItemClick(item);
                                }}
                                className="px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-semibold transition-colors cursor-pointer"
                                title="Gmail"
                              >
                                Gmail
                              </button>
                              <button
                                type="button"
                                onClick={() => handleItemClick(item)}
                                className="px-2.5 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-semibold transition-colors cursor-pointer"
                                title="Calendar"
                              >
                                Calendar
                              </button>
                            </div>
                          ) : (item.sourceType === 'calendar' || item.rawResponsibility?.source === 'calendar') ? (
                            <button
                              type="button"
                              onClick={() => handleItemClick(item)}
                              className="px-2.5 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-semibold transition-colors cursor-pointer"
                              title="Calendar"
                            >
                              Calendar
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                if (item.sourceId) onSelectEmail(item.sourceId);
                                else handleItemClick(item);
                              }}
                              className="px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-semibold transition-colors cursor-pointer"
                              title="Gmail"
                            >
                              Gmail
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden divide-y divide-slate-100">
              {sectionItems.map(item => {
                const formattedDate = item.formattedScheduleText;
                const conciseAction = item.rawResponsibility?.sourceContext?.nextStep || item.rawResponsibility?.action;

                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className="p-3.5 hover:bg-slate-50 transition-colors cursor-pointer space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 space-y-1">
                        <h3 className="text-xs font-semibold text-slate-800 leading-snug line-clamp-2">
                          {item.title}
                        </h3>
                        <div className="text-xs text-slate-500 flex items-center gap-2">
                          <span>{formattedDate}</span>
                        </div>
                      </div>
                      <div className="shrink-0" onClick={e => e.stopPropagation()}>
                        {item.rawResponsibility?.source === 'both' ? (
                          <div className="inline-flex items-center gap-1">
                            <span className="px-2 py-0.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                              Gmail
                            </span>
                            <span className="px-2 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold">
                              Calendar
                            </span>
                          </div>
                        ) : (item.sourceType === 'calendar' || item.rawResponsibility?.source === 'calendar') ? (
                          <span className="inline-block px-2 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold">
                            Calendar
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                            Gmail
                          </span>
                        )}
                      </div>
                    </div>

                    {conciseAction ? (
                      <div className="text-xs text-blue-700 font-medium flex items-start gap-1">
                        <ArrowRight className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{conciseAction}</span>
                      </div>
                    ) : item.summary ? (
                      <p className="text-xs text-slate-600 line-clamp-2">{item.summary}</p>
                    ) : null}

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-500">Category:</span>
                        <select
                          value={item.category}
                          onChange={(e) => handleCategoryChange(item, e.target.value as LifeCategoryId)}
                          className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-xs text-slate-700 cursor-pointer shadow-xs"
                        >
                          <option value="academic">Academic</option>
                          <option value="career">Career</option>
                          <option value="personal">Personal</option>
                          <option value="finance">Finance</option>
                          <option value="general">General</option>
                        </select>
                      </div>
                      <button
                        onClick={() => handleItemClick(item)}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer"
                      >
                        <span>{item.rawResponsibility ? 'View Details' : 'View Source'}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-fadeIn">
        {/* Detail Header & Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setActiveCategory(null);
              }}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:border-slate-300 transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Home</span>
            </button>
            <div className="h-6 w-px bg-slate-200" />
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl border ${meta.badgeBg}`}>
                <span className={meta.badgeText}>
                  {renderCategoryIcon(meta.id, 'w-5 h-5')}
                </span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">{meta.name}</h1>
                <p className="text-xs text-slate-500">{meta.detailedDescription}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-xs px-3 py-1 rounded-xl border font-bold ${meta.badgeBg} ${meta.badgeText} shadow-xs`}>
              {categorySectionCounts.total} unique {categorySectionCounts.total === 1 ? 'item' : 'items'}
            </span>
          </div>
        </div>

        {/* Section Indicators - Clean 4-card overview matching the pastel theme */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* 1. Your Day */}
          <button
            type="button"
            onClick={() => scrollToSection('section-your-day')}
            className={`p-3 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer shadow-xs ${
              categorySectionCounts.yourDay > 0
                ? 'bg-amber-50/80 border-amber-200 hover:bg-amber-100/70'
                : 'bg-white border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                categorySectionCounts.yourDay > 0
                  ? 'bg-amber-100 text-amber-700 border border-amber-200'
                  : 'bg-slate-100 text-slate-500 border border-slate-200'
              }`}>
                <Clock className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-800 tracking-wider truncate">YOUR DAY</div>
                <div className="text-xs text-slate-500 truncate">Due today</div>
              </div>
            </div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border shrink-0 ${
              categorySectionCounts.yourDay > 0
                ? 'bg-amber-100 text-amber-800 border-amber-300'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}>
              {categorySectionCounts.yourDay}
            </span>
          </button>

          {/* 2. Upcoming */}
          <button
            type="button"
            onClick={() => scrollToSection('section-upcoming')}
            className={`p-3 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer shadow-xs ${
              categorySectionCounts.upcoming > 0
                ? 'bg-indigo-50/80 border-indigo-200 hover:bg-indigo-100/70'
                : 'bg-white border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                categorySectionCounts.upcoming > 0
                  ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                  : 'bg-slate-100 text-slate-500 border border-slate-200'
              }`}>
                <CalendarIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-800 tracking-wider truncate">UPCOMING</div>
                <div className="text-xs text-slate-500 truncate">Tomorrow & future</div>
              </div>
            </div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border shrink-0 ${
              categorySectionCounts.upcoming > 0
                ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}>
              {categorySectionCounts.upcoming}
            </span>
          </button>

          {/* 3. Passed */}
          <button
            type="button"
            onClick={() => scrollToSection('section-passed')}
            className={`p-3 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer shadow-xs ${
              categorySectionCounts.passed > 0
                ? 'bg-slate-100/80 border-slate-300 hover:bg-slate-200/70'
                : 'bg-white border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 border border-slate-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-800 tracking-wider truncate">PASSED</div>
                <div className="text-xs text-slate-500 truncate">Past deadlines</div>
              </div>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full border shrink-0 bg-slate-100 text-slate-600 border-slate-200">
              {categorySectionCounts.passed}
            </span>
          </button>

          {/* 4. Informative */}
          <button
            type="button"
            onClick={() => scrollToSection('section-informative')}
            className={`p-3 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer shadow-xs ${
              categorySectionCounts.informative > 0
                ? 'bg-teal-50/80 border-teal-200 hover:bg-teal-100/70'
                : 'bg-white border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                categorySectionCounts.informative > 0
                  ? 'bg-teal-100 text-teal-700 border border-teal-200'
                  : 'bg-slate-100 text-slate-500 border border-slate-200'
              }`}>
                <Mail className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-800 tracking-wider truncate">INFORMATIVE</div>
                <div className="text-xs text-slate-500 truncate">No action required</div>
              </div>
            </div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border shrink-0 ${
              categorySectionCounts.informative > 0
                ? 'bg-teal-100 text-teal-800 border-teal-300'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}>
              {categorySectionCounts.informative}
            </span>
          </button>
        </div>

        {/* 4 Sections Content */}
        {totalMatchingItems === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-dashed border-slate-200 bg-white/70 space-y-2">
            <Compass className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">No records found</p>
            <p className="text-xs text-slate-500">
              No items classified under {meta.name} yet.
            </p>
          </div>
        ) : (
          <div className="space-y-8 pt-1">
            {/* 1. YOUR DAY */}
            {renderSectionBlock(
              'yourDay',
              'YOUR DAY',
              'bg-amber-50 text-amber-800 border-amber-200',
              <Clock className="w-3.5 h-3.5 text-amber-600" />,
              'Deadlines due today & commitments scheduled for today',
              activeSections.yourDay
            )}

            {/* 2. UPCOMING */}
            {renderSectionBlock(
              'upcoming',
              'UPCOMING',
              'bg-indigo-50 text-indigo-800 border-indigo-200',
              <CalendarIcon className="w-3.5 h-3.5 text-indigo-600" />,
              'Tomorrow and future actionable deadlines & scheduled events',
              activeSections.upcoming
            )}

            {/* 3. PASSED */}
            {renderSectionBlock(
              'passed',
              'PASSED',
              'bg-rose-50 text-rose-800 border-rose-200',
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />,
              'Concluded commitments & passed deadlines',
              activeSections.passed
            )}

            {/* 4. INFORMATIVE */}
            {renderSectionBlock(
              'informative',
              'INFORMATIVE',
              'bg-teal-50 text-teal-800 border-teal-200',
              <Mail className="w-3.5 h-3.5 text-teal-600" />,
              'Announcements, circulars, and updates with no action deadline',
              activeSections.informative
            )}
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: MAIN PERSONAL INTELLIGENCE HUB DASHBOARD
  // -------------------------------------------------------------
  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16 animate-fadeIn">
      {/* ================= 1. WELCOME SECTION ================= */}
      <section className="space-y-1 pt-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          {greeting}, {userName}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 max-w-2xl leading-relaxed">
          LifeSynch continuously understands your academic, career, and personal digital life across Gmail and Google Calendar.
        </p>
      </section>

      {/* ================= 2. EXPLORE YOUR DIGITAL LIFE ================= */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Explore Your Digital Life
            </h2>
            <p className="text-xs text-slate-500">
              AI-organized life categories across all your emails, calendar schedules, and records.
            </p>
          </div>
        </div>

        {/* 4 Primary Category Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(['academic', 'career', 'personal', 'finance'] as LifeCategoryId[]).map(catId => {
            const meta = LIFE_CATEGORIES[catId];
            const count = counts[catId] || 0;

            return (
              <div
                key={catId}
                onClick={() => setActiveCategory(catId)}
                className={`p-5 rounded-2xl border border-slate-200/80 bg-gradient-to-b ${meta.gradientBg} ${meta.borderHover} transition-all duration-200 cursor-pointer group flex flex-col justify-between space-y-4 hover:-translate-y-0.5 shadow-sm hover:shadow-md`}
              >
                <div className="space-y-3">
                  {/* Icon & Count */}
                  <div className="flex items-center justify-between">
                    <div className={`p-2.5 rounded-xl border ${meta.badgeBg}`}>
                      <span className={meta.badgeText}>
                        {renderCategoryIcon(meta.id, 'w-5 h-5')}
                      </span>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${meta.badgeBg} ${meta.badgeText}`}>
                      {count} {count === 1 ? 'item' : 'items'}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                      {meta.name}
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed mt-1 line-clamp-2">
                      {meta.shortDescription}
                    </p>
                  </div>
                </div>

                {/* Footer Link */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-500 group-hover:text-slate-900 transition-colors">
                  <span>Explore category</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>

        {/* General & Other Row Card */}
        <div
          onClick={() => setActiveCategory('general')}
          className="p-4 rounded-2xl border border-slate-200/80 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer group flex items-center justify-between gap-4 shadow-sm"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 shrink-0">
              <Compass className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                  General & Other
                </h4>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs text-slate-500 font-medium">
                  {counts.general || 0} unique items
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate">
                Club communications, newsletters, community updates, and items pending specific categorization.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 text-xs font-semibold text-slate-500 group-hover:text-slate-900 shrink-0">
            <span>View all</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </section>

      {/* ================= 4. WORTH KNOWING – INTELLIGENT DISCOVERIES ================= */}
      {worthKnowing.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Worth Knowing</span>
                <span className="text-xs font-normal text-slate-400">· Intelligent Discoveries</span>
              </h2>
              <p className="text-xs text-slate-500">
                Genuinely useful opportunities, programs, and updates surfaced by AI.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {worthKnowing.map(wk => {
              const meta = LIFE_CATEGORIES[wk.category] || LIFE_CATEGORIES.general;
              return (
                <div
                  key={wk.id}
                  onClick={() => handleDiscoveryClick(wk)}
                  className="p-4 rounded-2xl border border-slate-200/80 bg-white hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between space-y-3 shadow-xs"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border uppercase tracking-wider ${meta.badgeBg} ${meta.badgeText}`}>
                          {meta.name.split(' ')[0]}
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 uppercase tracking-wider">
                          {wk.badgeLabel}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {wk.sourceType === 'cross_source' ? (
                          <span className="text-xs font-medium text-slate-500">
                            Gmail + Calendar
                          </span>
                        ) : wk.sourceType === 'calendar' ? (
                          <button
                            type="button"
                            onClick={() => handleDiscoveryClick(wk)}
                            className="text-xs font-semibold text-indigo-700 hover:text-indigo-800 transition-colors cursor-pointer"
                            title="Google Calendar"
                          >
                            Calendar
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (wk.sourceId) onSelectEmail(wk.sourceId);
                              else handleDiscoveryClick(wk);
                            }}
                            className="text-xs font-semibold text-rose-700 hover:text-rose-800 transition-colors cursor-pointer"
                            title="Gmail"
                          >
                            Gmail
                          </button>
                        )}
                      </div>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug">
                      {wk.title}
                    </h3>

                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                      {wk.explanation}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 group-hover:text-blue-600 font-semibold transition-colors">
                    <span className="text-xs text-slate-400 group-hover:text-slate-600">
                      {wk.relatedCount && wk.relatedCount > 1 
                        ? `${wk.relatedCount} connected communications` 
                        : 'Open source'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ================= 5. LIFESYNCH AI ENTRY POINT ================= */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#1a68f0]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                Ask LifeSynch
              </h2>
              <p className="text-xs text-slate-500">
                Explore your classified emails, calendar events, and academic records using AI.
              </p>
            </div>
          </div>
        </div>

        {/* Suggested Question Chips */}
        <div className="flex flex-wrap gap-2">
          {[
            'What new opportunities have arrived?',
            'Summarize my recent academic updates.',
            'What information did I receive from the placement office?',
            'Any fee receipts or administrative notices?'
          ].map(q => (
            <button
              key={q}
              onClick={() => onAskQuestion(q)}
              className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-blue-300 hover:bg-blue-50/60 text-xs text-slate-700 hover:text-blue-700 font-medium transition-all text-left cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <HelpCircle className="w-3 h-3 text-[#1a68f0] shrink-0" />
              <span>{q}</span>
            </button>
          ))}
        </div>

        {/* Quick Inquiry Bar */}
        <form onSubmit={handleInquirySubmit} className="relative pt-1">
          <input
            type="text"
            value={customInquiry}
            onChange={(e) => setCustomInquiry(e.target.value)}
            placeholder="Ask anything about your courses, placements, deadlines, or schedule..."
            className="w-full pl-4 pr-24 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:bg-white transition-all shadow-inner"
          />
          <button
            type="submit"
            disabled={!customInquiry.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-3.5 py-1.5 rounded-xl bg-[#1a68f0] hover:bg-[#1557cc] disabled:opacity-40 disabled:hover:bg-[#1a68f0] text-white font-bold text-xs transition-all flex items-center gap-1 cursor-pointer shadow-sm"
          >
            <span>Ask</span>
            <Send className="w-3 h-3" />
          </button>
        </form>
      </section>

      {/* ================= PREVIEW MODAL: EMAIL ================= */}
      {previewEmail && (
        <div 
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setPreviewEmail(null)}
        >
          <div 
            className="w-full max-w-xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{previewEmail.subject || '(No Subject)'}</h3>
                  <p className="text-xs text-slate-500">{previewEmail.sender}</p>
                </div>
              </div>
              <button
                onClick={() => setPreviewEmail(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 text-xs text-slate-700 leading-relaxed">
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>Received: {previewEmail.receivedAt ? new Date(previewEmail.receivedAt).toLocaleString() : 'Recent'}</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 whitespace-pre-wrap font-sans">
                {previewEmail.bodyText || previewEmail.snippet || 'No body content available.'}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => {
                  const id = previewEmail.id;
                  setPreviewEmail(null);
                  onSelectEmail(id);
                }}
                className="px-4 py-2 rounded-xl bg-[#1a68f0] hover:bg-[#1557cc] text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <span>Open in Gmail Tab</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= PREVIEW MODAL: CALENDAR EVENT ================= */}
      {previewEvent && (
        <div 
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setPreviewEvent(null)}
        >
          <div 
            className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                  <CalendarIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{previewEvent.summary || '(Untitled Event)'}</h3>
                  <p className="text-xs text-slate-500">{new Date(previewEvent.startTime).toLocaleString()}</p>
                </div>
              </div>
              <button
                onClick={() => setPreviewEvent(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              {previewEvent.location && (
                <p><span className="text-slate-500">Location:</span> {previewEvent.location}</p>
              )}
              {previewEvent.description && (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 whitespace-pre-wrap">
                  {previewEvent.description}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setPreviewEvent(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
