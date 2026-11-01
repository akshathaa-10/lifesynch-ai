import React from 'react';
import {
  LayoutDashboard,
  CheckSquare,
  Calendar as CalendarIcon,
  Mail,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Search,
  Command
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  taskCount?: number;
  eventCount?: number;
  emailCount?: number;
  googleConnected?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  taskCount = 0,
  eventCount = 0,
  emailCount = 0,
  googleConnected = true
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'tasks', label: 'Responsibilities', icon: CheckSquare, badge: taskCount > 0 ? taskCount : undefined },
    { id: 'calendar', label: 'Calendar', icon: CalendarIcon, badge: eventCount > 0 ? eventCount : undefined },
    { id: 'gmail', label: 'Inbox', icon: Mail, badge: emailCount > 0 ? emailCount : undefined },
    { id: 'assistant', label: 'Ask LifeSynch', icon: Sparkles }
  ];

  return (
    <aside className="w-60 border-r border-slate-200/70 bg-white/70 backdrop-blur-xl flex flex-col justify-between p-3.5 hidden md:flex shrink-0 h-full overflow-y-auto select-none">
      <div className="space-y-6">
        {/* Navigation Section */}
        <div>
          <div className="flex items-center justify-between px-3 mb-2.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              Navigation
            </span>
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-medium transition-all duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-[#e0edfd] text-[#195de6] font-semibold shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#195de6]' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-[#195de6]/15 text-[#195de6]'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Connected Integrations Section */}
        <div>
          <div className="flex items-center justify-between px-3 mb-2.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              Integrations
            </span>
          </div>
          <div className="space-y-1">
            {/* Google / Gmail */}
            <button
              onClick={() => setActiveTab('gmail')}
              className="w-full flex items-center justify-between px-3.5 py-2 rounded-2xl text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 transition-colors group cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <span className={`w-1.5 h-1.5 rounded-full ${googleConnected ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-slate-400'}`} />
                <span className="font-medium group-hover:text-slate-900 transition-colors">Gmail</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
            </button>

            {/* Google Calendar */}
            <button
              onClick={() => setActiveTab('calendar')}
              className="w-full flex items-center justify-between px-3.5 py-2 rounded-2xl text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 transition-colors group cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <span className={`w-1.5 h-1.5 rounded-full ${googleConnected ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-slate-400'}`} />
                <span className="font-medium group-hover:text-slate-900 transition-colors">Calendar</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Shortcuts / Status */}
      <div className="pt-4 border-t border-slate-200/70 space-y-2">
        <button
          onClick={() => setActiveTab('assistant')}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-medium">Search or Ask AI</span>
          </div>
          <span className="flex items-center text-[11px] text-slate-500 bg-white px-1.5 py-0.5 rounded-md border border-slate-200 shadow-xs">
            <Command className="w-2.5 h-2.5 mr-0.5" /> K
          </span>
        </button>

        <div className="flex items-center justify-between px-3 py-1.5 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
            <span className="truncate">Encrypted & Scoped</span>
          </div>
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
        </div>
      </div>
    </aside>
  );
};
