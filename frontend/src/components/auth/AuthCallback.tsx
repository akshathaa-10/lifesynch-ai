import React, { useEffect, useState } from 'react';
import { Sparkles, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/Button';

export const AuthCallback: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const { setSession } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const error = params.get('error');

    if (error) {
      setErrorMessage(decodeURIComponent(error));
      return;
    }

    if (token) {
      setSession(token)
        .then(() => {
          // Clean search params from URL without page reload
          window.history.replaceState({}, document.title, window.location.pathname);
          onComplete();
        })
        .catch((err) => {
          setErrorMessage(err instanceof Error ? err.message : 'Session creation failed');
        });
    } else {
      setErrorMessage('No authentication token received from Google callback.');
    }
  }, [setSession, onComplete]);

  if (errorMessage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#ebf3fe] via-[#edf3fd] to-[#f6f0fb] flex items-center justify-center p-4">
        <div className="max-w-md w-full p-6 rounded-3xl bg-white border border-slate-200 text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 mx-auto flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Authentication Failed</h2>
          <p className="text-sm text-slate-600 leading-relaxed">{errorMessage}</p>
          <Button
            onClick={() => {
              window.history.replaceState({}, document.title, '/');
              onComplete();
            }}
            variant="secondary"
            className="w-full mt-4"
          >
            Return to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#ebf3fe] via-[#edf3fd] to-[#f6f0fb] flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#1a68f0] to-[#60a5fa] mx-auto flex items-center justify-center shadow-xl shadow-blue-500/25 animate-pulse">
          <Sparkles className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Verifying Google Authentication...</h2>
        <p className="text-xs text-slate-500">Securing your session and connecting your workspace</p>
      </div>
    </div>
  );
};
