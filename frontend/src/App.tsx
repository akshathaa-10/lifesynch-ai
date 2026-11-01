import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  CheckCircle2, 
  Mail, 
  Calendar as CalendarIcon, 
  Clock,
  AlertCircle, 
  ChevronDown, 
  ChevronUp,
  Inbox,
  MapPin, 
  CheckSquare,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './components/auth/LoginPage';
import { AuthCallback } from './components/auth/AuthCallback';
import { AppLayout } from './components/layout/AppLayout';
import { AskAssistant } from './components/assistant/AskAssistant';
import { PersonalIntelligenceHub } from './components/dashboard/PersonalIntelligenceHub';
import { apiClient, ApiError, AUTH_TOKEN_KEY } from './services/api';
import { 
  Responsibility, 
  TaskPriority,
  EmailRecord, 
  CalendarEventRecord,
  ReminderNotification
} from '@lifesynch/shared';

const MainDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [tasks, setTasks] = useState<Responsibility[]>([]);
  const [selectedResponsibility, setSelectedResponsibility] = useState<Responsibility | null>(null);
  const [pendingAssistantQuestion, setPendingAssistantQuestion] = useState<string | null>(null);

  const handleAskQuestion = useCallback((q: string) => {
    setPendingAssistantQuestion(q);
    setActiveTab('assistant');
  }, []);

  const handleUpdateTaskCategory = useCallback(async (taskId: string, newCategory: string) => {
    try {
      const res = await apiClient.updateTask(taskId, { category: newCategory as any });
      if (res.data) {
        setTasks(prev => prev.map(t => t.id === taskId ? res.data! : t));
      }
    } catch (err) {
      console.warn('Failed to update task category:', err);
    }
  }, []);

  // Responsibilities View State
  const [upcomingFilter, setUpcomingFilter] = useState<'all' | 'deadlines' | 'windows' | 'events'>('all');
  const syncInProgressRef = React.useRef<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Real-time clock ticker for time-sensitive deadline recalculations (DUE TODAY -> OVERDUE TODAY)
  const [currentTime, setCurrentTime] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Gmail Ingestion State
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [isLoadingEmails, setIsLoadingEmails] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);

  // Calendar Ingestion State
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventRecord[]>([]);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState<boolean>(false);

  // Reminders & Notifications State (integrated into top navigation)
  const [reminders, setReminders] = useState<ReminderNotification[]>([]);

  const handleMarkReminderAsRead = useCallback(async (id: string) => {
    try {
      await apiClient.markReminderAsRead(id);
      setReminders(prev => prev.map(r => r.id === id ? { ...r, isRead: true } : r));
    } catch (err) {
      console.warn('Failed to mark reminder as read:', err);
    }
  }, []);

  // Auth expiry — forces re-login with a friendly message
  const [authExpiredError, setAuthExpiredError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    setIsChecking(true);
    try {
      await apiClient.getHealth();
      setIsConnected(true);
    } catch {
      setIsConnected(false);
    } finally {
      setIsChecking(false);
    }
  }, []);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await apiClient.getTasks();
      const incoming = res.data;
      if (incoming) {
        setTasks(prev => {
          if (prev.length === incoming.length) {
            const prevMap = new Map(prev.map(p => [p.id, p]));
            let changed = false;
            for (const inc of incoming) {
              const p = prevMap.get(inc.id);
              if (!p) {
                changed = true;
                break;
              }
              if (
                p.status !== inc.status ||
                p.title !== inc.title ||
                p.action !== inc.action ||
                p.description !== inc.description ||
                p.priority !== inc.priority ||
                p.dueDate !== inc.dueDate ||
                p.dueTime !== inc.dueTime ||
                p.updatedAt !== inc.updatedAt
              ) {
                changed = true;
                break;
              }
            }
            if (!changed) return prev;
          }
          // Preserve unchanged item object identities to avoid triggering unnecessary child re-renders
          const prevMap = new Map(prev.map(p => [p.id, p]));
          return incoming.map(inc => {
            const p = prevMap.get(inc.id);
            if (
              p &&
              p.status === inc.status &&
              p.title === inc.title &&
              p.action === inc.action &&
              p.description === inc.description &&
              p.priority === inc.priority &&
              p.dueDate === inc.dueDate &&
              p.dueTime === inc.dueTime &&
              p.updatedAt === inc.updatedAt
            ) {
              return p;
            }
            return inc;
          });
        });
      }
    } catch (err) {
      if (err instanceof ApiError && err.isAuthError) {
        setAuthExpiredError('Your Google session has expired. Please sign in again.');
      }
      // Silent — keep existing tasks visible on background failure
      console.warn('Failed to fetch responsibilities (silent):', err instanceof Error ? err.message : err);
    }
  }, []);

  const fetchEmails = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoadingEmails(true);
    try {
      const res = await apiClient.getEmails(100);
      const incoming = res.data;
      if (incoming) {
        setEmails(prev => {
          if (prev.length === incoming.length && prev.length > 0 && prev[0].id === incoming[0].id) {
            return prev;
          }
          return incoming;
        });
      }
    } catch (err) {
      if (err instanceof ApiError && err.isAuthError) {
        setAuthExpiredError('Your Google session has expired. Please sign in again.');
      }
      // Silent — keep existing emails visible on background failure
      console.warn('Failed to fetch emails (silent):', err instanceof Error ? err.message : err);
    } finally {
      if (!quiet) setIsLoadingEmails(false);
    }
  }, []);

  const fetchCalendarEvents = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoadingCalendar(true);
    try {
      const res = await apiClient.getCalendarEvents(100);
      const incoming = res.data;
      if (incoming) {
        setCalendarEvents(prev => {
          if (prev.length === incoming.length && prev.length > 0 && prev[0].id === incoming[0].id) {
            return prev;
          }
          return incoming;
        });
      }
    } catch (err) {
      if (err instanceof ApiError && err.isAuthError) {
        setAuthExpiredError('Your Google session has expired. Please sign in again.');
      }
      // Silent — keep existing events visible on background failure
      console.warn('Failed to fetch calendar events (silent):', err instanceof Error ? err.message : err);
    } finally {
      if (!quiet) setIsLoadingCalendar(false);
    }
  }, []);

  const fetchReminders = useCallback(async () => {
    try {
      const res = await apiClient.getReminders();
      const incoming = res.data;
      if (incoming) {
        setReminders(prev => {
          if (prev.length === incoming.length) {
            const isSame = prev.every((r, idx) => r.id === incoming[idx].id && r.isRead === incoming[idx].isRead);
            if (isSame) return prev;
          }
          return incoming;
        });
      }
    } catch (err) {
      // Silent — keep existing notifications visible on background failure
      console.warn('Failed to fetch reminders (silent):', err instanceof Error ? err.message : err);
    }
  }, []);

  // Fully automatic real-time background sync for Gmail, Google Calendar, and Responsibilities
  const performBackgroundSync = useCallback(async () => {
    if (syncInProgressRef.current) return;
    syncInProgressRef.current = true;

    try {
      // 1. Quietly synchronize Google Calendar and Gmail in background
      const [calRes, gmailRes] = await Promise.allSettled([
        apiClient.syncCalendar(),
        apiClient.syncGmail()
      ]);

      const hasCalError = calRes.status === 'rejected';
      const hasGmailError = gmailRes.status === 'rejected';

      if (hasCalError && hasGmailError) {
        const calErr = (calRes as PromiseRejectedResult).reason;
        if (calErr instanceof ApiError && calErr.isAuthError) {
          setAuthExpiredError('Your Google session has expired. Please sign in again.');
        } else {
          setSyncError('Google synchronization failed. Please check connection.');
        }
      } else {
        setSyncError(null);
      }

      // 2. Automatically process new Gmail messages and Calendar changes into responsibilities
      await apiClient.generateResponsibilities().catch(() => {});

      // 3. Update active data quietly without full-page reloads, flashing, or scroll-position resets
      await Promise.all([
        fetchTasks(),
        fetchEmails(true),
        fetchCalendarEvents(true),
        fetchReminders()
      ]);
      setLastSyncTime(new Date());
    } catch (err) {
      console.warn('Background auto-sync failed (silent):', err);
    } finally {
      syncInProgressRef.current = false;
    }
  }, [fetchTasks, fetchEmails, fetchCalendarEvents, fetchReminders]);

  useEffect(() => {
    fetchHealth();
    performBackgroundSync();

    // Automatic polling interval: refresh data and background-sync Google services automatically every 10 seconds
    const pollInterval = setInterval(() => {
      performBackgroundSync();
    }, 10000);

    return () => clearInterval(pollInterval);
  }, [fetchHealth, performBackgroundSync]);

  // Real-time sync when window regains focus (e.g. user returns after creating/updating an event in Google Calendar or Gmail)
  useEffect(() => {
    const handleFocus = () => {
      performBackgroundSync();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [performBackgroundSync]);

  // Real-time sync when switching tabs
  useEffect(() => {
    performBackgroundSync();
  }, [activeTab, performBackgroundSync]);


  // Sort calendar events strictly in chronological order using actual event date AND time
  const sortedCalendarEvents = useMemo(() => {
    return [...calendarEvents].sort((a, b) => {
      const timeA = new Date(a.startTime).getTime();
      const timeB = new Date(b.startTime).getTime();
      if (isNaN(timeA)) return 1;
      if (isNaN(timeB)) return -1;
      return timeA - timeB;
    });
  }, [calendarEvents]);






  const formatEventTime = (startStr: string, endStr: string) => {
    const startDate = new Date(startStr);
    const endDate = new Date(endStr);
    
    const isAllDay = startStr.includes('T00:00:00') && endStr.includes('T23:59:59');
    if (isAllDay) {
      return {
        dateText: startDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
        timeText: 'All Day'
      };
    }

    const dateText = startDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const timeText = `${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    return { dateText, timeText };
  };

  // Friendly relative time: "2h ago", "Mon", "Sep 24"
  const formatRelativeTime = (dateStr?: string): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const diffMs = Date.now() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    if (diffD === 1) return 'Yesterday';
    if (diffD < 7) return d.toLocaleDateString(undefined, { weekday: 'short' });
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  // Generate 1-2 letter initials from sender string like "John Doe <john@example.com>"
  const getSenderInitials = (sender?: string): string => {
    if (!sender) return '?';
    const name = sender.replace(/<.*>/, '').trim();
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    if (parts.length === 1 && parts[0].length > 0) return parts[0].slice(0, 2).toUpperCase();
    return sender.slice(0, 2).toUpperCase();
  };

  // Sender display name (strip email angle-bracket part)
  const getSenderName = (sender?: string): string => {
    if (!sender) return 'Unknown';
    const name = sender.replace(/<.*>/, '').trim();
    return name || sender;
  };


  // Priority indicator placed before titles: High (H), Medium (M), Low (L) in subtle pill
  const renderPriorityDot = (priority: TaskPriority) => {
    switch (priority) {
      case 'urgent':
      case 'high':
        return (
          <span
            className="w-4 h-4 rounded-full bg-rose-500/15 border border-rose-500/35 text-rose-400 text-[9px] font-bold flex items-center justify-center shrink-0 shadow-sm"
            title="High Priority"
            aria-label="High Priority"
          >
            H
          </span>
        );
      case 'medium':
        return (
          <span
            className="w-4 h-4 rounded-full bg-amber-500/15 border border-amber-500/35 text-amber-300 text-[9px] font-bold flex items-center justify-center shrink-0 shadow-sm"
            title="Medium Priority"
            aria-label="Medium Priority"
          >
            M
          </span>
        );
      case 'low':
      default:
        return (
          <span
            className="w-4 h-4 rounded-full bg-teal-500/15 border border-teal-500/35 text-teal-300 text-[9px] font-bold flex items-center justify-center shrink-0 shadow-sm"
            title="Low Priority"
            aria-label="Low Priority"
          >
            L
          </span>
        );
    }
  };

  const formatTableDueDate = (dueStr?: string, dueTimeStr?: string): string => {
    if (!dueStr) return 'No deadline';
    const d = new Date(dueStr);
    if (isNaN(d.getTime())) return dueStr;

    const month = d.toLocaleDateString('en-US', { month: 'short' });
    const day = d.getDate();
    const datePart = `${month} ${day}`;

    if (dueTimeStr) {
      const [hStr, mStr] = dueTimeStr.split(':');
      let h = parseInt(hStr, 10);
      const m = mStr || '00';
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      const timePart = m === '00' ? `${h} ${ampm}` : `${h}:${m} ${ampm}`;
      return `${datePart} ${timePart}`;
    }

    if (dueStr.includes('T') && !dueStr.includes('T00:00:00')) {
      const timePart = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      return `${datePart} ${timePart}`;
    }

    return datePart;
  };

  const renderSourceCell = (item: Responsibility) => {
    const hasCal = item.source === 'calendar' || (item.sources && item.sources.includes('calendar'));
    const hasGmail = item.source === 'gmail' || (item.sources && item.sources.includes('gmail'));
    const isBoth = item.source === 'both' || (hasCal && hasGmail);

    if (isBoth) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-300 font-medium">
          <Mail className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span>Gmail</span>
          <span className="text-slate-600">/</span>
          <CalendarIcon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span>Calendar</span>
        </span>
      );
    }
    if (hasCal) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-indigo-300 font-medium">
          <CalendarIcon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span>Calendar</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-rose-300 font-medium">
        <Mail className="w-3.5 h-3.5 text-rose-400 shrink-0" />
        <span>Gmail</span>
      </span>
    );
  };

  const parseTaskDate = (dueDate?: string, dueTime?: string, refDate?: Date): { targetDate: Date | null; hasTime: boolean; diffDays: number | null } => {
    if (!dueDate || !dueDate.trim()) return { targetDate: null, hasTime: false, diffDays: null };
    const d = new Date(dueDate);
    if (isNaN(d.getTime())) return { targetDate: null, hasTime: false, diffDays: null };

    const base = refDate || new Date();
    const today = new Date(base.getFullYear(), base.getMonth(), base.getDate());

    let targetYear = d.getFullYear();
    let targetMonth = d.getMonth();
    let targetDayNum = d.getDate();

    if (/^\d{4}-\d{2}-\d{2}/.test(dueDate)) {
      const parts = dueDate.split('T')[0].split('-').map(Number);
      if (parts.length === 3) {
        targetYear = parts[0];
        targetMonth = parts[1] - 1;
        targetDayNum = parts[2];
      }
    }

    let hasTime = false;
    const targetDate = new Date(targetYear, targetMonth, targetDayNum);

    if (dueTime) {
      const [hStr, mStr] = dueTime.split(':');
      const h = parseInt(hStr, 10);
      const m = parseInt(mStr, 10) || 0;
      if (!isNaN(h)) {
        targetDate.setHours(h, m, 0, 0);
        hasTime = true;
      }
    } else if (dueDate.includes('T') && !dueDate.includes('T00:00:00')) {
      targetDate.setHours(d.getHours(), d.getMinutes(), d.getSeconds(), 0);
      hasTime = true;
    } else {
      // Date only (no specific time): due by end of that day (23:59:59)
      targetDate.setHours(23, 59, 59, 999);
      hasTime = false;
    }

    const targetDay = new Date(targetYear, targetMonth, targetDayNum);
    const diffDays = Math.round((targetDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return { targetDate, hasTime, diffDays };
  };

  const getModalStatus = (item: Responsibility, refDate: Date): { label: string; color: string } => {
    if (!item.dueDate || !item.dueDate.trim()) {
      return { label: 'No Deadline', color: 'text-slate-400 bg-slate-800/60 border-slate-700/60' };
    }
    const parsed = parseTaskDate(item.dueDate, item.dueTime, refDate);
    if (!parsed.targetDate || parsed.diffDays === null) {
      return { label: 'No Deadline', color: 'text-slate-400 bg-slate-800/60 border-slate-700/60' };
    }
    if (parsed.diffDays < 0) {
      return { label: 'Older Overdue', color: 'text-rose-300 bg-rose-950/50 border-rose-800/50' };
    }
    if (parsed.diffDays === 0) {
      if (parsed.hasTime && parsed.targetDate.getTime() < refDate.getTime()) {
        return { label: 'Overdue Today', color: 'text-rose-300 bg-rose-950/50 border-rose-800/50' };
      }
      return { label: 'Due Today', color: 'text-amber-300 bg-amber-950/50 border-amber-700/50' };
    }
    return { label: 'Coming Up', color: 'text-indigo-300 bg-indigo-950/50 border-indigo-700/50' };
  };

  // 1. Natural personal assistant wording cleanup
  const formatActionText = (action?: string, title?: string): string => {
    if (!action) return title || '';
    const match = action.match(/review calendar event\s*['"]?([^'"]+)['"]?/i);
    if (match) {
      const name = match[1].trim();
      if (/meeting|call|sync|discussion/i.test(name)) return `Join ${name}`;
      if (/appointment|interview|assessment|exam|test/i.test(name)) return `Attend ${name}`;
      return name ? `Attend ${name}` : 'Attend scheduled commitment';
    }
    return action;
  };

  const formatTitleText = (title: string): string => {
    if (!title) return '';
    const match = title.trim().match(/^event\s*['"]([^'"]+)['"]$/i);
    if (match) return match[1];
    return title;
  };

  // 2. Cross-Source Reconciliation: deduplicate records referring to the same real-world obligation
  const reconcileList = (list: Responsibility[]): Responsibility[] => {
    const reconciled: Responsibility[] = [];

    for (const item of list) {
      const cleanT = item.title.toLowerCase().replace(/^(re|fwd|fw|reminder|invitation|invite)\s*:\s*/gi, '').replace(/[^a-z0-9]/g, '');

      const matchIdx = reconciled.findIndex(existing => {
        if (existing.id === item.id) return true;

        // Direct or secondary ID match
        if (existing.sourceId && item.sourceId && existing.sourceId === item.sourceId) return true;
        const exContext = existing.sourceContext as any;
        const itemContext = item.sourceContext as any;
        if (exContext?.calendarEventId && itemContext?.calendarEventId && exContext.calendarEventId === itemContext.calendarEventId) return true;
        if (exContext?.messageId && itemContext?.messageId && exContext.messageId === itemContext.messageId) return true;

        const exClean = existing.title.toLowerCase().replace(/^(re|fwd|fw|reminder|invitation|invite)\s*:\s*/gi, '').replace(/[^a-z0-9]/g, '');
        const isTitleMatch = exClean === cleanT || 
          (exClean.length >= 8 && cleanT.length >= 8 && (exClean.includes(cleanT) || cleanT.includes(exClean)));

        if (isTitleMatch) {
          // Check date compatibility: same day or within 2 days or one is null
          if (!existing.dueDate || !item.dueDate) return true;
          const diffDays = Math.abs(new Date(existing.dueDate).getTime() - new Date(item.dueDate).getTime()) / (1000 * 60 * 60 * 24);
          if (diffDays <= 2) return true;
        }
        return false;
      });

      if (matchIdx !== -1) {
        const existing = reconciled[matchIdx];
        const hasCal = existing.sources?.includes('calendar') || item.sources?.includes('calendar') || existing.source === 'calendar' || item.source === 'calendar';
        const hasGmail = existing.sources?.includes('gmail') || item.sources?.includes('gmail') || existing.source === 'gmail' || item.source === 'gmail';
        const isBoth = hasCal && hasGmail;

        const mergedSources = Array.from(new Set([...(existing.sources || []), ...(item.sources || [])])) as ('gmail' | 'calendar' | 'manual')[];
        const mergedSource = isBoth ? 'both' : (existing.source === 'both' ? 'both' : (item.source === 'both' ? 'both' : (existing.source || item.source)));

        reconciled[matchIdx] = {
          ...existing,
          title: existing.title.length >= item.title.length ? existing.title : item.title,
          description: existing.description || item.description,
          action: existing.action || item.action,
          dueDate: existing.dueDate || item.dueDate,
          dueTime: existing.dueTime || item.dueTime,
          source: mergedSource,
          sources: mergedSources,
          sourceDisplay: isBoth ? 'both' : (mergedSource === 'calendar' ? 'Calendar' : 'Gmail'),
          sourceContext: { ...(item.sourceContext || {}), ...(existing.sourceContext || {}) }
        };
      } else {
        reconciled.push({
          ...item,
          title: formatTitleText(item.title),
          action: formatActionText(item.action, item.title)
        });
      }
    }

    return reconciled;
  };

  const renderGroupedResponsibilities = (taskList: Responsibility[]) => {
    const validTasks = reconcileList(
      taskList.filter(t => !['cancelled', 'CANCELLED', 'obsolete', 'OBSOLETE', 'completed', 'COMPLETED', 'dismissed'].includes(t.status))
    );

    const scrollToSection = (id: string) => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };

    // 1. Your Day: Actionable responsibilities with actual deadlines occurring today that have not yet passed
    const yourDayList: Responsibility[] = [];

    // 2. Upcoming: Tomorrow's and all future actionable deadlines, and relevant events/meetings with actual scheduled dates and times
    const upcomingList: Responsibility[] = [];

    // 3. Passed: Actionable responsibilities whose actual deadlines have passed, and concluded commitments
    const passedList: Responsibility[] = [];

    // 4. Informative: Emails that contain no genuine actionable deadline or scheduled event/meeting
    const informationalTasks: Responsibility[] = [];

    const getItemSchedule = (t: Responsibility, now: Date) => {
      const isEvent = t.type === 'appointment' || t.sourceContext?.classification === 'event_meeting' || t.sourceContext?.deadlineType === 'event_time' || t.source === 'calendar';
      const classification = (t.sourceContext?.classification as string) || '';
      const deadlineType = (t.sourceContext?.deadlineType as string) || '';
      const isWindow = classification === 'opportunity_window' || classification === 'application_window' || deadlineType === 'application_window' || deadlineType === 'window_close' || !!t.sourceContext?.windowStartDate;
      const isProgram = classification === 'program_schedule' || deadlineType === 'program_duration';

      // 1. Event: start date/time and end date/time
      if (isEvent) {
        const rawDateStr = t.dueDate || (t.sourceContext?.eventDate as string) || (t.sourceContext?.startTime as string);
        const startTimeStr = t.dueTime || (t.sourceContext?.startTime as string);
        const endTimeStr = (t.sourceContext?.endTime as string) || (t.sourceContext?.dueTimeEnd as string);

        const parsedStart = rawDateStr ? parseTaskDate(rawDateStr, startTimeStr, now) : { targetDate: null, hasTime: false, diffDays: null };
        const startDate = parsedStart.targetDate;
        let endDate: Date | null = null;

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

        const isConcluded = endDate ? (endDate.getTime() < now.getTime()) : false;
        const isOngoing = startDate && endDate ? (now.getTime() >= startDate.getTime() && now.getTime() <= endDate.getTime()) : false;

        return {
          kind: 'event' as const,
          relevantDate: startDate,
          diffDays: parsedStart.diffDays,
          isPast: isConcluded,
          isOngoing,
          startDate,
          endDate,
          startTimeStr,
          endTimeStr
        };
      }

      // 2. Program schedule
      if (isProgram) {
        const rawStartStr = (t.sourceContext?.programStart as string) || (t.sourceContext?.startDate as string) || t.dueDate;
        const rawEndStr = (t.sourceContext?.programEnd as string) || (t.sourceContext?.endDate as string);

        const parsedStart = rawStartStr ? parseTaskDate(rawStartStr, undefined, now) : { targetDate: null, hasTime: false, diffDays: null };
        const parsedEnd = rawEndStr ? parseTaskDate(rawEndStr, undefined, now) : { targetDate: null, hasTime: false, diffDays: null };

        const startDate = parsedStart.targetDate;
        const endDate = parsedEnd.targetDate;

        const isConcluded = endDate ? (now.getTime() > endDate.getTime()) : false;
        const relevantDate = startDate || endDate;

        return {
          kind: 'program' as const,
          relevantDate,
          diffDays: parsedStart.diffDays ?? parsedEnd.diffDays,
          isPast: isConcluded,
          isOngoing: false,
          startDate,
          endDate
        };
      }

      // 3. Application window
      if (isWindow) {
        const rawOpenStr = (t.sourceContext?.windowStartDate as string) || (t.sourceContext?.windowOpen as string);
        const rawCloseStr = (t.sourceContext?.windowEndDate as string) || (t.sourceContext?.windowClose as string) || t.dueDate;

        const parsedOpen = rawOpenStr ? parseTaskDate(rawOpenStr, undefined, now) : { targetDate: null, hasTime: false, diffDays: null };
        const parsedClose = rawCloseStr ? parseTaskDate(rawCloseStr, t.dueTime, now) : { targetDate: null, hasTime: false, diffDays: null };

        const openDate = parsedOpen.targetDate;
        const closeDate = parsedClose.targetDate;

        const isClosed = closeDate ? (now.getTime() > closeDate.getTime()) : false;
        const relevantDate = (openDate && openDate.getTime() > now.getTime()) ? openDate : (closeDate || openDate);

        return {
          kind: 'window' as const,
          relevantDate,
          diffDays: parsedClose.diffDays ?? parsedOpen.diffDays,
          isPast: isClosed,
          isOngoing: false,
          openDate,
          closeDate
        };
      }

      // 4. Actionable task deadline
      if (!t.dueDate || !t.dueDate.trim()) {
        return {
          kind: 'deadline' as const,
          relevantDate: null,
          diffDays: null,
          isPast: false,
          isOngoing: false
        };
      }

      const parsed = parseTaskDate(t.dueDate, t.dueTime, now);
      const isPast = parsed.diffDays !== null && (
        parsed.diffDays < 0 ||
        (parsed.diffDays === 0 && parsed.targetDate && parsed.targetDate.getTime() < now.getTime()) ||
        t.status === 'OVERDUE'
      );

      return {
        kind: 'deadline' as const,
        relevantDate: parsed.targetDate,
        diffDays: parsed.diffDays,
        isPast,
        isOngoing: false
      };
    };

    const formatRelevantDateText = (item: Responsibility, schedule: ReturnType<typeof getItemSchedule>) => {
      // 1. Events & Meetings: display actual event date and time, never as a submission deadline
      if (schedule.kind === 'event') {
        if (!schedule.startDate) return 'No deadline';
        const parsed = parseTaskDate(item.dueDate || (item.sourceContext?.startTime as string), schedule.startTimeStr, currentTime);
        let timePart = '';
        if (schedule.startTimeStr) {
          const [sh, sm] = schedule.startTimeStr.split(':').map(Number);
          const sAmpm = sh >= 12 ? 'PM' : 'AM';
          const sH = sh % 12 || 12;
          const sM = sm < 10 ? `0${sm}` : sm;
          if (schedule.endTimeStr) {
            const [eh, em] = schedule.endTimeStr.split(':').map(Number);
            const eAmpm = eh >= 12 ? 'PM' : 'AM';
            const eH = eh % 12 || 12;
            const eM = em < 10 ? `0${em}` : em;
            timePart = `${sH}:${sM} ${sAmpm} – ${eH}:${eM} ${eAmpm}`;
          } else {
            timePart = `${sH}:${sM} ${sAmpm}`;
          }
        }

        if (parsed.diffDays === 0) {
          return timePart ? `Today · ${timePart}` : 'Today';
        }
        if (parsed.diffDays === 1) {
          return timePart ? `Tomorrow · ${timePart}` : 'Tomorrow';
        }
        if (parsed.diffDays === -1) {
          return timePart ? `Yesterday · ${timePart}` : 'Yesterday';
        }
        const month = schedule.startDate.toLocaleDateString('en-US', { month: 'short' });
        const day = schedule.startDate.getDate();
        const year = schedule.startDate.getFullYear();
        const isCurrentYear = year === currentTime.getFullYear();
        const datePart = isCurrentYear ? `${month} ${day}` : `${month} ${day}, ${year}`;
        return timePart ? `${datePart} · ${timePart}` : datePart;
      }

      // 2. Program Schedules: show date range or relevant date only when useful/supported by email, without labels, never as a submission deadline
      if (schedule.kind === 'program') {
        const sM = schedule.startDate ? schedule.startDate.toLocaleDateString('en-US', { month: 'short' }) : '';
        const sD = schedule.startDate ? schedule.startDate.getDate() : '';
        const eM = schedule.endDate ? schedule.endDate.toLocaleDateString('en-US', { month: 'short' }) : '';
        const eD = schedule.endDate ? schedule.endDate.getDate() : '';

        if (sD && eD) {
          return sM === eM ? `${sM} ${sD} – ${eD}` : `${sM} ${sD} – ${eM} ${eD}`;
        }
        if (sD) return `${sM} ${sD}`;
        if (eD) return `${eM} ${eD}`;
        return 'No deadline';
      }

      // 3. Application Windows / Periods: show date range or relevant date only when useful/supported by email, without labels
      if (schedule.kind === 'window') {
        const oM = schedule.openDate ? schedule.openDate.toLocaleDateString('en-US', { month: 'short' }) : '';
        const oD = schedule.openDate ? schedule.openDate.getDate() : '';
        const cM = schedule.closeDate ? schedule.closeDate.toLocaleDateString('en-US', { month: 'short' }) : '';
        const cD = schedule.closeDate ? schedule.closeDate.getDate() : '';

        if (oD && cD) {
          return oM === cM ? `${oM} ${oD} – ${cD}` : `${oM} ${oD} – ${cM} ${cD}`;
        }
        if (cD) {
          let timePart = '';
          if (item.dueTime) {
            const [hStr, mStr] = item.dueTime.split(':');
            const h = parseInt(hStr, 10);
            const m = parseInt(mStr, 10) || 0;
            const ampm = h >= 12 ? 'PM' : 'AM';
            const displayH = h % 12 || 12;
            const displayM = m < 10 ? `0${m}` : `${m}`;
            timePart = `${displayH}:${displayM} ${ampm}`;
          }
          return timePart ? `${cM} ${cD} · ${timePart}` : `${cM} ${cD}`;
        }
        if (oD) return `${oM} ${oD}`;
        return 'No deadline';
      }

      // 4. Informational tasks or items without a genuine deadline
      if (
        item.sourceContext?.classification === 'informational' ||
        !item.dueDate ||
        !item.dueDate.trim()
      ) {
        return 'No deadline';
      }

      // 5. Genuine Deadlines: display only the actual date and time
      const parsed = parseTaskDate(item.dueDate, item.dueTime, currentTime);
      if (!parsed.targetDate || parsed.diffDays === null) {
        return 'No deadline';
      }

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
      const isCurrentYear = year === currentTime.getFullYear();
      const datePart = isCurrentYear ? `${month} ${day}` : `${month} ${day}, ${year}`;

      let baseDate = datePart;
      if (parsed.diffDays === 0) {
        baseDate = 'Today';
      } else if (parsed.diffDays === 1) {
        baseDate = 'Tomorrow';
      } else if (parsed.diffDays === -1) {
        baseDate = 'Yesterday';
      }

      return timePart ? `${baseDate} · ${timePart}` : baseDate;
    };

    validTasks.forEach(t => {
      const schedule = getItemSchedule(t, currentTime);

      // 1. Check if item is a relevant scheduled event or meeting with an actual date and time
      const isScheduledEvent = schedule.kind === 'event' && schedule.startDate !== null;

      // 2. Check if item is an informational email, general announcement, program information, or lacks a genuine action deadline
      const classification = (t.sourceContext?.classification as string) || '';
      const deadlineType = (t.sourceContext?.deadlineType as string) || '';
      const actionText = (t.action || '').toLowerCase().trim();
      const combinedCorpus = `${t.title} ${t.action || ''} ${t.description || ''} ${String(t.sourceContext?.subject || '')} ${String(t.sourceContext?.snippet || '')}`.toLowerCase();

      // Program schedules, duration details, or informational flags are not actionable deadlines
      const isProgramSchedule = classification === 'program_schedule' || deadlineType === 'program_duration' || schedule.kind === 'program';
      const isExplicitInformational = classification === 'informational' || classification === 'ambiguous' || t.sourceContext?.isInformationalDate === true;

      // Passive / no-action required indicators
      const isNoAction = 
        actionText === '' ||
        actionText === 'none' ||
        actionText === 'n/a' ||
        actionText.startsWith('no action') ||
        actionText.includes('no action required') ||
        actionText.includes('informational only') ||
        actionText.startsWith('for your information') ||
        actionText.startsWith('fyi');

      // General announcements, program information, participation details, or activities without a specific action deadline
      const hasSubmissionObligation = /\b(submit|submission|upload|pay|payment|tuition|fee|exam|viva|assessment|test|interview|apply\s+by|register\s+before|last\s+date\s+to\s+apply|due\s+by|deadline)\b/i.test(combinedCorpus);
      
      const isGeneralAnnouncementOrProgramInfo = 
        /\b(program|sdp|fdp|skill\s+development|sessions?\s+from|music\s+club|club\s+audition|auditions|webinar|workshop|conference|seminar|orientation|celebration|announcement|circular|newsletter|bulletin|participation)\b/i.test(combinedCorpus) &&
        !hasSubmissionObligation;

      const isNonActionableInfo = isProgramSchedule || isExplicitInformational || isNoAction || isGeneralAnnouncementOrProgramInfo;

      // 3. Genuine Actionable Deadline validation (do not treat program start dates, ranges, or info dates as deadlines)
      let hasGenuineDeadline = false;
      let targetDeadlineDate: Date | null = null;
      let deadlineDiffDays: number | null = null;

      if (!isNonActionableInfo) {
        if (schedule.kind === 'window' && schedule.closeDate) {
          hasGenuineDeadline = true;
          targetDeadlineDate = schedule.closeDate;
          deadlineDiffDays = schedule.diffDays;
        } else if (t.dueDate && t.dueDate.trim()) {
          const parsed = parseTaskDate(t.dueDate, t.dueTime, currentTime);
          if (parsed.targetDate && parsed.diffDays !== null) {
            hasGenuineDeadline = true;
            targetDeadlineDate = parsed.targetDate;
            deadlineDiffDays = parsed.diffDays;
          }
        }
      }

      // Rule: Move emails that contain no genuine actionable deadline or scheduled event/meeting into Informative
      if (!isScheduledEvent && !hasGenuineDeadline) {
        informationalTasks.push(t);
        return;
      }

      // Concluded events or passed deadlines move to Passed
      if (schedule.isPast || (hasGenuineDeadline && deadlineDiffDays !== null && (deadlineDiffDays < 0 || (deadlineDiffDays === 0 && targetDeadlineDate && targetDeadlineDate.getTime() < currentTime.getTime())))) {
        passedList.push(t);
        return;
      }

      // Actionable deadlines due today that have not passed move to Your Day
      if (hasGenuineDeadline && deadlineDiffDays === 0) {
        yourDayList.push(t);
        return;
      }

      // Upcoming: Show ONLY genuine actionable responsibilities with future deadlines,
      // and relevant events or meetings with actual scheduled dates and times.
      if (isScheduledEvent || (hasGenuineDeadline && (deadlineDiffDays ?? 0) > 0)) {
        upcomingList.push(t);
        return;
      }

      // Preserve all other items in Informative
      informationalTasks.push(t);
    });

    // Sort Your Day: nearest deadline date/time first
    yourDayList.sort((a, b) => {
      const dtA = parseTaskDate(a.dueDate, a.dueTime, currentTime).targetDate?.getTime() ?? Infinity;
      const dtB = parseTaskDate(b.dueDate, b.dueTime, currentTime).targetDate?.getTime() ?? Infinity;
      return dtA - dtB;
    });

    // Upcoming filtering & sorting: nearest relevant date/time first
    const filteredUpcomingList = upcomingList.filter(t => {
      const s = getItemSchedule(t, currentTime);
      if (upcomingFilter === 'all') return true;
      if (upcomingFilter === 'windows') return s.kind === 'window';
      if (upcomingFilter === 'events') return s.kind === 'event' || s.kind === 'program';
      if (upcomingFilter === 'deadlines') return s.kind === 'deadline';
      return true;
    }).sort((a, b) => {
      const timeA = getItemSchedule(a, currentTime).relevantDate?.getTime() ?? Infinity;
      const timeB = getItemSchedule(b, currentTime).relevantDate?.getTime() ?? Infinity;
      return timeA - timeB;
    });

    // Sort Passed: most recently passed first
    passedList.sort((a, b) => {
      const timeA = getItemSchedule(a, currentTime).relevantDate?.getTime() ?? 0;
      const timeB = getItemSchedule(b, currentTime).relevantDate?.getTime() ?? 0;
      return timeB - timeA;
    });

    // Sort Informative: newest received/created first
    informationalTasks.sort((a, b) => {
      const timeA = a.sourceContext?.receivedAt ? new Date(a.sourceContext.receivedAt as string).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const timeB = b.sourceContext?.receivedAt ? new Date(b.sourceContext.receivedAt as string).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return timeB - timeA;
    });

    const renderClickableSource = (item: Responsibility) => {
      const hasCal = item.source === 'calendar' || (item.sources && item.sources.includes('calendar'));
      const hasGmail = item.source === 'gmail' || (item.sources && item.sources.includes('gmail'));
      const isBoth = item.source === 'both' || (hasCal && hasGmail);

      if (isBoth) {
        return (
          <div className="inline-flex items-center gap-1.5 flex-wrap justify-end">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (item.sourceId) setExpandedEmailId(item.sourceId);
                setActiveTab('gmail');
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-semibold transition-colors cursor-pointer"
              title="Open corresponding Gmail message"
            >
              <Mail className="w-3 h-3 text-rose-600" />
              <span>Gmail</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveTab('calendar');
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-semibold transition-colors cursor-pointer"
              title="Open corresponding Google Calendar event"
            >
              <CalendarIcon className="w-3 h-3 text-indigo-600" />
              <span>Calendar</span>
            </button>
          </div>
        );
      }

      if (hasCal) {
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveTab('calendar');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-semibold transition-colors cursor-pointer group/src"
            title="Open corresponding Google Calendar event"
          >
            <CalendarIcon className="w-3.5 h-3.5 text-indigo-600 group-hover/src:scale-110 transition-transform" />
            <span>Calendar</span>
          </button>
        );
      }

      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (item.sourceId) setExpandedEmailId(item.sourceId);
            setActiveTab('gmail');
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-semibold transition-colors cursor-pointer group/src"
          title="Open corresponding Gmail message"
        >
          <Mail className="w-3.5 h-3.5 text-rose-600 group-hover/src:scale-110 transition-transform" />
          <span>Gmail</span>
        </button>
      );
    };

    const renderResponsibilityTable = (
      items: Responsibility[],
      options?: { isMissed?: boolean; isNoDeadline?: boolean; isInformative?: boolean }
    ) => {
      if (items.length === 0) return null;

      return (
        <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-sm">
          {/* Desktop Table View (>= md screens): Responsive 4-column layout */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse table-fixed">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/70 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 w-[36%]">Event / Responsibility</th>
                  <th className="py-3 px-4 w-[28%]">Action Required</th>
                  <th className="py-3 px-4 w-[24%]">Deadline / Date & Time</th>
                  <th className="py-3 px-4 w-[12%] text-right">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {items.map(item => {
                  const schedule = getItemSchedule(item, currentTime);
                  const formattedDate = formatRelevantDateText(item, schedule);
                  const titleText = formatTitleText(item.title);
                  const isTodayDue = schedule.kind === 'deadline' && schedule.diffDays === 0 && !schedule.isPast;
                  const conciseAction = item.sourceContext?.nextStep || item.action;

                  let dateColor = 'text-slate-700';

                  if (schedule.kind === 'event') {
                    dateColor = 'text-sky-700 font-medium';
                  } else if (schedule.kind === 'program') {
                    dateColor = 'text-indigo-700 font-medium';
                  } else if (schedule.kind === 'window') {
                    dateColor = 'text-emerald-700 font-medium';
                  } else {
                    if (schedule.isPast) {
                      dateColor = 'text-rose-600 font-medium';
                    } else if (isTodayDue) {
                      dateColor = 'text-amber-700 font-semibold';
                    } else {
                      dateColor = 'text-slate-700';
                    }
                  }

                  if (options?.isNoDeadline || formattedDate === 'No deadline') {
                    dateColor = 'text-slate-400';
                  } else if (options?.isInformative || item.sourceContext?.classification === 'informational') {
                    dateColor = 'text-slate-500';
                  }

                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedResponsibility(item)}
                      className={`group hover:bg-slate-50/80 transition-colors cursor-pointer ${
                        options?.isMissed ? 'opacity-85' : ''
                      }`}
                    >
                      {/* Column 1: Event / Responsibility */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="flex items-start gap-2.5">
                          <div className="shrink-0 mt-0.5" title={schedule.kind === 'event' ? 'Calendar Commitment' : `Priority: ${item.priority}`}>
                            {schedule.kind === 'event' ? (
                              <div className="w-4 h-4 rounded-full bg-sky-100 border border-sky-300 flex items-center justify-center text-sky-700 text-[9px] font-bold">
                                <CalendarIcon className="w-2.5 h-2.5" />
                              </div>
                            ) : schedule.kind === 'program' ? (
                              <div className="w-4 h-4 rounded-full bg-indigo-100 border border-indigo-300 flex items-center justify-center text-indigo-700 text-[9px] font-bold">
                                P
                              </div>
                            ) : schedule.kind === 'window' ? (
                              <div className="w-4 h-4 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700 text-[9px] font-bold">
                                W
                              </div>
                            ) : (
                              renderPriorityDot(item.priority)
                            )}
                          </div>
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <h3 className={`font-semibold transition-colors leading-snug ${
                              options?.isMissed ? 'text-slate-400' : 'text-slate-800 group-hover:text-blue-600'
                            }`}>
                              {titleText}
                            </h3>
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                              {item.category && (
                                <span className="capitalize">{item.category}</span>
                              )}
                              {item.sourceContext?.sender && (
                                <span className="truncate max-w-[160px]">· {item.sourceContext.sender.replace(/<.*>/, '').trim()}</span>
                              )}
                              {item.sourceContext?.location && (
                                <span className="truncate max-w-[140px]">· {item.sourceContext.location}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Action Required */}
                      <td className="py-3.5 px-4 align-top">
                        {conciseAction ? (
                          <div className="flex items-start gap-1.5 text-xs text-blue-700 font-medium pt-0.5">
                            <ArrowRight className="w-3 h-3 text-blue-500 shrink-0 mt-0.5" />
                            <span className="leading-snug">{conciseAction}</span>
                          </div>
                        ) : (options?.isInformative || item.sourceContext?.classification === 'informational') ? (
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

                      {/* Column 4: Source (Clickable) */}
                      <td className="py-3.5 px-4 align-top text-right">
                        <div className="inline-flex items-center justify-end pt-0.5">
                          {renderClickableSource(item)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile View (< md screens): Responsive stacked format with exact same 4 data columns */}
          <div className="md:hidden divide-y divide-slate-100">
            {items.map(item => {
              const schedule = getItemSchedule(item, currentTime);
              const formattedDate = formatRelevantDateText(item, schedule);
              const titleText = formatTitleText(item.title);
              const isTodayDue = schedule.kind === 'deadline' && schedule.diffDays === 0 && !schedule.isPast;
              const conciseAction = item.sourceContext?.nextStep || item.action;

              let dateColor = 'text-slate-700';

              if (schedule.kind === 'event') {
                dateColor = 'text-sky-700 font-medium';
              } else if (schedule.kind === 'program') {
                dateColor = 'text-indigo-700 font-medium';
              } else if (schedule.kind === 'window') {
                dateColor = 'text-emerald-700 font-medium';
              } else {
                if (schedule.isPast) {
                  dateColor = 'text-rose-600 font-medium';
                } else if (isTodayDue) {
                  dateColor = 'text-amber-700 font-semibold';
                } else {
                  dateColor = 'text-slate-700';
                }
              }

              if (options?.isNoDeadline || formattedDate === 'No deadline') {
                dateColor = 'text-slate-400';
              } else if (options?.isInformative || item.sourceContext?.classification === 'informational') {
                dateColor = 'text-slate-500';
              }

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedResponsibility(item)}
                  className={`p-3.5 hover:bg-slate-50 transition-colors cursor-pointer space-y-2.5 ${
                    options?.isMissed ? 'opacity-85' : ''
                  }`}
                >
                  {/* Top: Priority + Title + Clickable Source */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <div className="shrink-0 mt-0.5">
                        {schedule.kind === 'event' ? (
                          <div className="w-4 h-4 rounded-full bg-sky-100 border border-sky-300 flex items-center justify-center text-sky-700 text-[9px] font-bold">
                            <CalendarIcon className="w-2.5 h-2.5" />
                          </div>
                        ) : schedule.kind === 'program' ? (
                          <div className="w-4 h-4 rounded-full bg-indigo-100 border border-indigo-300 flex items-center justify-center text-indigo-700 text-[9px] font-bold">
                            P
                          </div>
                        ) : schedule.kind === 'window' ? (
                          <div className="w-4 h-4 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700 text-[9px] font-bold">
                            W
                          </div>
                        ) : (
                          renderPriorityDot(item.priority)
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className={`text-xs font-semibold leading-snug truncate ${
                          options?.isMissed ? 'text-slate-400' : 'text-slate-800'
                        }`}>
                          {titleText}
                        </h3>
                        {item.category && (
                          <span className="text-xs text-slate-400 capitalize">{item.category}</span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0" onClick={e => e.stopPropagation()}>
                      {renderClickableSource(item)}
                    </div>
                  </div>

                  {/* Action Required */}
                  {conciseAction ? (
                    <div className="flex items-start gap-1.5 text-xs text-blue-700 font-medium pl-6">
                      <ArrowRight className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                      <span className="leading-snug">{conciseAction}</span>
                    </div>
                  ) : (options?.isInformative || item.sourceContext?.classification === 'informational') ? (
                    <div className="text-xs text-slate-500 pl-6">
                      <span>No action required</span>
                    </div>
                  ) : null}

                  {/* Deadline / Date & Time */}
                  <div className="text-xs pl-6 pt-0.5">
                    <span className={dateColor}>{formattedDate}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-8">
        {/* Page Header with Automatic Background Sync Status */}
        <div className="pb-5 border-b border-slate-200/80 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                <CheckSquare className="w-6 h-6 text-[#1a68f0]" />
                Your Responsibilities
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                LifeSynch analyzes complete Gmail messages and Calendar commitments to prioritize what you actually need to do.
              </p>
            </div>

            {/* Subtle Real-time Connection / Sync Status */}
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 text-xs text-slate-600 font-medium shadow-2xs">
                <span className={`w-1.5 h-1.5 rounded-full ${syncError ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                <span>
                  {syncError 
                    ? 'Sync paused' 
                    : `Auto-sync active · ${lastSyncTime ? formatRelativeTime(lastSyncTime.toISOString()) : 'just now'}`}
                </span>
              </span>
            </div>
          </div>

          {/* Section Navigation Indicators placed directly below the page heading */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            {/* 1. Your Day */}
            <button
              type="button"
              onClick={() => scrollToSection('section-your-day')}
              className={`p-3 rounded-2xl border text-left flex items-center justify-between gap-3 cursor-pointer shadow-xs transition-all ${
                yourDayList.length > 0
                  ? 'bg-amber-50/80 border-amber-200 hover:bg-amber-100/70'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  yourDayList.length > 0 
                    ? 'bg-amber-100 text-amber-700 border border-amber-200' 
                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                }`}>
                  <Clock className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-800 truncate">Your Day</div>
                  <div className="text-xs text-slate-500 truncate">Due today</div>
                </div>
              </div>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${
                yourDayList.length > 0
                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}>
                {yourDayList.length}
              </span>
            </button>

            {/* 2. Upcoming */}
            <button
              type="button"
              onClick={() => scrollToSection('section-upcoming')}
              className={`p-3 rounded-2xl border text-left flex items-center justify-between gap-3 cursor-pointer shadow-xs transition-all ${
                upcomingList.length > 0
                  ? 'bg-indigo-50/80 border-indigo-200 hover:bg-indigo-100/70'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  upcomingList.length > 0 
                    ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' 
                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                }`}>
                  <CalendarIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-800 truncate">Upcoming</div>
                  <div className="text-xs text-slate-500 truncate">Tomorrow & future</div>
                </div>
              </div>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${
                upcomingList.length > 0
                  ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}>
                {upcomingList.length}
              </span>
            </button>

            {/* 3. Passed */}
            <button
              type="button"
              onClick={() => scrollToSection('section-passed')}
              className={`p-3 rounded-2xl border text-left flex items-center justify-between gap-3 cursor-pointer shadow-xs transition-all ${
                passedList.length > 0
                  ? 'bg-slate-100/80 border-slate-300 hover:bg-slate-200/70'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 border border-slate-200 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-800 truncate">Passed</div>
                  <div className="text-xs text-slate-500 truncate">Past deadlines</div>
                </div>
              </div>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full border shrink-0 bg-slate-100 text-slate-600 border-slate-200">
                {passedList.length}
              </span>
            </button>

            {/* 4. Informative */}
            <button
              type="button"
              onClick={() => scrollToSection('section-informative')}
              className={`p-3 rounded-2xl border text-left flex items-center justify-between gap-3 cursor-pointer shadow-xs transition-all ${
                informationalTasks.length > 0
                  ? 'bg-teal-50/80 border-teal-200 hover:bg-teal-100/70'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  informationalTasks.length > 0
                    ? 'bg-teal-100 text-teal-700 border border-teal-200'
                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                }`}>
                  <Mail className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-800 truncate">Informative</div>
                  <div className="text-xs text-slate-500 truncate">No action required</div>
                </div>
              </div>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${
                informationalTasks.length > 0
                  ? 'bg-teal-100 text-teal-800 border-teal-300'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}>
                {informationalTasks.length}
              </span>
            </button>
          </div>
        </div>

        {/* 1. YOUR DAY */}
        <section id="section-your-day" className="space-y-3 scroll-mt-6">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-amber-600" />
              <h2 className="text-xs font-bold text-slate-800 tracking-wider uppercase">
                Your Day
              </h2>
              <span className="text-xs text-slate-500 font-normal">
                (Due today)
              </span>
            </div>
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
              yourDayList.length > 0
                ? 'text-amber-800 bg-amber-50 border-amber-200'
                : 'text-slate-500 bg-slate-100 border-slate-200'
            }`}>
              {yourDayList.length}
            </span>
          </div>

          {yourDayList.length === 0 ? (
            <div className="p-4 rounded-2xl bg-white/70 border border-slate-200/80 text-xs text-slate-500 text-center shadow-xs">
              No responsibilities due today.
            </div>
          ) : (
            renderResponsibilityTable(yourDayList)
          )}
        </section>

        {/* 2. UPCOMING */}
        <section id="section-upcoming" className="space-y-3 scroll-mt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
            <div className="flex items-center gap-2.5">
              <CalendarIcon className="w-4 h-4 text-indigo-600" />
              <h2 className="text-xs font-bold text-slate-800 tracking-wider uppercase">
                Upcoming
              </h2>
              <span className="text-xs text-slate-500 font-normal">
                (Tomorrow & future commitments)
              </span>
            </div>

            {/* Sub-filter tabs */}
            <div className="flex items-center gap-1.5 self-start sm:self-auto">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'deadlines', label: 'Deadlines' },
                  { id: 'windows', label: 'App Windows' },
                  { id: 'events', label: 'Events / Meetings' }
                ] as const
              ).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setUpcomingFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    upcomingFilter === tab.id
                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {filteredUpcomingList.length === 0 ? (
            <div className="p-4 rounded-2xl bg-white/70 border border-slate-200/80 text-xs text-slate-500 text-center shadow-xs">
              {upcomingFilter === 'all' 
                ? 'No upcoming responsibilities scheduled.' 
                : `No upcoming ${upcomingFilter} found.`}
            </div>
          ) : (
            renderResponsibilityTable(filteredUpcomingList)
          )}
        </section>

        {/* 3. PASSED */}
        {passedList.length > 0 && (
          <section id="section-passed" className="space-y-3 scroll-mt-6">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <h2 className="text-xs font-bold text-slate-800 tracking-wider uppercase">
                  Passed
                </h2>
                <span className="text-xs text-slate-500 font-normal">
                  (Past deadlines & concluded commitments)
                </span>
              </div>
              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                {passedList.length}
              </span>
            </div>

            {renderResponsibilityTable(passedList, { isMissed: true })}
          </section>
        )}

        {/* 4. INFORMATIVE */}
        {informationalTasks.length > 0 && (
          <section id="section-informative" className="space-y-3 scroll-mt-6">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-teal-600" />
                <h2 className="text-xs font-bold text-slate-800 tracking-wider uppercase">
                  Informative
                </h2>
                <span className="text-xs text-slate-500 font-normal">
                  (Information updates — no action required)
                </span>
              </div>
              <span className="text-xs font-bold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                {informationalTasks.length}
              </span>
            </div>

            {renderResponsibilityTable(informationalTasks, { isInformative: true })}
          </section>
        )}

        {/* Overall empty state when all lists are empty */}
        {yourDayList.length === 0 && upcomingList.length === 0 && passedList.length === 0 && informationalTasks.length === 0 && (
          <div className="text-center py-16 px-4 rounded-3xl border border-dashed border-slate-300 bg-white/70 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-800">You're all caught up.</h3>
            <p className="text-xs text-slate-500">No active responsibilities found.</p>
          </div>
        )}
      </div>
    );
  };




  return (
    <AppLayout
      user={user}
      onLogout={logout}
      backendConnected={isConnected}
      onRefreshHealth={fetchHealth}
      isCheckingHealth={isChecking}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      taskCount={tasks.length}
      eventCount={calendarEvents.length}
      emailCount={emails.length}
      reminders={reminders}
      onMarkReminderAsRead={handleMarkReminderAsRead}
      isSyncing={false}
      onTriggerSync={() => performBackgroundSync()}
      syncError={syncError}
    >


      {/* ── Feedback Banners ── */}
      {/* ── Auth Expiry Banner (highest priority) ── */}
      {authExpiredError && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-900">{authExpiredError}</p>
              <p className="text-xs text-amber-700 mt-0.5">Sign in again to continue syncing your Gmail and Calendar.</p>
            </div>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem(AUTH_TOKEN_KEY);
              window.location.reload();
            }}
            className="shrink-0 px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
          >
            Sign in again
          </button>
        </div>
      )}

      {/* ── Sync Error Banner ── */}
      {syncError && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed font-medium">{syncError}</div>
          </div>
          <button
            onClick={() => setSyncError(null)}
            className="shrink-0 text-rose-500 hover:text-rose-700 text-lg leading-none cursor-pointer"
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {/* Main Tab Content */}
      {activeTab === 'gmail' ? (
        /* ================= GMAIL DEDICATED VIEW ================= */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center">
                  <Mail className="w-4 h-4 text-rose-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Gmail</h2>
                  <p className="text-xs text-slate-500">{emails.length} messages synced</p>
                </div>
              </div>
            </div>
          </div>

          {isLoadingEmails ? (
            <div className="text-center py-16 space-y-3">
              <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-500">Loading messages...</p>
            </div>
          ) : emails.length === 0 ? (
            <div className="text-center py-20 px-4 rounded-3xl border border-dashed border-slate-300 bg-white/70 space-y-3 shadow-xs">
              <Inbox className="w-10 h-10 text-slate-400 mx-auto" />
              <h3 className="text-sm font-semibold text-slate-800">No emails synced</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">New messages from your Gmail account will appear here automatically.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {emails.map((email) => {
                const isExpanded = expandedEmailId === email.id;
                const initials = getSenderInitials(email.sender);
                const senderName = getSenderName(email.sender);
                const relTime = formatRelativeTime(email.receivedAt);
                return (
                  <div
                    key={email.id}
                    className="rounded-2xl bg-white border border-slate-200/80 hover:border-slate-300 shadow-xs transition-all overflow-hidden"
                  >
                    {/* Email Row */}
                    <div
                      onClick={() => setExpandedEmailId(isExpanded ? null : email.id)}
                      className="p-4 cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        {/* Sender Avatar */}
                        <div className="w-8 h-8 rounded-full bg-rose-100 border border-rose-200 flex items-center justify-center text-xs font-bold text-rose-700 shrink-0 mt-0.5">
                          {initials}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-3 mb-0.5">
                            <span className="text-xs font-semibold text-slate-800 truncate">{senderName}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs text-slate-400">{relTime}</span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                            </div>
                          </div>
                          <p className="text-xs sm:text-sm font-semibold text-slate-900 leading-snug truncate mb-1">{email.subject || '(No Subject)'}</p>
                          {email.snippet && !isExpanded && (
                            <p className="text-xs text-slate-500 line-clamp-1 leading-relaxed">{email.snippet}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Email Body */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/70">
                        <div className="px-4 py-3 flex flex-wrap gap-4 text-xs text-slate-500 border-b border-slate-200/60">
                          <span><span className="text-slate-400 font-medium">From:</span> <span className="text-slate-800">{email.sender}</span></span>
                          {email.recipient && <span><span className="text-slate-400 font-medium">To:</span> <span className="text-slate-800">{email.recipient}</span></span>}
                          {email.receivedAt && <span><span className="text-slate-400 font-medium">Date:</span> <span className="text-slate-800">{new Date(email.receivedAt).toLocaleString()}</span></span>}
                        </div>
                        <div className="p-4 text-xs text-slate-700 leading-relaxed max-h-72 overflow-y-auto whitespace-pre-wrap font-sans">
                          {email.bodyText || email.snippet || '(No text content)'}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : activeTab === 'calendar' ? (
        /* ================= GOOGLE CALENDAR DEDICATED VIEW ================= */
        <div className="space-y-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center">
              <CalendarIcon className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Google Calendar</h2>
              <p className="text-xs text-slate-500">{calendarEvents.length} events synced</p>
            </div>
          </div>

          {isLoadingCalendar ? (
            <div className="text-center py-16 space-y-3">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-500">Loading events...</p>
            </div>
          ) : sortedCalendarEvents.length === 0 ? (
            <div className="text-center py-20 px-4 rounded-3xl border border-dashed border-slate-300 bg-white/70 space-y-3 shadow-xs">
              <CalendarIcon className="w-10 h-10 text-slate-400 mx-auto" />
              <h3 className="text-sm font-semibold text-slate-800">No events found</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">Upcoming Google Calendar events will appear here automatically.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {sortedCalendarEvents.map((event) => {
                const { dateText, timeText } = formatEventTime(event.startTime, event.endTime);
                const isCancelled = event.status === 'cancelled';
                const isTentative = event.status === 'tentative';
                const accentColor = isCancelled ? 'border-l-rose-500' : isTentative ? 'border-l-amber-500' : 'border-l-[#1a68f0]';
                return (
                  <div
                    key={event.id}
                    className={`rounded-2xl border border-l-4 overflow-hidden transition-all bg-white shadow-xs hover:border-slate-300 ${accentColor} ${
                      isCancelled ? 'opacity-70' : ''
                    }`}
                  >
                    <div className="p-4 space-y-3">
                      {/* Title row */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className={`text-xs sm:text-sm font-bold leading-snug ${isCancelled ? 'line-through text-rose-500' : 'text-slate-900'}`}>
                            {event.summary || '(No Title)'}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isCancelled && (
                            <span className="text-xs px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-semibold uppercase tracking-wide">Cancelled</span>
                          )}
                          {isTentative && !isCancelled && (
                            <span className="text-xs px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 font-semibold uppercase tracking-wide">Tentative</span>
                          )}
                          {event.htmlLink && (
                            <a
                              href={event.htmlLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-[#1a68f0] hover:text-[#1557cc] font-semibold transition-colors"
                              onClick={e => e.stopPropagation()}
                            >
                              Open →
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Date & Time row */}
                      <div className="flex flex-wrap items-center gap-4 text-xs">
                        <span className="flex items-center gap-1.5 text-indigo-700 font-semibold">
                          <CalendarIcon className="w-3.5 h-3.5 text-indigo-500" />
                          {dateText}
                        </span>
                        <span className="flex items-center gap-1.5 text-slate-500">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {timeText}
                        </span>
                        {event.location && (
                          <span className="flex items-center gap-1.5 text-slate-500 truncate max-w-xs">
                            <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                            {event.location}
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      {event.description && (
                        <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{event.description}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : activeTab === 'assistant' ? (
        /* ================= ASK LIFESYNCH DEDICATED VIEW ================= */
        <div className="space-y-6">
          <div className="max-w-4xl mx-auto">
            <AskAssistant 
              compact={false} 
              onNavigateToTab={setActiveTab}
              tasks={tasks}
              emails={emails}
              calendarEvents={calendarEvents}
              onSelectResponsibility={setSelectedResponsibility}
              onSelectEmail={(emailId) => {
                setExpandedEmailId(emailId);
                setActiveTab('gmail');
              }}
              onSelectCalendarEvent={() => {
                setActiveTab('calendar');
              }}
              initialQuestion={pendingAssistantQuestion || undefined}
              onClearInitialQuestion={() => setPendingAssistantQuestion(null)}
            />
          </div>
        </div>
      ) : activeTab === 'tasks' ? (
        /* ================= RESPONSIBILITIES DEDICATED VIEW ================= */
        <div className="max-w-5xl mx-auto py-2">
          {renderGroupedResponsibilities(tasks)}
        </div>
      ) : (
        /* ================= LIFESYNCH DASHBOARD — PERSONAL INTELLIGENCE HUB ================= */
        <PersonalIntelligenceHub
          user={user}
          tasks={tasks}
          emails={emails}
          calendarEvents={calendarEvents}
          onSelectResponsibility={setSelectedResponsibility}
          onSelectEmail={(emailId) => {
            setExpandedEmailId(emailId);
            setActiveTab('gmail');
          }}
          onSelectCalendarEvent={() => {
            setActiveTab('calendar');
          }}
          onAskQuestion={handleAskQuestion}
          onUpdateTaskCategory={handleUpdateTaskCategory}
        />
      )}

      {/* Floating Action Button (FAB) matching reference image */}
      {activeTab !== 'assistant' && (
        <button
          onClick={() => handleAskQuestion('What should I focus on today?')}
          title="Ask LifeSynch AI"
          aria-label="Ask LifeSynch"
          className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-[#1a68f0] hover:bg-[#1557cc] text-white shadow-xl shadow-blue-500/30 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 z-40 cursor-pointer"
        >
          <span className="text-xl font-bold leading-none">+</span>
        </button>
      )}

      {/* ── Responsibility Details Modal (Clicking any row opens details) ── */}
      {selectedResponsibility && (
        <div 
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setSelectedResponsibility(null)}
        >
          <div 
            className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4 text-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-bold text-[#1a68f0] uppercase tracking-wider">
                  Responsibility Details
                </span>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-1 leading-snug">
                  {selectedResponsibility.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedResponsibility(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer text-lg leading-none"
              >
                ✕
              </button>
            </div>

            {selectedResponsibility.action && (
              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-1">
                <span className="text-xs font-bold text-amber-800 uppercase tracking-wider block">Action Required</span>
                <div className="flex items-center gap-2 pt-0.5">
                  {renderPriorityDot(selectedResponsibility.priority)}
                  <p className="text-xs sm:text-sm font-medium text-slate-900">{selectedResponsibility.action}</p>
                </div>
              </div>
            )}

            {selectedResponsibility.sourceContext?.nextStep && (
              <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-1">
                <span className="text-xs font-bold text-blue-800 uppercase tracking-wider block">Recommended Next Step</span>
                <p className="text-xs sm:text-sm font-medium text-blue-950">{selectedResponsibility.sourceContext.nextStep}</p>
              </div>
            )}

            {(selectedResponsibility.sourceContext?.windowStartDate || selectedResponsibility.sourceContext?.windowEndDate) && (
              <div className="p-3 rounded-2xl bg-purple-50 border border-purple-200 text-xs text-purple-900 flex items-center justify-between">
                <span className="text-purple-700 font-semibold">Application Window:</span>
                <span className="font-bold">{selectedResponsibility.sourceContext.windowStartDate || 'Opens'} → {selectedResponsibility.sourceContext.windowEndDate || selectedResponsibility.dueDate}</span>
              </div>
            )}

            {selectedResponsibility.description && (
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-500">Description</span>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  {selectedResponsibility.description}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs pt-1">
              <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block mb-1">Due Date</span>
                <span className="text-slate-800 font-semibold">
                  {formatTableDueDate(selectedResponsibility.dueDate, selectedResponsibility.dueTime)}
                </span>
              </div>
              <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block mb-1">Status</span>
                <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold border ${getModalStatus(selectedResponsibility, currentTime).color}`}>
                  {getModalStatus(selectedResponsibility, currentTime).label}
                </span>
              </div>
              <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block mb-1">Source</span>
                <div className="pt-0.5">{renderSourceCell(selectedResponsibility)}</div>
              </div>
            </div>

            {(selectedResponsibility.sourceContext?.sender || selectedResponsibility.sourceContext?.location || selectedResponsibility.sourceContext?.responsibleParty) && (
              <div className="space-y-1 text-xs pt-1">
                {selectedResponsibility.sourceContext?.responsibleParty && (
                  <p className="text-slate-600">
                    <span className="text-slate-400 font-medium">Responsible:</span> <span className="capitalize text-slate-800 font-medium">{selectedResponsibility.sourceContext.responsibleParty}</span>
                  </p>
                )}
                {selectedResponsibility.sourceContext?.sender && (
                  <p className="text-slate-600">
                    <span className="text-slate-400 font-medium">From:</span> {selectedResponsibility.sourceContext.sender}
                  </p>
                )}
                {selectedResponsibility.sourceContext?.location && (
                  <p className="text-slate-600">
                    <span className="text-slate-400 font-medium">Location:</span> {selectedResponsibility.sourceContext.location}
                  </p>
                )}
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {selectedResponsibility.source === 'gmail' && selectedResponsibility.sourceId && (
                  <button
                    onClick={() => {
                      setActiveTab('gmail');
                      setExpandedEmailId(selectedResponsibility.sourceId || null);
                      setSelectedResponsibility(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    View Source in Gmail
                  </button>
                )}
                {selectedResponsibility.source === 'calendar' && (
                  <button
                    onClick={() => {
                      setActiveTab('calendar');
                      setSelectedResponsibility(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <CalendarIcon className="w-3.5 h-3.5" />
                    View in Calendar
                  </button>
                )}
              </div>
              <button
                onClick={() => setSelectedResponsibility(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [isCallbackRoute, setIsCallbackRoute] = useState(false);

  useEffect(() => {
    const isCallback = window.location.pathname.includes('/auth/callback') ||
      window.location.search.includes('token=') ||
      window.location.search.includes('error=');
    setIsCallbackRoute(isCallback);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#ebf3fe] via-[#edf3fd] to-[#f6f0fb] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-[#1a68f0] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-500">Loading LifeSynch AI...</p>
        </div>
      </div>
    );
  }

  if (isCallbackRoute) {
    return <AuthCallback onComplete={() => setIsCallbackRoute(false)} />;
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <MainDashboard />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
