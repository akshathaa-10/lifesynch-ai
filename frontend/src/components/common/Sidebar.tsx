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
    <aside className="w-60 border-r border-[#283e48] bg-[#34515e] text-white flex flex-col justify-between p-3.5 hidden md:flex shrink-0 h-full overflow-y-auto select-none shadow-md">
      <div className="space-y-5">
        {/* Top Styled Wordmark matching reference image logo */}
        <div className="pt-2 pb-4 text-center border-b border-white/10">
          <div 
            onClick={() => setActiveTab('dashboard')}
            className="cursor-pointer inline-flex items-center gap-1.5 group"
          >
            <span className="font-serif italic text-2xl text-white tracking-wide font-normal group-hover:scale-105 transition-transform">
              LifeSynch
            </span>
            <Sparkles className="w-3.5 h-3.5 text-sky-300" />
          </div>
        </div>

        {/* Navigation Section */}
        <div>
          <div className="flex items-center justify-between px-3 mb-2">
            <span className="text-[10px] font-bold text-sky-200/70 uppercase tracking-widest">
              Navigation
            </span>
          </div>
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-all duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-white text-[#34515e] font-bold shadow-md'
                      : 'text-slate-200 hover:text-white hover:bg-white/10 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#34515e]' : 'text-slate-300'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-[#e2edf2] text-[#34515e]'
                          : 'bg-white/15 text-white/90'
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
          <div className="flex items-center justify-between px-3 mb-2">
            <span className="text-[10px] font-bold text-sky-200/70 uppercase tracking-widest">
              Integrations
            </span>
          </div>
          <div className="space-y-1">
            {/* Google / Gmail */}
            <button
              onClick={() => setActiveTab('gmail')}
              className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs text-slate-200 hover:text-white hover:bg-white/10 transition-colors group cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <span className={`w-1.5 h-1.5 rounded-full ${googleConnected ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-slate-400'}`} />
                <span className="font-medium group-hover:text-white transition-colors">Gmail</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-colors" />
            </button>

            {/* Google Calendar */}
            <button
              onClick={() => setActiveTab('calendar')}
              className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs text-slate-200 hover:text-white hover:bg-white/10 transition-colors group cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <span className={`w-1.5 h-1.5 rounded-full ${googleConnected ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-slate-400'}`} />
                <span className="font-medium group-hover:text-white transition-colors">Calendar</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-colors" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Shortcuts / Status */}
      <div className="pt-3.5 border-t border-white/10 space-y-2">
        <button
          onClick={() => setActiveTab('assistant')}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs bg-white/10 hover:bg-white/15 text-white/90 border border-white/10 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-300" />
            <span className="font-medium">Search or Ask AI</span>
          </div>
          <span className="flex items-center text-[10px] text-[#34515e] bg-white font-bold px-1.5 py-0.5 rounded-md shadow-xs">
            <Command className="w-2.5 h-2.5 mr-0.5" /> K
          </span>
        </button>

        <div className="flex items-center justify-between px-3 py-1.5 text-xs text-sky-200/80">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-300" />
            <span className="truncate text-[11px]">Encrypted & Scoped</span>
          </div>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        </div>
      </div>
    </aside>
  );
};
