import { cleanEmailDescription, deriveSpecificNextStep } from '../../utils/textUtils';
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
import { WorthKnowingDetailModal } from './WorthKnowingDetailModal';

interface PersonalIntelligenceHubProps {
  user: User | null;
  tasks: Responsibility[];
  emails: EmailRecord[];
  calendarEvents: CalendarEventRecord[];
  isLoading?: boolean;
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
  isLoading = false,
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
  const [selectedDiscovery, setSelectedDiscovery] = useState<IntelligentDiscovery | null>(null);

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

  // Open intelligent discovery source as structured Worth Knowing detail
  const handleDiscoveryClick = (discovery: IntelligentDiscovery) => {
    setSelectedDiscovery(discovery);
  };

  // Open item source as full Responsibility Details
  const handleItemClick = (item: ClassifiedLifeItem) => {
    if (item.rawResponsibility) {
      const resp: Responsibility = { ...item.rawResponsibility };
      if (!resp.description && (item.summary || item.rawEmail?.snippet || item.rawCalendarEvent?.description)) {
        resp.description = item.summary || item.rawCalendarEvent?.description || item.rawEmail?.snippet || '';
      }
      onSelectResponsibility(resp);
    } else {
      // Synthesize a complete Responsibility record so EVERY category item
      // opens the full Responsibility Details page
      const synthesizedResp: Responsibility = {
        id: item.responsibilityId || item.id,
        userId: '',
        title: item.title,
        description: cleanEmailDescription(item.summary || item.rawCalendarEvent?.description || item.rawEmail?.bodyText || item.rawEmail?.snippet || (item.rawCalendarEvent?.location ? `Scheduled event at ${item.rawCalendarEvent.location}` : '')),
        type: item.itemType === 'event' ? 'appointment' : 'task',
        priority: 'medium',
        status: 'pending',
        category: mapLifeCategoryToTaskCategory(item.category),
        dueDate: item.date,
        dueTime: item.time,
        action: item.rawCalendarEvent ? 'Attend scheduled event' : (item.actionRequired ? 'Review and take action' : undefined),
        source: item.sourceType === 'calendar' ? 'calendar' : 'gmail',
        sourceId: item.sourceId,
        sourceContext: {
          sender: item.sender,
          location: item.location,
          snippet: item.summary || item.rawEmail?.snippet,
          subject: item.title,
          calendarEventId: item.rawCalendarEvent?.id || item.rawCalendarEvent?.eventId
        },
        confidence: 1,
        tags: [],
        isArchived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      onSelectResponsibility(synthesizedResp);
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

    const renderCategoryItemSourceCell = (item: ClassifiedLifeItem) => {
      const isBoth = item.rawResponsibility?.source === 'both' ||
        (Boolean(item.rawResponsibility?.sourceContext?.calendarEventId) && Boolean(item.rawResponsibility?.sourceContext?.sender)) ||
        (item.rawResponsibility?.sources?.includes('calendar') && item.rawResponsibility?.sources?.includes('gmail'));
      const isCal = !isBoth && (item.sourceType === 'calendar' || item.rawResponsibility?.source === 'calendar');

      if (isBoth) {
        return (
          <div className="flex flex-col items-center justify-center gap-1.5 pt-0.5">
            <span 
              title="Gmail" 
              className="inline-flex items-center justify-center text-rose-500 hover:scale-110 transition-transform cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                if (item.sourceId) onSelectEmail(item.sourceId);
                else handleItemClick(item);
              }}
            >
              <Mail className="w-3.5 h-3.5" />
            </span>
            <span 
              title="Google Calendar" 
              className="inline-flex items-center justify-center text-indigo-500 hover:scale-110 transition-transform cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                handleItemClick(item);
              }}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
            </span>
          </div>
        );
      }

