import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  LogOut, 
  Bell, 
  Check, 
  Clock, 
  ChevronDown, 
  RefreshCw,
  CheckCircle2
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
    <header className="h-14 border-b border-slate-200/70 bg-white/75 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40 select-none">
      {/* Brand & Wordmark */}
      <div className="flex items-center gap-3">
        <div 
          onClick={() => onNavigateToTab?.('dashboard')}
          className="flex items-center gap-2 cursor-pointer group"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-[#1a68f0] group-hover:scale-125 transition-transform shadow-sm shadow-blue-500/50" />
          <span className="font-bold tracking-tight text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
            <span>LifeSynch</span>
            <span className="text-[#1a68f0] text-xs">✦</span>
          </span>
        </div>
      </div>

      {/* Right Controls: Sync status, Notifications, Ask Assistant, User */}
      <div className="flex items-center gap-2.5 sm:gap-3.5">
        
        {/* Sync Status Pill */}
        {backendConnected === false || Boolean(syncError) ? (
          <div 
            title={syncError || 'Backend unreachable. Synchronization paused.'}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span>Sync Paused</span>
          </div>
        ) : (
          <div 
            onClick={onTriggerSync}
            title="Automatic background sync active (Google Calendar & Gmail)"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 text-xs text-slate-700 font-medium hover:border-slate-300 transition-colors cursor-pointer shadow-xs"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
            <span>{isSyncing ? 'Syncing...' : 'Active'}</span>
            {isSyncing ? (
              <RefreshCw className="w-3 h-3 text-slate-400 animate-spin" />
            ) : (
              <ChevronDown className="w-3 h-3 text-slate-400" />
            )}
          </div>
        )}

        {/* Notifications Bell with popover */}
        <div className="relative" ref={notificationsRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className={`p-2 rounded-xl border transition-colors relative cursor-pointer ${
              showNotifications 
                ? 'bg-blue-50 border-blue-200 text-blue-700' 
                : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 shadow-xs'
            }`}
            title="Notifications & Deadline Reminders"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#1a68f0] text-white text-[11px] font-bold flex items-center justify-center leading-none shadow-sm">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Compact Notification Popover */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-slate-200/90 shadow-2xl p-3.5 z-50 text-xs space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-[#1a68f0]" />
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
                          : 'bg-blue-50/60 border-blue-100 text-slate-800'
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
                            className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-100 cursor-pointer transition-colors shrink-0"
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
                    className="text-xs text-[#1a68f0] hover:text-[#1557cc] font-semibold cursor-pointer"
                  >
                    View all in Responsibilities →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* "Ask LifeSynch" Button */}
        <button
          onClick={() => onNavigateToTab?.('assistant')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100/80 text-[#1a68f0] border border-blue-200/80 text-xs font-semibold shadow-xs transition-all cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#1a68f0]" />
          <span className="hidden sm:inline">Ask LifeSynch</span>
        </button>

        {/* User Profile & Sign Out */}
        {user ? (
          <div className="flex items-center gap-2 pl-1 border-l border-slate-200">
            <div className="flex items-center gap-2 text-xs">
              {user.picture ? (
                <img
                  src={user.picture}
                  alt={user.name || user.email}
                  className="w-7 h-7 rounded-full border border-blue-200 object-cover"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-[11px] font-bold text-blue-700">
                  {getInitials(user.name, user.email)}
                </div>
              )}
              <div className="hidden xl:block text-left">
                <div className="text-xs font-semibold text-slate-800 leading-tight">
                  {user.name ? user.name.split(' ')[0] : user.email.split('@')[0]}
                </div>
              </div>
            </div>

            <button
              onClick={onLogout}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
};
