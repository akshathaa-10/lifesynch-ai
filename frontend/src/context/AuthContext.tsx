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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCurrentUser = useCallback(async () => {
    const currentToken = getStoredToken();
    if (!currentToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const res = await apiClient.getCurrentUser();
      if (res.data) {
        setUser(res.data);
      } else {
        // Token was invalid or expired
        removeStoredToken();
        setToken(null);
        setUser(null);
      }
    } catch (err) {
      console.warn('Authentication token verification failed:', err);
      removeStoredToken();
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
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
