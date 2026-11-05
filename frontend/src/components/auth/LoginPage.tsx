import React from 'react';
import { Sparkles, Shield, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { loginWithGoogle, isLoading, error } = useAuth();

  return (
    <div className="min-h-screen bg-[#edf2f6] flex flex-col justify-center items-center px-4 py-12 relative text-slate-800 select-none">
      {/* Subtle ambient background glow */}
      <div 
        aria-hidden="true" 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] bg-[#34515e]/5 rounded-full blur-[120px] pointer-events-none" 
      />

      <div className="max-w-[400px] w-full relative z-10">
        {/* White Login Card */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-8 sm:p-9 shadow-xl shadow-slate-200/50 space-y-7 text-center">
          
          {/* LifeSynch AI Logo */}
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-2xl bg-[#34515e] border border-[#283e48] flex items-center justify-center shadow-lg shadow-[#34515e]/20">
              <Sparkles className="w-7 h-7 text-sky-300" />
            </div>
          </div>

          {/* Heading & Tagline */}
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-[#1a2d36]">
              LifeSynch AI
            </h1>
            <p className="text-sm text-slate-500 font-normal">
              Your digital life, intelligently organized.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2.5 text-left">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* Continue with Google Button */}
          <div className="pt-1">
            <button
              onClick={loginWithGoogle}
              disabled={isLoading}
              className="w-full py-3.5 px-4 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border border-slate-300 hover:border-slate-400 font-semibold text-sm flex items-center justify-center gap-3 shadow-xs hover:shadow-sm transition-all rounded-2xl cursor-pointer active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed group"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-slate-600">Connecting...</span>
                </div>
              ) : (
                <>
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
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
                </>
              )}
            </button>
          </div>

          {/* Subtle Security Reassurance */}
          <div className="pt-1 flex items-center justify-center gap-1.5 text-xs text-slate-400">
            <Shield className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Secure & private Google authentication</span>
          </div>

        </div>
      </div>
    </div>
  );
};
