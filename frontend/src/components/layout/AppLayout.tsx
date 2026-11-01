import React from 'react';
import { Navbar } from '../common/Navbar';
import { Sidebar } from '../common/Sidebar';
import { User, ReminderNotification } from '@lifesynch/shared';

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
  isSyncing?: boolean;
  onTriggerSync?: () => void;
  syncError?: string | null;
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
  isSyncing = false,
  onTriggerSync,
  syncError
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
        onNavigateToTab={setActiveTab}
        isSyncing={isSyncing}
        onTriggerSync={onTriggerSync}
        syncError={syncError}
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
