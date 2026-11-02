import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  LogOut, 
  Bell, 
  Check, 
  Clock, 
  RefreshCw,
  CheckCircle2,
  Search
} from 'lucide-react';
import { User, ReminderNotification } from '@lifesynch/shared';

interface NavbarProps {
  user: User | null;
  onLogout: () => void;
  // Kept for interface compatibility
  backendConnected?: boolean | null;
  onRefreshHealth?: () => void;
  isCheckingHealth?: boolean;
  reminders?: ReminderNotification[];
  onMarkReminderAsRead?: (id: string) => void;
  onNavigateToTab?: (tab: string) => void;
  isSyncing?: boolean;
  onTriggerSync?: () => void;
  syncError?: string | null;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  user, 
  onLogout,
  backendConnected,
  reminders = [],
  onMarkReminderAsRead,
  onNavigateToTab,
  isSyncing = false,
  onTriggerSync,
  syncError
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);

  // Close notifications on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadReminders = reminders.filter(r => !r.isRead);
  const unreadCount = unreadReminders.length;

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      const parts = name.trim().split(' ');
      return parts.length > 1
        ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
        : name.slice(0, 2).toUpperCase();
    }
    return email ? email.slice(0, 2).toUpperCase() : 'LS';
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

      {/* Right Controls: Search pill, Sync status, Notifications, Ask Assistant, User */}
      <div className="flex items-center gap-2.5 sm:gap-3.5">
        
        {/* Search Pill matching reference design */}
        <div 
          onClick={() => onNavigateToTab?.('assistant')}
          className="hidden md:flex items-center gap-2 bg-white/95 hover:bg-white text-slate-700 px-3.5 py-1.5 rounded-full text-xs shadow-xs transition-all cursor-pointer w-44 lg:w-56"
          title="Search or Ask AI"
        >
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400 truncate">Search records...</span>
        </div>

        {/* Sync Status Pill */}
        {backendConnected === false || Boolean(syncError) ? (
          <div 
            title={syncError || 'Backend unreachable. Synchronization paused.'}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-300/30 text-xs text-rose-200 font-medium"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            <span>Sync Paused</span>
          </div>
        ) : isSyncing ? (
          <div 
            onClick={onTriggerSync}
            title="Automatic background sync in progress"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 border border-white/20 text-xs text-white font-medium hover:bg-white/20 transition-colors cursor-pointer shadow-xs"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>Syncing...</span>
            <RefreshCw className="w-3 h-3 text-white/70 animate-spin" />
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

          {/* Compact Notification Popover */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-slate-200/90 shadow-2xl p-3.5 z-50 text-xs space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-[#34515e]" />
                  Notifications & Reminders
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  {unreadCount} unread
                </span>
              </div>

              <div className="max-h-72 overflow-y-auto space-y-2 pr-0.5">
                {reminders.length === 0 ? (
                  <div className="py-6 text-center text-slate-500 space-y-1">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500/60 mx-auto" />
                    <p className="text-xs">No active notifications</p>
                  </div>
                ) : (
                  reminders.slice(0, 10).map((r) => (
                    <div
                      key={r.id}
                      className={`p-3 rounded-xl border transition-all ${
                        r.isRead
                          ? 'bg-slate-50 border-slate-100 text-slate-500'
                          : 'bg-sky-50/60 border-sky-100 text-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="font-semibold text-xs leading-snug line-clamp-2">
                            {r.message}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5 text-slate-400" />
                              {new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="capitalize">{r.type}</span>
                          </div>
                        </div>

                        {!r.isRead && onMarkReminderAsRead && (
                          <button
                            onClick={() => onMarkReminderAsRead(r.id)}
                            title="Mark as read"
                            className="p-1 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-100 cursor-pointer transition-colors shrink-0"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {reminders.length > 0 && onNavigateToTab && (
                <div className="pt-2 border-t border-slate-100 text-center">
                  <button
                    onClick={() => {
                      setShowNotifications(false);
                      onNavigateToTab('tasks');
                    }}
                    className="text-xs text-sky-700 hover:text-sky-800 font-semibold cursor-pointer"
                  >
                    View all in Responsibilities →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* "Ask LifeSynch" Button with soft blue gradient matching reference */}
        <button
          onClick={() => onNavigateToTab?.('assistant')}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-500 hover:to-blue-600 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-white" />
          <span className="hidden sm:inline">Ask AI</span>
        </button>

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
                <div className="text-[10px] text-slate-400 leading-tight truncate max-w-[120px] mt-0.5">
                  id: {user.email}
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
