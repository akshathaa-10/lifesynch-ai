import React, { useState } from 'react';
import { 
  Search, 
  X, 
  Calendar as CalendarIcon, 
  Mail, 
  CheckSquare, 
  Clock, 
  MapPin, 
  Tag, 
  ArrowLeft,
  ExternalLink,
  ChevronRight,
  Filter
} from 'lucide-react';
import { Responsibility, CalendarEventRecord } from '@lifesynch/shared';
import { GlobalSearchResults } from '../../services/globalSearchService';

interface GlobalSearchResultsViewProps {
  searchQuery: string;
  searchResults: GlobalSearchResults;
  onSearchChange: (query: string) => void;
  onClearSearch: () => void;
  onBackToDashboard: () => void;
  onSelectResponsibility: (task: Responsibility) => void;
  onSelectEmail: (emailId: string) => void;
  onSelectCalendarEvent: (event: CalendarEventRecord) => void;
}

type TabFilter = 'all' | 'responsibilities' | 'calendar' | 'emails';

export const GlobalSearchResultsView: React.FC<GlobalSearchResultsViewProps> = ({
  searchQuery,
  searchResults,
  onSearchChange,
  onClearSearch,
  onBackToDashboard,
  onSelectResponsibility,
  onSelectEmail,
  onSelectCalendarEvent
}) => {
  const [activeFilter, setActiveFilter] = useState<TabFilter>('all');

  const { responsibilities, calendarEvents, emails, totalCount } = searchResults;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const formatCalendarTime = (startStr?: string, endStr?: string) => {
    if (!startStr) return { date: 'Date not set', time: '' };
    try {
      const start = new Date(startStr);
      if (isNaN(start.getTime())) return { date: startStr, time: '' };
      const dateText = start.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
      const timeText = start.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      if (endStr) {
        const end = new Date(endStr);
        if (!isNaN(end.getTime())) {
          const endTime = end.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });
          return { date: dateText, time: `${timeText} – ${endTime}` };
        }
      }
      return { date: dateText, time: timeText };
    } catch {
      return { date: startStr, time: '' };
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status?.toUpperCase()) {
      case 'DUE_TODAY':
      case 'TODAY':
        return <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold text-xs border border-amber-200">Your Day</span>;
      case 'OVERDUE':
      case 'PASSED':
        return <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-semibold text-xs border border-rose-200">Passed</span>;
      case 'COMPLETED':
        return <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold text-xs border border-emerald-200">Completed</span>;
      case 'INFORMATIVE':
        return <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 font-semibold text-xs border border-purple-200">Informative</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 font-semibold text-xs border border-sky-200">Upcoming</span>;
    }
  };

  const getCategoryColor = (cat?: string) => {
    switch (cat?.toLowerCase()) {
      case 'academic':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'career':
      case 'work':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'personal':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'finance':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Top Bar with Back Button and Quick Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-sm p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToDashboard}
            className="p-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
            title="Return to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </button>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Global Search Results
            </h1>
            <p className="text-xs text-slate-500">
              {totalCount > 0 ? (
                <>Found <span className="font-semibold text-[#34515e]">{totalCount}</span> matching records across your connected data</>
              ) : (
                <>No matches found for &ldquo;{searchQuery}&rdquo;</>
              )}
            </p>
          </div>
        </div>

        {/* In-page Search Box */}
        <div className="relative flex-1 sm:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Refine search query..."
            className="w-full pl-10 pr-10 py-2 rounded-2xl bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-[#34515e] focus:ring-2 focus:ring-[#34515e]/15 text-xs sm:text-sm text-slate-800 placeholder-slate-400 outline-none transition-all shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={onClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/60 transition-colors"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 select-none">
        <button
          onClick={() => setActiveFilter('all')}
          className={`px-4 py-2 rounded-2xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeFilter === 'all'
              ? 'bg-[#34515e] text-white shadow-sm'
              : 'bg-white/80 hover:bg-white text-slate-600 border border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          <span>All Results</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
            activeFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            {totalCount}
          </span>
        </button>

        <button
          onClick={() => setActiveFilter('responsibilities')}
          className={`px-4 py-2 rounded-2xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeFilter === 'responsibilities'
              ? 'bg-[#34515e] text-white shadow-sm'
              : 'bg-white/80 hover:bg-white text-slate-600 border border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <CheckSquare className="w-3.5 h-3.5 text-sky-500" />
          <span>Responsibilities</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
            activeFilter === 'responsibilities' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            {responsibilities.length}
          </span>
        </button>

        <button
          onClick={() => setActiveFilter('calendar')}
          className={`px-4 py-2 rounded-2xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeFilter === 'calendar'
              ? 'bg-[#34515e] text-white shadow-sm'
              : 'bg-white/80 hover:bg-white text-slate-600 border border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <CalendarIcon className="w-3.5 h-3.5 text-indigo-500" />
          <span>Calendar Events</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
            activeFilter === 'calendar' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            {calendarEvents.length}
          </span>
        </button>

        <button
          onClick={() => setActiveFilter('emails')}
          className={`px-4 py-2 rounded-2xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeFilter === 'emails'
              ? 'bg-[#34515e] text-white shadow-sm'
              : 'bg-white/80 hover:bg-white text-slate-600 border border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <Mail className="w-3.5 h-3.5 text-rose-500" />
          <span>Emails</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
            activeFilter === 'emails' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            {emails.length}
          </span>
        </button>
      </div>

      {/* Empty State */}
      {totalCount === 0 && (
        <div className="text-center py-16 px-6 bg-white/80 backdrop-blur-sm rounded-3xl border border-dashed border-slate-300 space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Search className="w-6 h-6" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-base font-bold text-slate-800">
              No results found for &ldquo;{searchQuery}&rdquo;
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              We checked your connected Responsibilities, Google Calendar events, and Gmail inbox. Try searching with different keywords, check for typos, or browse your categories directly.
            </p>
          </div>
          <div className="pt-2 flex items-center justify-center gap-3">
            {searchQuery && (
              <button
                onClick={onClearSearch}
                className="px-4 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                Clear Search
              </button>
            )}
            <button
              onClick={onBackToDashboard}
              className="px-4 py-2 rounded-2xl bg-[#34515e] hover:bg-[#283e48] text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* ================= 1. Responsibilities Section ================= */}
      {(activeFilter === 'all' || activeFilter === 'responsibilities') && responsibilities.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                <CheckSquare className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Responsibilities & Tasks ({responsibilities.length})
              </h2>
            </div>
            {activeFilter === 'all' && responsibilities.length > 3 && (
              <button
                onClick={() => setActiveFilter('responsibilities')}
                className="text-xs text-[#34515e] hover:underline font-semibold cursor-pointer"
              >
                View all {responsibilities.length} →
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {(activeFilter === 'all' ? responsibilities.slice(0, 5) : responsibilities).map(({ item }) => (
              <div
                key={item.id}
                onClick={() => onSelectResponsibility(item)}
                className="group p-4 bg-white hover:bg-[#fbfcfe] rounded-2xl border border-slate-200/80 hover:border-[#34515e]/40 transition-all shadow-xs hover:shadow-sm cursor-pointer flex items-start justify-between gap-4"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {getStatusBadge(item.status)}
                    {item.category && (
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border capitalize flex items-center gap-1 ${getCategoryColor(item.category)}`}>
                        <Tag className="w-3 h-3" />
                        {item.category}
                      </span>
                    )}
                    {item.dueDate && (
                      <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1 ml-auto sm:ml-0">
                        <Clock className="w-3 h-3 text-slate-400" />
                        Due {formatDate(item.dueDate)} {item.dueTime ? `at ${item.dueTime}` : ''}
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#34515e] transition-colors line-clamp-2">
                    {item.title}
                  </h3>

                  {item.action && (
                    <p className="text-xs text-slate-600 line-clamp-1">
                      <span className="font-semibold text-slate-700">Action:</span> {item.action}
                    </p>
                  )}

                  {item.description && !item.action && (
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>

                <div className="shrink-0 self-center">
                  <span className="w-8 h-8 rounded-xl bg-slate-50 group-hover:bg-[#e2edf2] text-slate-400 group-hover:text-[#34515e] flex items-center justify-center transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= 2. Calendar Events Section ================= */}
      {(activeFilter === 'all' || activeFilter === 'calendar') && calendarEvents.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <CalendarIcon className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Calendar Events ({calendarEvents.length})
              </h2>
            </div>
            {activeFilter === 'all' && calendarEvents.length > 3 && (
              <button
                onClick={() => setActiveFilter('calendar')}
                className="text-xs text-[#34515e] hover:underline font-semibold cursor-pointer"
              >
                View all {calendarEvents.length} →
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {(activeFilter === 'all' ? calendarEvents.slice(0, 5) : calendarEvents).map(({ item }) => {
              const { date, time } = formatCalendarTime(item.startTime, item.endTime);
              return (
                <div
                  key={item.id}
                  onClick={() => onSelectCalendarEvent(item)}
                  className="group p-4 bg-white hover:bg-[#fbfcfe] rounded-2xl border border-slate-200/80 hover:border-indigo-400/50 transition-all shadow-xs hover:shadow-sm cursor-pointer flex items-start justify-between gap-4"
                >
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-600">
                      <span className="flex items-center gap-1 font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                        <CalendarIcon className="w-3 h-3 text-indigo-500" />
                        {date}
                      </span>
                      {time && (
                        <span className="flex items-center gap-1 text-slate-500">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {time}
                        </span>
                      )}
                      {item.location && (
                        <span className="flex items-center gap-1 text-slate-500 truncate max-w-xs">
                          <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                          {item.location}
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-900 transition-colors line-clamp-1">
                      {item.summary || '(Untitled Event)'}
                    </h3>

                    {item.description && (
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 flex items-center gap-2 self-center">
                    {item.htmlLink && (
                      <a
                        href={item.htmlLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-indigo-600 transition-colors"
                        title="Open in Google Calendar"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    <span className="w-8 h-8 rounded-xl bg-slate-50 group-hover:bg-indigo-50 text-slate-400 group-hover:text-indigo-600 flex items-center justify-center transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= 3. Emails Section ================= */}
      {(activeFilter === 'all' || activeFilter === 'emails') && emails.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                <Mail className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Gmail Messages ({emails.length})
              </h2>
            </div>
            {activeFilter === 'all' && emails.length > 3 && (
              <button
                onClick={() => setActiveFilter('emails')}
                className="text-xs text-[#34515e] hover:underline font-semibold cursor-pointer"
              >
                View all {emails.length} →
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {(activeFilter === 'all' ? emails.slice(0, 5) : emails).map(({ item }) => (
              <div
                key={item.id}
                onClick={() => onSelectEmail(item.id)}
                className="group p-4 bg-white hover:bg-[#fbfcfe] rounded-2xl border border-slate-200/80 hover:border-rose-400/50 transition-all shadow-xs hover:shadow-sm cursor-pointer flex items-start justify-between gap-4"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-700 truncate max-w-sm">
                      {item.sender || 'Unknown Sender'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {formatDate(item.receivedAt || item.createdAt)}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-rose-900 transition-colors line-clamp-1">
                    {item.subject || '(No Subject)'}
                  </h3>

                  {item.snippet && (
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {item.snippet}
                    </p>
                  )}
                </div>

                <div className="shrink-0 self-center">
                  <span className="w-8 h-8 rounded-xl bg-slate-50 group-hover:bg-rose-50 text-slate-400 group-hover:text-rose-600 flex items-center justify-center transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
