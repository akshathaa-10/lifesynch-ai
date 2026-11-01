import React from 'react';
import { Sparkles, Shield, Mail, Calendar, Key, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/Button';
import { Card } from '../common/Card';

export const LoginPage: React.FC = () => {
  const { loginWithGoogle, isLoading, error } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#ebf3fe] via-[#edf3fd] to-[#f6f0fb] flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden text-slate-800">
      {/* Background soft pastel glow orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-blue-400/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[350px] h-[350px] bg-purple-400/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-md w-full relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#1a68f0] to-[#60a5fa] items-center justify-center shadow-lg shadow-blue-500/20 mb-1">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            LifeSynch AI
          </h1>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            AI-powered personal digital life management. Automatically convert Gmail communications and Calendar commitments into structured responsibilities.
          </p>
        </div>

        {/* Login Card */}
        <Card className="p-7 space-y-6 border-slate-200/80 bg-white/95 backdrop-blur-xl shadow-2xl rounded-3xl">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 text-center">
              Student / Personal Authentication
            </div>

            {/* Google OAuth Login Button */}
            <Button
              onClick={loginWithGoogle}
              isLoading={isLoading}
              variant="outline"
              className="w-full py-3.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-bold flex items-center justify-center gap-3 shadow-sm hover:shadow-md transition-all rounded-2xl"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.94 0 12s.46 3.84 1.26 5.42l4.02-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>Continue with Google</span>
            </Button>
          </div>

          {/* Privacy & Scope Disclosure */}
          <div className="pt-4 border-t border-slate-100 space-y-3 text-xs text-slate-500">
            <div className="font-semibold text-slate-700 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-emerald-600" />
              <span>Requested Google Permissions</span>
            </div>
            <ul className="space-y-2 pl-1">
              <li className="flex items-start gap-2">
                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span><strong className="text-slate-800">Gmail (Read-Only)</strong>: Detect actionable deadlines and tasks from your incoming emails.</span>
              </li>
              <li className="flex items-start gap-2">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span><strong className="text-slate-800">Calendar (Read-Only)</strong>: Correlate tasks with scheduled meetings and commitments.</span>
              </li>
            </ul>
          </div>
        </Card>

        {/* Security architecture footer */}
        <div className="p-4 rounded-2xl bg-white/80 border border-slate-200/80 text-xs text-slate-500 space-y-1.5 shadow-xs">
          <div className="flex items-center gap-2 font-semibold text-slate-700">
            <Key className="w-3.5 h-3.5 text-[#1a68f0]" />
            <span>Phase 1 Security Architecture</span>
          </div>
          <p>
            OAuth secrets are stored securely in backend environment variables. All user data is isolated per account via PostgreSQL Row Level Security (RLS) and verified via JWT tokens.
          </p>
        </div>
      </div>
    </div>
  );
};
