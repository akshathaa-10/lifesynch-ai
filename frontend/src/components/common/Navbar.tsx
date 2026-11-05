import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  LogOut, 
  Bell, 
  Check, 
  Clock, 
  CheckCircle2,
  CheckCheck,
  Search,
  X,
  Calendar as CalendarIcon,
  Mail,
  CheckSquare,
  ChevronRight
} from 'lucide-react';
import { User, ReminderNotification, Responsibility, CalendarEventRecord, EmailRecord } from '@lifesynch/shared';
import { performGlobalSearch } from '../../services/globalSearchService';

interface NavbarProps {
  user: User | null;
  onLogout: () => void;
  backendConnected?: boolean | null;
  onRefreshHealth?: () => void;
  isCheckingHealth?: boolean;
  reminders?: ReminderNotification[];
  onMarkReminderAsRead?: (id: string) => void;
  onMarkAllRemindersAsRead?: () => void;
  onNavigateToTab?: (tab: string) => void;
  isSyncing?: boolean;
  onTriggerSync?: () => void;
  syncError?: string | null;
  
  // Global Search integration
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  tasks?: Responsibility[];
  calendarEvents?: CalendarEventRecord[];
  emails?: EmailRecord[];
  onSelectResponsibility?: (task: Responsibility) => void;
  onSelectCalendarEvent?: (event: CalendarEventRecord) => void;
  onSelectEmail?: (emailId: string) => void;
  onSubmitSearch?: (query: string) => void;
  onClearSearch?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  user, 
  onLogout,
  backendConnected,
  reminders = [],
  onMarkReminderAsRead,
  onMarkAllRemindersAsRead,
  onNavigateToTab,
  syncError,
  searchQuery = '',
  onSearchQueryChange,
  tasks = [],
  calendarEvents = [],
  emails = [],
  onSelectResponsibility,
  onSelectCalendarEvent,
  onSelectEmail,
  onSubmitSearch,
  onClearSearch
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close notifications or search dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (notificationsRef.current && !notificationsRef.current.contains(target)) {
        setShowNotifications(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(target)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Exclude already-passed deadlines and overdue notifications
  const activeReminders = useMemo(() => {
    const nowMs = Date.now();
    return reminders.filter(r => {
      if (r.title.startsWith('Overdue:') || r.message.toLowerCase().includes('is now overdue')) {
        return false;
      }
      if (r.dueDate) {
        const d = new Date(r.dueDate);
        if (!isNaN(d.getTime())) {
          if (!r.dueDate.includes('T') || r.dueTime) {
            const parts = r.dueDate.split('T')[0].split('-');
            if (parts.length === 3) {
              const [y, m, day] = parts.map(Number);
              let hh = 23, mm = 59;
              if (r.dueTime && /^\d{1,2}:\d{2}$/.test(r.dueTime.trim())) {
                [hh, mm] = r.dueTime.trim().split(':').map(Number);
              }
              const localEnd = new Date(y, m - 1, day, hh, mm, 59).getTime();
              if (localEnd < nowMs) return false;
            }
          } else if (d.getTime() < nowMs) {
            return false;
          }
        }
      }
      return true;
    });
  }, [reminders]);

  const unreadReminders = activeReminders.filter(r => !r.isRead);
  const unreadCount = unreadReminders.length;
  const [notificationFilter, setNotificationFilter] = useState<'all' | 'deadlines' | 'calendar' | 'updates'>('all');
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>(() => {
    return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default';
  });

  const requestBrowserPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setBrowserPermission(perm);
      } catch (err) {
        console.warn('Failed to request notification permission:', err);
      }
    }
  };

  const formatNotificationTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
      if (isToday) return `Today, ${timeStr}`;
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${timeStr}`;
      return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
    } catch {
      return dateStr;
    }
  };

  const filteredReminders = useMemo(() => {
    if (notificationFilter === 'deadlines') {
      return activeReminders.filter(r => r.category === 'deadline' || r.type === 'responsibility' || r.title.toLowerCase().includes('reminder'));
    }
    if (notificationFilter === 'calendar') {
      return activeReminders.filter(r => r.category === 'calendar' || r.title.toLowerCase().includes('calendar') || r.title.toLowerCase().includes('event:'));
    }
    if (notificationFilter === 'updates') {
      return activeReminders.filter(r => r.category === 'email' || r.type === 'info');
    }
    return activeReminders;
  }, [activeReminders, notificationFilter]);

  const handleNotificationClick = (r: ReminderNotification) => {
    if (!r.isRead && onMarkReminderAsRead) {
      onMarkReminderAsRead(r.id);
    }
    setShowNotifications(false);

    if (r.category === 'calendar' || r.title.toLowerCase().includes('event:') || r.title.toLowerCase().includes('calendar')) {
      const targetEventId = r.targetId;
      const matchedEvent = calendarEvents.find(c => c.id === targetEventId || c.eventId === targetEventId || (c.summary && r.title.includes(c.summary)));
      if (matchedEvent && onSelectCalendarEvent) {
        onSelectCalendarEvent(matchedEvent);
        return;
      }
      onNavigateToTab?.('calendar');
      return;
    }

    if (r.category === 'email' || r.title.toLowerCase().includes('email')) {
      const targetEmailId = r.targetId;
      const matchedEmail = emails.find(e => e.id === targetEmailId || e.messageId === targetEmailId);
      if (matchedEmail && onSelectEmail) {
        onSelectEmail(matchedEmail.id);
        return;
      }
      onNavigateToTab?.('gmail');
      return;
    }

    const targetTaskId = r.responsibilityId || r.targetId;
    const cleanTitle = r.title.replace(/^(reminder|overdue|urgent|new responsibility):\s*/i, '').toLowerCase().trim();
    const matchedTask = tasks.find(t => t.id === targetTaskId || t.title.toLowerCase().trim() === cleanTitle || t.title.toLowerCase().includes(cleanTitle));
    if (matchedTask && onSelectResponsibility) {
      onSelectResponsibility(matchedTask);
      return;
    }

    onNavigateToTab?.('tasks');
  };


  const getInitials = (name?: string, email?: string) => {
    if (name) {
      const parts = name.trim().split(' ');
      return parts.length > 1
        ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
        : name.slice(0, 2).toUpperCase();
    }
    return email ? email.slice(0, 2).toUpperCase() : 'LS';
  };

  // Perform search across connected datasets
  const searchResults = useMemo(() => {
    if (!searchQuery || !searchQuery.trim()) {
      return null;
    }
    return performGlobalSearch(tasks, calendarEvents, emails, searchQuery);
  }, [tasks, calendarEvents, emails, searchQuery]);

  const showDropdown = isSearchFocused && Boolean(searchQuery && searchQuery.trim());

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (searchQuery.trim()) {
        setIsSearchFocused(false);
        onSubmitSearch?.(searchQuery.trim());
      }
    } else if (e.key === 'Escape') {
      setIsSearchFocused(false);
      searchInputRef.current?.blur();
    }
  };

  const handleItemClick = (action: () => void) => {
    setIsSearchFocused(false);
    action();
  };

  const formatShortDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <header className="h-16 bg-[#34515e] border-b border-[#283e48] px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40 select-none shadow-sm">
      {/* Brand & Wordmark matching deep teal header */}
      <div className="flex items-center gap-3">
        <div 
          onClick={() => onNavigateToTab?.('dashboard')}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white border border-white/15 group-hover:scale-105 transition-transform">
            <Sparkles className="w-4 h-4 text-sky-300" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold tracking-tight text-white text-base leading-none">
              LifeSynch
            </span>
            <span className="text-[10px] text-slate-300 font-medium tracking-wide mt-0.5">
              Personal Intelligence
            </span>
          </div>
        </div>
      </div>

      {/* Right Controls: Global Search Bar, Notifications, Ask Assistant, User */}
      <div className="flex items-center gap-2.5 sm:gap-3.5">
        
        {/* Global Search Container with Live Results Dropdown */}
        <div className="relative" ref={searchContainerRef}>
          <div className="flex items-center gap-2 bg-white/95 hover:bg-white text-slate-700 px-3 py-1.5 rounded-full text-xs shadow-xs transition-all w-52 sm:w-64 lg:w-80 border border-transparent focus-within:border-sky-300 focus-within:ring-2 focus-within:ring-sky-200/50">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange?.(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onKeyDown={handleKeyDown}
              placeholder="Search emails, calendar, tasks..."
              className="bg-transparent border-none outline-none text-xs text-slate-800 placeholder-slate-400 w-full"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClearSearch ? onClearSearch() : onSearchQueryChange?.('');
                  searchInputRef.current?.focus();
                }}
                className="text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200/50 transition-colors cursor-pointer shrink-0"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </div>

          {/* Live Search Results Dropdown */}
          {showDropdown && searchResults && (
            <div className="absolute right-0 mt-2 w-84 sm:w-96 lg:w-[460px] rounded-3xl bg-white border border-slate-200 shadow-2xl p-3.5 z-50 text-xs space-y-3 max-h-[80vh] overflow-y-auto animate-fadeIn">
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5 text-xs">
                  <Search className="w-3.5 h-3.5 text-[#34515e]" />
                  Search Results
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  {searchResults.totalCount} {searchResults.totalCount === 1 ? 'match' : 'matches'}
                </span>
              </div>

              {/* Empty state inside dropdown */}
              {searchResults.totalCount === 0 ? (
                <div className="py-8 text-center text-slate-500 space-y-1">
                  <Search className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold text-slate-700 text-xs">No results found</p>
                  <p className="text-[11px] text-slate-400">
                    No matching records found for &ldquo;{searchQuery}&rdquo;
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Group 1: Responsibilities */}
                  {searchResults.responsibilities.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider px-1">
                        <span className="flex items-center gap-1.5 text-sky-700">
                          <CheckSquare className="w-3 h-3 text-sky-600" />
                          Responsibilities ({searchResults.responsibilities.length})
                        </span>
                      </div>
                      <div className="space-y-1">
                        {searchResults.responsibilities.slice(0, 3).map(({ item }) => (
                          <div
                            key={item.id}
                            onClick={() => handleItemClick(() => onSelectResponsibility?.(item))}
                            className="p-2.5 rounded-2xl hover:bg-slate-50 border border-slate-100 hover:border-slate-200 transition-all cursor-pointer flex items-start justify-between gap-2.5 group"
                          >
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-1.5">
                                {item.category && (
                                  <span className="px-2 py-0.2 rounded-full text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-100 capitalize">
                                    {item.category}
                                  </span>
                                )}
                                {item.dueDate && (
                                  <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                                    <Clock className="w-2.5 h-2.5" />
                                    {formatShortDate(item.dueDate)}
                                  </span>
                                )}
                              </div>
                              <p className="font-semibold text-slate-900 group-hover:text-[#34515e] transition-colors truncate text-xs">
                                {item.title}
                              </p>
                              {item.action && (
                                <p className="text-[11px] text-slate-500 truncate">
                                  {item.action}
                                </p>
                              )}
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#34515e] shrink-0 self-center" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Group 2: Calendar Events */}
                  {searchResults.calendarEvents.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider px-1">
                        <span className="flex items-center gap-1.5 text-indigo-700">
                          <CalendarIcon className="w-3 h-3 text-indigo-600" />
                          Calendar Events ({searchResults.calendarEvents.length})
                        </span>
                      </div>
                      <div className="space-y-1">
                        {searchResults.calendarEvents.slice(0, 3).map(({ item }) => (
                          <div
                            key={item.id}
                            onClick={() => handleItemClick(() => onSelectCalendarEvent?.(item))}
                            className="p-2.5 rounded-2xl hover:bg-slate-50 border border-slate-100 hover:border-slate-200 transition-all cursor-pointer flex items-start justify-between gap-2.5 group"
                          >
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-1.5 text-[10px] text-indigo-700 font-semibold">
                                <span className="bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-100">
                                  {formatShortDate(item.startTime)}
                                </span>
                                {item.location && (
                                  <span className="text-slate-400 truncate max-w-[140px]">
                                    {item.location}
                                  </span>
                                )}
                              </div>
                              <p className="font-semibold text-slate-900 group-hover:text-indigo-900 transition-colors truncate text-xs">
                                {item.summary || '(Untitled Event)'}
                              </p>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-600 shrink-0 self-center" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Group 3: Emails */}
                  {searchResults.emails.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider px-1">
                        <span className="flex items-center gap-1.5 text-rose-700">
                          <Mail className="w-3 h-3 text-rose-600" />
                          Emails ({searchResults.emails.length})
                        </span>
                      </div>
                      <div className="space-y-1">
                        {searchResults.emails.slice(0, 3).map(({ item }) => (
                          <div
                            key={item.id}
                            onClick={() => handleItemClick(() => onSelectEmail?.(item.id))}
                            className="p-2.5 rounded-2xl hover:bg-slate-50 border border-slate-100 hover:border-slate-200 transition-all cursor-pointer flex items-start justify-between gap-2.5 group"
                          >
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400">
                                <span className="font-semibold text-slate-700 truncate max-w-[200px]">
                                  {item.sender || 'Unknown'}
                                </span>
                                <span>{formatShortDate(item.receivedAt || item.createdAt)}</span>
                              </div>
                              <p className="font-semibold text-slate-900 group-hover:text-rose-900 transition-colors truncate text-xs">
                                {item.subject || '(No Subject)'}
                              </p>
                              {item.snippet && (
                                <p className="text-[11px] text-slate-500 truncate">
                                  {item.snippet}
                                </p>
                              )}
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-rose-600 shrink-0 self-center" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* View All Button / Enter prompt */}
                  <div className="pt-2 border-t border-slate-100 text-center">
                    <button
                      onClick={() => {
                        setIsSearchFocused(false);
                        onSubmitSearch?.(searchQuery.trim());
                      }}
                      className="w-full py-2 px-3 rounded-2xl bg-slate-50 hover:bg-[#e2edf2] text-[#34515e] font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>View all {searchResults.totalCount} results</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Connection Error Indicator (shown only if backend is unreachable) */}
        {backendConnected === false || Boolean(syncError) ? (
          <div 
            title={syncError || 'Backend unreachable. Synchronization paused.'}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-300/30 text-xs text-rose-200 font-medium"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            <span>Sync Paused</span>
          </div>
        ) : null}

        {/* Notifications Bell with popover matching reference header */}
        <div className="relative" ref={notificationsRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className={`p-2 rounded-xl transition-colors relative cursor-pointer ${
              showNotifications 
                ? 'bg-white/20 text-white' 
                : 'text-white/85 hover:text-white hover:bg-white/10'
            }`}
            title="Notifications & Deadline Reminders"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center leading-none shadow-sm">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Clean, Feature-Rich Notification Panel */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-84 sm:w-[420px] rounded-3xl bg-white border border-slate-200/90 shadow-2xl p-4 z-50 text-xs space-y-3 animate-fadeIn">
              {/* Header */}
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-800 flex items-center gap-2">
                    <Bell className="w-4 h-4 text-[#34515e]" />
                    <span>Notifications</span>
                  </span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500 text-white">
                      {unreadCount} unread
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {unreadCount > 0 && onMarkAllRemindersAsRead && (
                    <button
                      onClick={onMarkAllRemindersAsRead}
                      className="text-[11px] text-[#34515e] hover:text-slate-900 font-semibold flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                      title="Mark all as read"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Mark all read</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Category Filter Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-[11px] font-medium text-slate-600">
                <button
                  onClick={() => setNotificationFilter('all')}
                  className={`flex-1 py-1 px-2 rounded-lg text-center transition-all cursor-pointer ${
                    notificationFilter === 'all' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'hover:text-slate-900'
                  }`}
                >
                  All ({activeReminders.length})
                </button>
                <button
                  onClick={() => setNotificationFilter('deadlines')}
                  className={`flex-1 py-1 px-2 rounded-lg text-center transition-all cursor-pointer ${
                    notificationFilter === 'deadlines' ? 'bg-white text-amber-900 font-bold shadow-xs' : 'hover:text-slate-900'
                  }`}
                >
                  Deadlines
                </button>
                <button
                  onClick={() => setNotificationFilter('calendar')}
                  className={`flex-1 py-1 px-2 rounded-lg text-center transition-all cursor-pointer ${
                    notificationFilter === 'calendar' ? 'bg-white text-indigo-900 font-bold shadow-xs' : 'hover:text-slate-900'
                  }`}
                >
                  Calendar
                </button>
                <button
                  onClick={() => setNotificationFilter('updates')}
                  className={`flex-1 py-1 px-2 rounded-lg text-center transition-all cursor-pointer ${
                    notificationFilter === 'updates' ? 'bg-white text-teal-900 font-bold shadow-xs' : 'hover:text-slate-900'
                  }`}
                >
                  Updates
                </button>
              </div>

              {/* Notification Items List */}
              <div className="max-h-80 overflow-y-auto space-y-2 pr-0.5">
                {filteredReminders.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 space-y-1.5">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500/70 mx-auto" />
                    <p className="text-xs font-semibold text-slate-700">All caught up!</p>
                    <p className="text-[11px] text-slate-400">No active notifications in this section</p>
                  </div>
                ) : (
                  filteredReminders.map((r) => {
                    const isCalendar = r.category === 'calendar' || r.title.toLowerCase().includes('calendar') || r.title.toLowerCase().includes('event:');
                    const isUrgent = r.title.toLowerCase().includes('urgent');

                    const getBadgeIcon = () => {
                      if (isCalendar) return <CalendarIcon className="w-3.5 h-3.5 text-indigo-600" />;
                      if (isUrgent) return <Clock className="w-3.5 h-3.5 text-amber-600" />;
                      if (r.category === 'email') return <Mail className="w-3.5 h-3.5 text-sky-600" />;
                      return <Clock className="w-3.5 h-3.5 text-[#34515e]" />;
                    };

                    const getBadgeBg = () => {
                      if (isCalendar) return 'bg-indigo-50 border-indigo-100';
                      if (isUrgent) return 'bg-amber-50 border-amber-100';
                      if (r.category === 'email') return 'bg-sky-50 border-sky-100';
                      return 'bg-slate-100 border-slate-200';
                    };

                    return (
                      <div
                        key={r.id}
                        onClick={() => handleNotificationClick(r)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer group flex items-start justify-between gap-3 ${
                          r.isRead
                            ? 'bg-slate-50/70 border-slate-100 text-slate-600 hover:bg-slate-100/70'
                            : 'bg-sky-50/70 border-sky-100 text-slate-900 hover:bg-sky-100/70 shadow-xs'
                        }`}
                      >
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <div className={`p-2 rounded-xl border shrink-0 mt-0.5 ${getBadgeBg()}`}>
                            {getBadgeIcon()}
                          </div>
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-1.5">
                              {!r.isRead && (
                                <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />
                              )}
                              <p className="font-bold text-xs text-slate-900 group-hover:text-[#34515e] transition-colors truncate">
                                {r.title}
                              </p>
                            </div>
                            <p className="text-[11px] text-slate-600 leading-snug line-clamp-2">
                              {r.message}
                            </p>
                            <span className="text-[10px] text-slate-400 block pt-0.5">
                              {formatNotificationTime(r.createdAt)}
                            </span>
                          </div>
                        </div>

                        {!r.isRead && onMarkReminderAsRead && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onMarkReminderAsRead(r.id);
                            }}
                            title="Mark as read"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer transition-colors shrink-0 self-center"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                {browserPermission !== 'granted' ? (
                  <button
                    onClick={requestBrowserPermission}
                    className="text-[#34515e] hover:text-slate-900 font-semibold cursor-pointer flex items-center gap-1"
                  >
                    <span>Enable browser notifications</span>
                  </button>
                ) : (
                  <span className="text-emerald-600 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Browser alerts active</span>
                  </span>
                )}

                {onNavigateToTab && (
                  <button
                    onClick={() => {
                      setShowNotifications(false);
                      onNavigateToTab('tasks');
                    }}
                    className="text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                  >
                    View in Responsibilities →
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Card matching top-right card from reference design */}
        {user ? (
          <div className="flex items-center gap-2 bg-white rounded-2xl px-3 py-1.5 shadow-sm text-slate-800 border border-white/20">
            <div className="flex items-center gap-2 text-xs">
              {user.picture ? (
                <img
                  src={user.picture}
                  alt={user.name || user.email}
                  className="w-7 h-7 rounded-full border border-slate-200 object-cover"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[#e2edf2] text-[#34515e] border border-slate-200 flex items-center justify-center text-[11px] font-bold">
                  {getInitials(user.name, user.email)}
                </div>
              )}
              <div className="hidden sm:block text-left">
                <div className="text-xs font-bold text-slate-900 leading-tight">
                  {user.name || 'User'}
                </div>
              </div>
            </div>

            <button
              onClick={onLogout}
              title="Sign Out"
              className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer ml-0.5"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
};
