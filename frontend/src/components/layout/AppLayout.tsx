import React from 'react';
import { Navbar } from '../common/Navbar';
import { Sidebar } from '../common/Sidebar';
import { User, ReminderNotification, Responsibility, CalendarEventRecord, EmailRecord } from '@lifesynch/shared';

interface AppLayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
  backendConnected: boolean | null;
  onRefreshHealth: () => void;
  isCheckingHealth: boolean;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  taskCount?: number;
  eventCount?: number;
  emailCount?: number;
  reminders?: ReminderNotification[];
  onMarkReminderAsRead?: (id: string) => void;
  onMarkAllRemindersAsRead?: () => void;
  isSyncing?: boolean;
  onTriggerSync?: () => void;
  syncError?: string | null;

  // Global Search
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

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  user,
  onLogout,
  backendConnected,
  onRefreshHealth,
  isCheckingHealth,
  activeTab,
  setActiveTab,
  taskCount = 0,
  eventCount = 0,
  emailCount = 0,
  reminders = [],
  onMarkReminderAsRead,
  onMarkAllRemindersAsRead,
  isSyncing = false,
  onTriggerSync,
  syncError,

  searchQuery,
  onSearchQueryChange,
  tasks,
  calendarEvents,
  emails,
  onSelectResponsibility,
  onSelectCalendarEvent,
  onSelectEmail,
  onSubmitSearch,
  onClearSearch
}) => {
  return (
    <div className="h-screen max-h-screen flex flex-col text-slate-800 overflow-hidden">
      <Navbar
        user={user}
        onLogout={onLogout}
        backendConnected={backendConnected}
        onRefreshHealth={onRefreshHealth}
        isCheckingHealth={isCheckingHealth}
        reminders={reminders}
        onMarkReminderAsRead={onMarkReminderAsRead}
        onMarkAllRemindersAsRead={onMarkAllRemindersAsRead}
        onNavigateToTab={setActiveTab}
        isSyncing={isSyncing}
        onTriggerSync={onTriggerSync}
        syncError={syncError}

        searchQuery={searchQuery}
        onSearchQueryChange={onSearchQueryChange}
        tasks={tasks}
        calendarEvents={calendarEvents}
        emails={emails}
        onSelectResponsibility={onSelectResponsibility}
        onSelectCalendarEvent={onSelectCalendarEvent}
        onSelectEmail={onSelectEmail}
        onSubmitSearch={onSubmitSearch}
        onClearSearch={onClearSearch}
      />
      <div className="flex-1 flex overflow-hidden min-h-0">
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab}
          taskCount={taskCount}
          eventCount={eventCount}
          emailCount={emailCount}
          googleConnected={Boolean(user)}
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
