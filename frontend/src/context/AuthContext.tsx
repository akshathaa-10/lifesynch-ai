import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '@lifesynch/shared';
import { 
  apiClient, 
  getStoredToken, 
  setStoredToken, 
  removeStoredToken 
} from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  loginWithGoogle: () => Promise<void>;
  setSession: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_CACHE_KEY = 'lifesynch_cached_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const cached = localStorage.getItem(USER_CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [isLoading, setIsLoading] = useState<boolean>(() => !getStoredToken() || !localStorage.getItem(USER_CACHE_KEY));
  const [error, setError] = useState<string | null>(null);

  const fetchCurrentUser = useCallback(async (isInitial = false) => {
    const currentToken = getStoredToken();
    if (!currentToken) {
      setUser(null);
      localStorage.removeItem(USER_CACHE_KEY);
      setIsLoading(false);
      return;
    }

    try {
      if (isInitial && !localStorage.getItem(USER_CACHE_KEY)) {
        setIsLoading(true);
      }
      setError(null);
      const res = await apiClient.getCurrentUser();
      if (res.data) {
        setUser(res.data);
        localStorage.setItem(USER_CACHE_KEY, JSON.stringify(res.data));
      } else {
        // Token was invalid or expired
        removeStoredToken();
        localStorage.removeItem(USER_CACHE_KEY);
        setToken(null);
        setUser(null);
      }
    } catch (err) {
      console.warn('Authentication token verification failed:', err);
      // Only wipe session if server explicitly rejected auth (401/403)
      if (err instanceof Error && 'statusCode' in err && ((err as any).statusCode === 401 || (err as any).statusCode === 403)) {
        removeStoredToken();
        localStorage.removeItem(USER_CACHE_KEY);
        setToken(null);
        setUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser(true);
  }, [fetchCurrentUser]);

  const loginWithGoogle = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await apiClient.getGoogleAuthUrl();
      if (res.data?.authUrl) {
        window.location.href = res.data.authUrl;
      } else {
        throw new Error('Could not retrieve Google OAuth authorization URL from server.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to initialize Google login';
      setError(msg);
      setIsLoading(false);
    }
  };

  const setSession = async (newToken: string) => {
    setStoredToken(newToken);
    setToken(newToken);
    await fetchCurrentUser();
  };

  const logout = async () => {
    try {
      await apiClient.logout().catch(() => {});
    } finally {
      removeStoredToken();
      localStorage.removeItem(USER_CACHE_KEY);
      setToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(user && token),
        isLoading,
        error,
        loginWithGoogle,
        setSession,
        logout,
        refreshUser: fetchCurrentUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
