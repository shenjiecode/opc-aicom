import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface User {
  userId: number;
  username: string;
  role: string;
  vipLevel: number;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = '/api';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Fetch current user info
  const refreshUser = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/user/info`, {
        method: 'POST',
        credentials: 'include', // Include cookies
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        setUser(null);
        return;
      }

      const data = await response.json();
      if (data.code === 0 && data.data) {
        setUser({
          userId: data.data.userId,
          username: data.data.username,
          role: data.data.role,
          vipLevel: data.data.vipLevel,
        });
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  }, []);

  // Initialize: check if user is logged in
  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);
      await refreshUser();
      setIsLoading(false);
    };
    initAuth();
  }, [refreshUser]);

  // Login function
  const login = useCallback(async (username: string, password: string) => {
    const response = await fetch(`${API_BASE}/user/login`, {
      method: 'POST',
      credentials: 'include', // Include cookies
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (!response.ok || data.code !== 0) {
      throw new Error(data.message || '登录失败');
    }

    // Set user from response
    if (data.data) {
      setUser({
        userId: data.data.userId,
        username: data.data.username,
        role: 'user',
        vipLevel: 0,
      });
    }
  }, []);

  // Logout function
  const logout = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/user/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Ignore errors
    } finally {
      setUser(null);
      navigate('/login');
    }
  }, [navigate]);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: user !== null,
    login,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