      if (isCal) {
        return (
          <div className="flex flex-col items-center justify-center pt-0.5">
            <span 
              title="Google Calendar" 
              className="inline-flex items-center justify-center text-indigo-500 hover:scale-110 transition-transform cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                handleItemClick(item);
              }}
            >
              <CalendarIcon className="w-4 h-4" />
            </span>
          </div>
        );
      }

      return (
        <div className="flex flex-col items-center justify-center pt-0.5">
          <span 
            title="Gmail" 
            className="inline-flex items-center justify-center text-rose-500 hover:scale-110 transition-transform cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              if (item.sourceId) onSelectEmail(item.sourceId);
              else handleItemClick(item);
            }}
          >
            <Mail className="w-4 h-4" />
          </span>
        </div>
      );
    };

    const renderStackedDate = (
      rawDateStr: string,
      dotColor?: string,
      animatePulse?: boolean,
      textColor: string = 'text-slate-800'
    ) => {
      if (!rawDateStr || rawDateStr === 'No deadline') {
        return <span className="text-slate-600 font-medium">No deadline</span>;
      }

      let datePart = rawDateStr;
      let timePart = '';

      if (rawDateStr.includes(' · ')) {
        const parts = rawDateStr.split(' · ');
        datePart = parts[0].trim();
        timePart = parts.slice(1).join(' · ').trim();
      } else if (rawDateStr.includes(' • ')) {
        const parts = rawDateStr.split(' • ');
        datePart = parts[0].trim();
        timePart = parts.slice(1).join(' • ').trim();
      }

      return (
        <div className="flex flex-col items-center justify-center text-center">
          <div className={`inline-flex items-center gap-1.5 font-medium leading-tight ${textColor}`}>
            {dotColor && (
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor} ${animatePulse ? 'animate-pulse' : ''}`} />
            )}
            <span className="whitespace-nowrap">{datePart}</span>
          </div>
          {timePart && (
            <span className="text-[11px] text-slate-600 font-normal mt-0.5 whitespace-nowrap">
              {timePart}
            </span>
          )}
        </div>
      );
    };

    const getItemActionAndDescription = (
      item: ClassifiedLifeItem, 
      sectionKey?: ResponsibilitySection
    ): { 
      actionText: string | null; 
      isInformational: boolean;
    } => {
      const resp = item.rawResponsibility;
      const cal = item.rawCalendarEvent;
      const email = item.rawEmail;

      // 1. Resolve explicit actionable next step or action required
      const rawAction = resp?.sourceContext?.nextStep || resp?.action;
      const actionClean = (rawAction || '').trim();

      const isPassiveAction = 
        !actionClean || 
        actionClean.toLowerCase() === 'none' || 
        actionClean.toLowerCase() === 'n/a' || 
        actionClean.toLowerCase().startsWith('no action') ||
        actionClean.toLowerCase().includes('no action required') ||
        actionClean.toLowerCase().includes('informational only') ||
        actionClean.toLowerCase().startsWith('fyi');

      const actionText = !isPassiveAction ? actionClean : null;

      // 2. Resolve meaningful description explaining what the event is about from actual extracted data
      let descriptionText: string | null = null;

      const candidateDesc = 
        resp?.description || 
        cal?.description || 
        item.summary || 
        resp?.sourceContext?.snippet || 
        email?.snippet || 
        email?.bodyText || 
        null;

      if (candidateDesc) {
        const clean = candidateDesc.replace(/\s+/g, ' ').trim();
        // Only use if it adds context and is not identical to the actionText or title
        if (
          clean && 
          clean.toLowerCase() !== (actionText || '').toLowerCase() &&
          clean.toLowerCase() !== item.title.toLowerCase()
        ) {
          descriptionText = clean;
        }
      }

      // Fallback for calendar events without description: explain meeting context from location
      if (!descriptionText && cal) {
        if (cal.location) {
          descriptionText = `Scheduled event at ${cal.location}`;
        } else {
          descriptionText = 'Scheduled event on your calendar';
        }
      }

      // 3. Determine if informational
      const isInformational = 
        sectionKey === 'informative' || 
        resp?.sourceContext?.classification === 'informational' || 
        resp?.sourceContext?.classification === 'program_schedule' ||
        (!actionText && Boolean(descriptionText));

      return { actionText, isInformational };
    };

    const renderSectionBlock = (
      sectionKey: ResponsibilitySection,
      sectionTitle: string,
      _badgeStyle: string,
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
          {/* Section Items Table with Deep Teal Table Header Banner matching reference design */}
          <div className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-sm">
            {/* Deep Teal Table Header Banner */}
            <div className="bg-[#34515e] px-4 sm:px-5 py-3.5 flex items-center justify-between text-white border-b border-[#2a434e]">
              <div className="flex items-center gap-2.5">
                <span className="font-bold text-sm tracking-tight text-white flex items-center gap-2">
                  {icon}
                  <span>{sectionTitle}</span>
                </span>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white/20 text-white">
                  {sectionItems.length}
                </span>
              </div>
              <p className="hidden sm:block text-xs text-slate-200/90 font-normal">{description}</p>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="border-b border-slate-200 bg-[#f0f5f8] text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    <th className="py-3 px-2 w-12 text-center font-bold" title="Source">Source</th>
                    <th className="py-3 px-4 w-[46%] text-center font-bold">Event / Responsibility</th>
                    <th className="py-3 px-4 w-[34%] text-center font-bold">Action Required</th>
                    <th className="py-3 px-4 w-[18%] text-center font-bold">Deadline / Date & Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {sectionItems.map(item => {
                    const formattedDate = item.formattedScheduleText;
                    const { actionText, isInformational } = getItemActionAndDescription(item, sectionKey);

                    const renderDateStatus = () => {
                      if (formattedDate === 'No deadline') {
                        return <span className="text-slate-600 font-medium">No deadline</span>;
                      }
                      if (sectionKey === 'passed') {
                        return renderStackedDate(formattedDate, 'bg-rose-400', false, 'text-rose-700');
                      }
                      if (sectionKey === 'yourDay') {
                        return renderStackedDate(formattedDate, 'bg-amber-500', true, 'text-amber-800');
                      }
                      if (sectionKey === 'upcoming') {
                        return renderStackedDate(formattedDate, 'bg-teal-500', false, 'text-slate-800');
                      }
                      return renderStackedDate(formattedDate, '', false, 'text-slate-800');
                    };

                    return (
                      <tr
                        key={item.id}
                        onClick={() => handleItemClick(item)}
                        className="group hover:bg-slate-50/70 transition-colors cursor-pointer"
                      >
                        {/* Column 1: Source */}
                        <td className="py-3.5 px-2 align-top text-center">
                          {renderCategoryItemSourceCell(item)}
                        </td>

                        {/* Column 2: Event / Responsibility */}
                        <td className="py-3.5 px-4 align-top text-left">
                          <div className="space-y-1">
                            <h3 className="font-semibold text-xs text-slate-900 group-hover:text-[#34515e] transition-colors leading-snug line-clamp-2">
                              <span>{item.title}</span>
                            </h3>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-600 flex-wrap">
                              {item.sender && (
                                <span className="truncate max-w-[170px]">From: {item.sender.replace(/<.*>/, '').trim()}</span>
                              )}
                              {item.location && (
                                <span className="truncate max-w-[140px]">· {item.location}</span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Column 3: Action Required */}
                        <td 
                          className="py-3.5 px-4 align-top text-left cursor-pointer" 
                          title="Click to view complete details"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleItemClick(item);
                          }}
                        >
                          {(() => {
                            const derived = deriveSpecificNextStep(item.title, actionText, isInformational);
                            if (derived.isInformational) {
                              return (
                                <div className="flex items-start gap-1.5 text-xs text-slate-500 font-medium leading-snug">
                                  <span className="line-clamp-2 italic">{derived.nextStep}</span>
                                </div>
                              );
                            }
                            return (
                              <div className="flex items-start gap-1.5 text-xs text-slate-900 font-medium leading-snug">
                                <ArrowRight className="w-3.5 h-3.5 text-[#34515e] shrink-0 mt-0.5" />
                                <span className="line-clamp-2 font-medium">{derived.nextStep}</span>
                              </div>
                            );
                          })()}
                        </td>

                        {/* Column 4: Deadline / Date & Time */}
                        <td className="py-3.5 px-4 align-top text-center">
                          <div className="text-xs leading-snug flex items-center justify-center">
                            {renderDateStatus()}
                          </div>
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
                const { actionText, isInformational } = getItemActionAndDescription(item, sectionKey);

                const renderMobileDate = () => {
                  if (formattedDate === 'No deadline') {
                    return <span className="text-slate-400">{formattedDate}</span>;
                  }
                  if (sectionKey === 'passed') {
                    return (
                      <span className="inline-flex items-center gap-1.5 text-rose-700 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                        <span>{formattedDate}</span>
                      </span>
                    );
                  }
                  if (sectionKey === 'yourDay') {
                    return (
                      <span className="inline-flex items-center gap-1.5 text-amber-800 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 animate-pulse" />
                        <span>{formattedDate}</span>
                      </span>
                    );
                  }
                  if (sectionKey === 'upcoming') {
                    return (
                      <span className="inline-flex items-center gap-1.5 text-slate-700 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                        <span>{formattedDate}</span>
                      </span>
                    );
                  }
                  return (
                    <span className="text-slate-500 font-medium">{formattedDate}</span>
                  );
                };

                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className="p-4 hover:bg-slate-50/70 transition-colors cursor-pointer space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <div className="shrink-0 pt-0.5">
                          {renderCategoryItemSourceCell(item)}
                        </div>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <h3 className="text-xs font-semibold text-slate-900 leading-snug line-clamp-2">
                            <span>{item.title}</span>
                          </h3>
                          <div className="text-[11px] text-slate-600 flex items-center gap-1.5 flex-wrap">
                            {item.sender && <span className="truncate max-w-[150px]">From: {item.sender.replace(/<.*>/, '').trim()}</span>}
                          </div>
                        </div>
                      </div>
                      
                    </div>

                    {(() => {
                      const derived = deriveSpecificNextStep(item.title, actionText, isInformational);
                      if (derived.isInformational) {
                        return (
                          <div className="text-xs text-slate-500 font-medium flex items-start gap-1.5 pl-6.5">
                            <span className="line-clamp-2 italic">{derived.nextStep}</span>
                          </div>
                        );
                      }
                      return (
                        <div className="text-xs text-slate-900 font-medium flex items-start gap-1.5 pl-6.5">
                          <ArrowRight className="w-3.5 h-3.5 text-[#34515e] shrink-0 mt-0.5" />
                          <span className="line-clamp-2 font-medium">{derived.nextStep}</span>
                        </div>
                      );
                    })()}

                    {/* Deadline in Mobile View */}
                    <div className="text-xs pl-6.5 pt-0.5">
                      {renderMobileDate()}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-500">Category:</span>
                        <select
                          value={item.category}
                          onChange={(e) => handleCategoryChange(item, e.target.value as LifeCategoryId)}
                          className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-xs text-slate-700 cursor-pointer shadow-2xs hover:border-slate-300"
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
                        className="text-xs font-semibold text-[#34515e] hover:text-[#283e48] flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <span>View Details</span>
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
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 shadow-xs">
              {categorySectionCounts.total}
            </span>
          </div>
        </div>

        {/* Section Indicators - Clean 4-card overview matching reference design */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          {/* 1. Your Day */}
          <button
            type="button"
            onClick={() => scrollToSection('section-your-day')}
            className="p-4 rounded-2xl border border-slate-200/90 bg-white hover:border-[#34515e]/50 hover:shadow-sm text-left flex items-center justify-between gap-3 transition-all cursor-pointer shadow-xs"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-[#e2edf2] text-[#34515e] border border-[#d2e5ed] flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 tracking-wide truncate">YOUR DAY</div>
                <div className="text-[11px] text-slate-500 truncate">Due today</div>
              </div>
            </div>
            <span className="text-base font-bold text-slate-900 px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-200 shrink-0">
              {categorySectionCounts.yourDay}
            </span>
          </button>

          {/* 2. Upcoming */}
          <button
            type="button"
            onClick={() => scrollToSection('section-upcoming')}
            className="p-4 rounded-2xl border border-slate-200/90 bg-white hover:border-[#34515e]/50 hover:shadow-sm text-left flex items-center justify-between gap-3 transition-all cursor-pointer shadow-xs"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-[#e2edf2] text-[#34515e] border border-[#d2e5ed] flex items-center justify-center shrink-0">
                <CalendarIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 tracking-wide truncate">UPCOMING</div>
                <div className="text-[11px] text-slate-500 truncate">Tomorrow & future</div>
              </div>
            </div>
            <span className="text-base font-bold text-slate-900 px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-200 shrink-0">
              {categorySectionCounts.upcoming}
            </span>
          </button>

          {/* 3. Passed */}
          <button
            type="button"
            onClick={() => scrollToSection('section-passed')}
            className="p-4 rounded-2xl border border-slate-200/90 bg-white hover:border-[#34515e]/50 hover:shadow-sm text-left flex items-center justify-between gap-3 transition-all cursor-pointer shadow-xs"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-[#e2edf2] text-[#34515e] border border-[#d2e5ed] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 tracking-wide truncate">PASSED</div>
                <div className="text-[11px] text-slate-500 truncate">Past deadlines</div>
              </div>
            </div>
            <span className="text-base font-bold text-slate-900 px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-200 shrink-0">
              {categorySectionCounts.passed}
            </span>
          </button>

          {/* 4. Informative */}
          <button
            type="button"
            onClick={() => scrollToSection('section-informative')}
            className="p-4 rounded-2xl border border-slate-200/90 bg-white hover:border-[#34515e]/50 hover:shadow-sm text-left flex items-center justify-between gap-3 transition-all cursor-pointer shadow-xs"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-[#e2edf2] text-[#34515e] border border-[#d2e5ed] flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 tracking-wide truncate">INFORMATIVE</div>
                <div className="text-[11px] text-slate-500 truncate">No action needed</div>
              </div>
            </div>
            <span className="text-base font-bold text-slate-900 px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-200 shrink-0">
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
          LifeSynch AI continuously understands your academic, career, and personal digital life across Gmail and Google Calendar.
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
        {isLoading && tasks.length === 0 && emails.length === 0 && calendarEvents.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(idx => (
              <div
                key={idx}
                className="p-5 rounded-2xl border border-slate-200/90 bg-white shadow-xs space-y-4 animate-pulse"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-full bg-slate-100" />
                    <div className="w-16 h-5 rounded-full bg-slate-100" />
                  </div>
                  <div className="space-y-2 pt-1">
                    <div className="w-28 h-5 rounded-md bg-slate-100" />
                    <div className="w-full h-8 rounded-md bg-slate-50" />
                  </div>
                </div>
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
                  <div className="w-24 h-3.5 rounded bg-slate-100" />
                  <div className="w-4 h-4 rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(['academic', 'career', 'personal', 'finance'] as LifeCategoryId[]).map(catId => {
              const meta = LIFE_CATEGORIES[catId];
              const count = counts[catId] || 0;

              return (
                <div
                  key={catId}
                  onClick={() => setActiveCategory(catId)}
                  className="p-5 rounded-2xl border border-slate-200/90 bg-white hover:border-[#34515e]/50 hover:shadow-md transition-all duration-200 cursor-pointer group flex flex-col justify-between space-y-4 hover:-translate-y-0.5 shadow-xs"
                >
                  <div className="space-y-3">
                    {/* Icon & Count matching reference circular badges */}
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-full bg-[#e2edf2] text-[#34515e] border border-[#d0e2ec] flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                        {renderCategoryIcon(meta.id, 'w-5 h-5')}
                      </div>
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        {count}
                      </span>
                    </div>

                    {/* Title & Description */}
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#34515e] transition-colors">
                        {meta.name}
                      </h3>
                      <p className="text-xs text-slate-500 leading-relaxed mt-1 line-clamp-2">
                        {meta.shortDescription}
                      </p>
                    </div>
                  </div>

                  {/* Footer Link */}
                  <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-500 group-hover:text-[#34515e] transition-colors">
                    <span>Explore category</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* General & Other Row Card */}
        <div
          onClick={() => setActiveCategory('general')}
          className="p-4 rounded-2xl border border-slate-200/90 bg-white hover:border-[#34515e]/50 hover:shadow-md transition-all cursor-pointer group flex items-center justify-between gap-4 shadow-xs"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-[#e2edf2] text-[#34515e] border border-[#d0e2ec] flex items-center justify-center shrink-0 shadow-2xs">
              <Compass className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-slate-900 group-hover:text-[#34515e] transition-colors">
                General & Other
              </h4>
              <p className="text-xs text-slate-500 truncate">
                Club communications, newsletters, community updates, and items pending specific categorization.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 text-xs font-semibold text-slate-500 group-hover:text-[#34515e] shrink-0">
            <span>View all</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </section>

      {/* ================= 4. WORTH KNOWING – INTELLIGENT DISCOVERIES ================= */}
      {isLoading && tasks.length === 0 && emails.length === 0 && calendarEvents.length === 0 ? (
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Worth Knowing
            </h2>
            <p className="text-xs text-slate-500">
              Genuinely useful opportunities, programs, and updates surfaced by AI.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2].map(idx => (
              <div
                key={idx}
                className="p-4 rounded-2xl border border-slate-200/90 bg-white shadow-xs space-y-3 animate-pulse"
              >
                <div className="flex items-center justify-between">
                  <div className="w-20 h-5 rounded-lg bg-slate-100" />
                  <div className="w-14 h-4 rounded bg-slate-100" />
                </div>
                <div className="space-y-1.5">
                  <div className="w-3/4 h-5 rounded bg-slate-100" />
                  <div className="w-full h-8 rounded bg-slate-50" />
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <div className="w-20 h-3.5 rounded bg-slate-100" />
                  <div className="w-4 h-4 rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : worthKnowing.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Worth Knowing
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
                  className="p-4 rounded-2xl border border-slate-200/90 bg-white hover:border-[#34515e]/50 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between space-y-3 shadow-xs"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-lg border border-[#c2dde6] bg-[#e2edf2] text-[#34515e] uppercase tracking-wider">
                          {meta.name.split(' ')[0]}
                        </span>
                        {wk.badgeLabel && !wk.badgeLabel.toLowerCase().includes('connected') && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 uppercase tracking-wider">
                            {wk.badgeLabel}
                          </span>
                        )}
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
                            className="text-xs font-semibold text-slate-600 hover:text-[#34515e] transition-colors cursor-pointer"
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
                            className="text-xs font-semibold text-slate-600 hover:text-[#34515e] transition-colors cursor-pointer"
                            title="Gmail"
                          >
                            Gmail
                          </button>
                        )}
                      </div>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#34515e] transition-colors line-clamp-2 leading-snug">
                      {wk.title}
                    </h3>

                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                      {wk.explanation}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 group-hover:text-[#34515e] font-semibold transition-colors">
                    <span className="text-xs text-slate-400 group-hover:text-[#34515e]">
                      View details
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* ================= 5. LIFESYNCH AI ENTRY POINT ================= */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#e2edf2] border border-[#c2dde6] flex items-center justify-center text-[#34515e]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                Ask LifeSynch AI
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
              className="px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 hover:border-[#34515e]/40 hover:bg-[#e2edf2]/60 text-xs text-slate-700 hover:text-[#34515e] font-medium transition-all text-left cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <HelpCircle className="w-3 h-3 text-[#34515e] shrink-0" />
              <span>{q}</span>
            </button>
          ))}
        </div>

        {/* Quick Inquiry Bar with blue gradient button */}
        <form onSubmit={handleInquirySubmit} className="relative pt-1">
          <input
            type="text"
            value={customInquiry}
            onChange={(e) => setCustomInquiry(e.target.value)}
            placeholder="Ask anything about your courses, placements, deadlines, or schedule..."
            className="w-full pl-4 pr-24 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#34515e] focus:bg-white transition-all shadow-inner"
          />
          <button
            type="submit"
            disabled={!customInquiry.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-500 hover:to-blue-600 disabled:opacity-40 text-white font-bold text-xs transition-all flex items-center gap-1 cursor-pointer shadow-xs"
          >
            <span>Ask</span>
            <Send className="w-3 h-3" />
          </button>
        </form>
      </section>

      {/* ================= WORTH KNOWING DETAIL MODAL ================= */}
      {selectedDiscovery && (
        <WorthKnowingDetailModal
          discovery={selectedDiscovery}
          tasks={tasks}
          onClose={() => setSelectedDiscovery(null)}
          onOpenEmail={(emailId: string) => {
            setSelectedDiscovery(null);
            onSelectEmail(emailId);
          }}
          onOpenCalendar={(eventId: string) => {
            setSelectedDiscovery(null);
            if (onSelectCalendarEvent) {
              onSelectCalendarEvent(eventId);
            }
          }}
        />
      )}

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
                className="px-4 py-2 rounded-xl bg-[#34515e] hover:bg-[#283e48] text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
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
