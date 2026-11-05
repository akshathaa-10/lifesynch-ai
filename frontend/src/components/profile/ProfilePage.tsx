import React from 'react';
import { 
  Mail, 
  Calendar as CalendarIcon, 
  ShieldCheck, 
  LogOut, 
  ArrowLeft 
} from 'lucide-react';
import { User } from '@lifesynch/shared';

interface ProfilePageProps {
  user: User | null;
  onLogout: () => void;
  onBack: () => void;
}

function getInitials(name?: string, email?: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email && email.trim()) {
    return email.slice(0, 2).toUpperCase();
  }
  return 'U';
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  user,
  onLogout,
  onBack
}) => {
  return (
    <div className="max-w-4xl mx-auto py-4 sm:py-6 px-4 space-y-6 text-slate-800">
      {/* Top Header & Breadcrumb */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer shadow-2xs"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Account & Profile
            </h1>
            <p className="text-xs text-slate-500 font-normal">
              Manage your personal identity and connected Google integrations.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
        >
          <LogOut className="w-3.5 h-3.5 text-rose-600" />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>

      {/* ================= 1. Profile Overview Card ================= */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-xs">
        <div className="flex items-center gap-4">
          {/* Google Profile Picture */}
          {user?.picture ? (
            <img
              src={user.picture}
              alt={user?.name || user?.email || 'User'}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-slate-200 object-cover shadow-sm"
            />
          ) : (
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#e2edf2] text-[#34515e] border-2 border-slate-200 flex items-center justify-center text-xl font-bold shadow-sm">
              {getInitials(user?.name, user?.email)}
            </div>
          )}

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
                {user?.name || 'LifeSynch User'}
              </h2>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>Google Verified</span>
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              <span>{user?.email || 'No email attached'}</span>
            </p>
          </div>
        </div>
      </div>

      {/* ================= 2. Connected Google Integrations ================= */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-xs space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>Connected Google Account</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Status of your connected Google Workspace integrations.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Connected & Active</span>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* Gmail Connection Card */}
          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Gmail Integration</h4>
                  <p className="text-[11px] text-slate-500">Read-only intelligent sync</p>
                </div>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100/70 text-emerald-800 border border-emerald-300">
                Active
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-normal">
              Analyzes emails to surface action items, deadlines, announcements, and opportunities without storing passwords.
            </p>
            <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-200/80 flex items-center justify-between">
              <span>Account:</span>
              <span className="font-medium text-slate-700">{user?.email}</span>
            </div>
          </div>

          {/* Google Calendar Connection Card */}
          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center">
                  <CalendarIcon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Google Calendar</h4>
                  <p className="text-[11px] text-slate-500">Read-only timeline sync</p>
                </div>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100/70 text-emerald-800 border border-emerald-300">
                Active
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-normal">
              Synchronizes scheduled meetings, deadlines, and project reviews with email context for zero scheduling conflicts.
            </p>
            <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-200/80 flex items-center justify-between">
              <span>Account:</span>
              <span className="font-medium text-slate-700">{user?.email}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ================= 3. Danger Zone / Logout ================= */}
      <div className="p-5 sm:p-6 rounded-3xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-xs font-bold text-slate-900">Sign Out of LifeSynch AI</h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Safely terminate your current session on this device.
          </p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="px-4 py-2 bg-white hover:bg-rose-50 text-rose-700 border border-slate-200 hover:border-rose-200 font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-2xs"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
};
