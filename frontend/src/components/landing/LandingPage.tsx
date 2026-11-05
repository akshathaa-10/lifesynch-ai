import React from 'react';
import { 
  Sparkles, 
  Mail, 
  Calendar as CalendarIcon, 
  Clock, 
  ArrowRight, 
  ShieldCheck, 
  Lock, 
  Zap 
} from 'lucide-react';

interface LandingPageProps {
  onGoToLogin: () => void;
  onLoginWithGoogle?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ 
  onGoToLogin
}) => {
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-[#edf2f6] text-slate-800 antialiased selection:bg-slate-200 selection:text-slate-900 flex flex-col relative overflow-x-hidden">
      {/* ================= Ambient Background Grid & Glow ================= */}
      <div 
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none opacity-35"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #94a3b8 1px, transparent 0)`,
          backgroundSize: '28px 28px'
        }}
      />
      <div 
        aria-hidden="true"
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[720px] h-[360px] bg-gradient-to-b from-[#34515e]/12 via-indigo-500/5 to-transparent rounded-full blur-[100px] pointer-events-none" 
      />

      {/* ================= 1. Top Navbar ================= */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between relative z-10">
          {/* Logo & Brand on Left */}
          <div 
            className="flex items-center gap-2.5 cursor-pointer select-none group" 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <div className="w-9 h-9 rounded-xl bg-[#34515e] border border-[#283e48] flex items-center justify-center shadow-xs transition-transform group-hover:scale-102">
              <Sparkles className="w-4 h-4 text-sky-300" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-serif italic text-xl tracking-tight text-slate-900 font-semibold">
                LifeSynch
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#e2edf2] text-[#34515e] border border-[#c2dde6]">
                AI
              </span>
            </div>
          </div>

          {/* Simple Navigation Links */}
          <nav className="flex items-center gap-5 sm:gap-8 text-xs sm:text-sm font-medium text-slate-600">
            <button 
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} 
              className="hover:text-slate-900 transition-colors cursor-pointer py-1"
            >
              Home
            </button>
            <button 
              onClick={() => scrollTo('features')} 
              className="hover:text-slate-900 transition-colors cursor-pointer py-1"
            >
              Features
            </button>
            <button 
              onClick={() => scrollTo('about')} 
              className="hover:text-slate-900 transition-colors cursor-pointer py-1"
            >
              About
            </button>
          </nav>
        </div>
      </header>

      {/* ================= Hero Section ================= */}
      <section className="pt-20 pb-20 px-4 sm:px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          {/* Subtle Project Tag */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/90 border border-slate-200/90 text-slate-700 text-xs font-semibold shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-[#34515e]" />
            <span>Autonomous Day Organization</span>
          </div>

          {/* Hero Heading */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.12]">
            Your day, <span className="bg-gradient-to-r from-slate-900 via-[#34515e] to-indigo-700 bg-clip-text text-transparent">organized automatically.</span>
          </h1>

          {/* Short Description */}
          <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-600 font-normal leading-relaxed">
            LifeSynch AI connects your Gmail and Google Calendar to automatically parse announcements, prioritize upcoming events, and keep your daily schedule seamlessly on track.
          </p>

          {/* Action Button - Goes directly to login page */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <button
              onClick={onGoToLogin}
              className="w-full sm:w-auto px-6 py-3.5 bg-[#34515e] hover:bg-[#283e48] active:bg-[#1a2d36] text-white text-sm font-bold rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2.5 cursor-pointer group"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <button
              onClick={() => scrollTo('features')}
              className="w-full sm:w-auto px-5 py-3.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 font-semibold text-sm rounded-2xl shadow-2xs transition-colors cursor-pointer"
            >
              See How It Works
            </button>
          </div>

          {/* Trust Highlights */}
          <div className="pt-4 flex items-center justify-center gap-6 text-xs text-slate-500 flex-wrap">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Read-only Google OAuth</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-emerald-600" />
              <span>Private user isolation</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Zero manual entry</span>
            </span>
          </div>
        </div>
      </section>

      {/* ================= 2. Features Section ================= */}
      <section id="features" className="py-16 px-4 sm:px-6 relative z-10 border-t border-slate-200/80 bg-white/70 backdrop-blur-xs">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="max-w-2xl mx-auto text-center space-y-2.5">
            <span className="text-xs font-bold text-[#34515e] uppercase tracking-widest">
              Core Capabilities
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Intelligence built for daily clarity.
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Three focused mechanisms that transform unstructured communication into clear, organized action.
            </p>
          </div>

          {/* 3 Focused Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 1. Email Understanding */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
                <Mail className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Email Understanding</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                Analyzes incoming email threads, cleans forwarded noise and signature clutter, and pinpoints key announcements and updates automatically.
              </p>
            </div>

            {/* 2. Calendar Integration */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center">
                <CalendarIcon className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Calendar Integration</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                Harmonizes Google Calendar events alongside announcements into a unified timeline so meetings and preparation are never missed.
              </p>
            </div>

            {/* 3. Intelligent Reminders */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Intelligent Reminders</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                Proactive time-sensitive notifications adapt dynamically as commitments approach, prioritizing what matters without alert fatigue.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 3. About Section ================= */}
      <section id="about" className="py-16 px-4 sm:px-6 relative z-10 border-t border-slate-200/80">
        <div className="max-w-3xl mx-auto space-y-8 text-center">
          <div className="space-y-2">
            <span className="text-xs font-bold text-[#34515e] uppercase tracking-widest">
              Why LifeSynch AI
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Ending the chore of manual task management.
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Traditional productivity tools demand continuous typing, tagging, and scheduling. LifeSynch AI connects directly to where your commitments already live, giving you true clarity with zero friction.
            </p>
          </div>

          {/* Architecture Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-1.5">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-xs sm:text-sm">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Read-Only Privacy</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Operates strictly with read-only Gmail and Google Calendar scopes. Your credentials and messages remain private and isolated.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-1.5">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-xs sm:text-sm">
                <Sparkles className="w-4 h-4 text-[#34515e] shrink-0" />
                <span>Contextual Discovery</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Highlights campus announcements, career challenges, and program updates in a structured Worth Knowing view instead of raw email bodies.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 4. Google Workspace Integration (Immediately Before Footer) ================= */}
      <section className="py-14 px-4 sm:px-6 relative z-10 border-t border-slate-200/80 bg-white/50 backdrop-blur-xs">
        <div className="max-w-4xl mx-auto text-center space-y-5">
          {/* Requested Heading & Description */}
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Seamlessly Connected with Google Workspace
            </h2>
            <p className="max-w-xl mx-auto text-xs sm:text-sm text-slate-600 leading-relaxed">
              LifeSynch AI connects with your Google services to understand your emails and calendar events automatically.
            </p>
          </div>

          {/* Clean Horizontal Layout with Gmail & Google Calendar */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
            {/* Gmail Card */}
            <div className="w-full sm:w-1/2 p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex items-center gap-3.5 text-left">
              <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <path d="M20.5 4h-17A1.5 1.5 0 002 5.5v13A1.5 1.5 0 003.5 20h17a1.5 1.5 0 001.5-1.5v-13A1.5 1.5 0 0020.5 4z" fill="#fef2f2" stroke="#EA4335" strokeWidth="1.5"/>
                  <path d="M2.5 5.5l9.5 7 9.5-7" stroke="#EA4335" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-slate-900">Gmail</h4>
                <p className="text-[11px] text-slate-500 truncate">Automatic email parsing</p>
              </div>
            </div>

            {/* Google Calendar Card */}
            <div className="w-full sm:w-1/2 p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex items-center gap-3.5 text-left">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="4" width="18" height="17" rx="2.5" fill="#eff6ff" stroke="#1a73e8" strokeWidth="1.5"/>
                  <path d="M3 8.5h18" stroke="#1a73e8" strokeWidth="1.5"/>
                  <path d="M8 2.5v3M16 2.5v3" stroke="#1a73e8" strokeWidth="1.8" strokeLinecap="round"/>
                  <text x="12" y="16.5" textAnchor="middle" fill="#1a73e8" fontSize="7.5" fontWeight="bold" fontFamily="system-ui, sans-serif">31</text>
                </svg>
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-slate-900">Google Calendar</h4>
                <p className="text-[11px] text-slate-500 truncate">Live schedule sync</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 5. Structured SaaS Footer ================= */}
      <footer className="mt-auto border-t border-slate-200/90 bg-white/80 backdrop-blur-xs text-slate-600 relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 sm:gap-10 pb-10">
            {/* LifeSynch AI Logo & Short Description */}
            <div className="md:col-span-6 space-y-3.5">
              <div 
                className="flex items-center gap-2.5 cursor-pointer inline-flex select-none"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              >
                <div className="w-8 h-8 rounded-xl bg-[#34515e] border border-[#283e48] flex items-center justify-center shadow-xs">
                  <Sparkles className="w-4 h-4 text-sky-300" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-serif italic text-lg tracking-tight text-slate-900 font-semibold">
                    LifeSynch
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#e2edf2] text-[#34515e] border border-[#c2dde6]">
                    AI
                  </span>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 max-w-sm leading-relaxed">
                Autonomous day organization connecting Gmail and Google Calendar into a calm, unified daily briefing.
              </p>
            </div>

            {/* Quick Links: Home, Features, About */}
            <div className="md:col-span-3 space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Quick Links
              </h4>
              <ul className="space-y-2 text-xs sm:text-sm font-medium text-slate-600">
                <li>
                  <button 
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} 
                    className="hover:text-slate-900 transition-colors cursor-pointer"
                  >
                    Home
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => scrollTo('features')} 
                    className="hover:text-slate-900 transition-colors cursor-pointer"
                  >
                    Features
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => scrollTo('about')} 
                    className="hover:text-slate-900 transition-colors cursor-pointer"
                  >
                    About
                  </button>
                </li>
              </ul>
            </div>

            {/* Clean Product / Brand Information Area */}
            <div className="md:col-span-3 space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Security & Platform
              </h4>
              <ul className="space-y-2.5 text-xs sm:text-sm text-slate-500">
                <li className="flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Read-Only Scopes</span>
                </li>
                <li className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Private User Isolation</span>
                </li>
                <li className="flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>Zero Manual Data Entry</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Subtle Divider */}
          <div className="border-t border-slate-200/90 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <p>© {new Date().getFullYear()} LifeSynch AI. All rights reserved.</p>
            <p className="text-[11px] text-slate-400">Autonomous calendar & inbox intelligence.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
