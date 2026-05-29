import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface User {
  userId: number;
  username: string;
  matrixUsername?: string;
  matrixToken?: string;
  matrixUserId?: string;
  role: string;
  vipLevel: number;
  memberType: string; // normal, personal, enterprise
  verificationStatus: string; // none, pending, verified, rejected
  realName?: string;
  enterpriseName?: string;
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
const DEFAULT_TIMEOUT = 10000; // 10 seconds

// Fetch with timeout
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = DEFAULT_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('请求超时，请检查网络连接后重试');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Fetch current user info
  const refreshUser = useCallback(async () => {
    try {
      const response = await fetchWithTimeout(`${API_BASE}/user/info`, {
        method: 'POST',
        credentials: 'include',
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
          matrixUsername: data.data.matrixUsername,
          role: data.data.role,
          vipLevel: data.data.vipLevel,
          memberType: data.data.memberType || 'normal',
          verificationStatus: data.data.verificationStatus || 'none',
          realName: data.data.realName,
          enterpriseName: data.data.enterpriseName,
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
    const response = await fetchWithTimeout(`${API_BASE}/user/login`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (!response.ok || data.code !== 0) {
      throw new Error(data.message || '登录失败');
    }

    if (data.data) {
      const userData: User = {
        userId: data.data.userId,
        username: data.data.username,
        matrixUsername: data.data.matrixUsername,
        matrixToken: data.data.matrixToken,
        matrixUserId: data.data.matrixUserId,
        role: data.data.role || 'user',
        vipLevel: data.data.vipLevel || 0,
        memberType: data.data.memberType || 'normal',
        verificationStatus: data.data.verificationStatus || 'none',
      };
      setUser(userData);

      // Auto Matrix login after OPC login succeeds
      (async () => {
        try {
          console.log('[Auth] OPC login successful, starting Matrix auto-login...');
          console.log('[Auth] OPC username:', username);

          // Wait a short time for the backend async Matrix registration to complete
          await new Promise(r => setTimeout(r, 1500));

          // Call Matrix login API (backend will auto-register if user doesn't exist)
          console.log('[Auth] Calling Matrix login API...');
          const matrixResp = await fetchWithTimeout(`${API_BASE}/matrix/login`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
          }, 15000);

          const matrixData = await matrixResp.json();
          console.log('[Auth] Matrix login response:', matrixData.code === 0 ? 'success' : 'failed', matrixData.message || '');

          if (matrixData.code === 0 && matrixData.data) {
            console.log('[Auth] Matrix user ID:', matrixData.data.user_id);
            console.log('[Auth] Matrix username:', matrixData.data.matrix_username);
            console.log('[Auth] Matrix auto-login completed successfully');
            setUser(prev => prev ? {
              ...prev,
              matrixToken: matrixData.data.access_token,
              matrixUserId: matrixData.data.user_id,
              matrixUsername: matrixData.data.matrix_username || prev.matrixUsername,
            } : prev);
          } else {
            console.warn('[Auth] Matrix auto-login failed:', matrixData.message);
          }
        } catch (matrixErr) {
          console.warn('[Auth] Matrix auto-login error:', matrixErr instanceof Error ? matrixErr.message : matrixErr);
        }
      })();
    }
  }, []);

  // Logout function
  const logout = useCallback(async () => {
    try {
      await fetchWithTimeout(`${API_BASE}/user/logout`, {
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