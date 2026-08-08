import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AuthResponseDto, LoginDto, RegisterDto } from '@sportspace/shared';
import { authApi, setUnauthorizedHandler } from '../api/client';
import { clearSession, loadSession, saveSession } from './session';

interface AuthUser {
  userId: string;
  role: AuthResponseDto['role'];
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (dto: LoginDto) => Promise<void>;
  register: (dto: RegisterDto) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    loadSession().then((session) => {
      if (!mounted) return;
      if (session) {
        setUser({ userId: session.userId, role: session.role });
      }
      setIsLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const logout = useCallback(async () => {
    await clearSession();
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void logout();
    });
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const applyAuthResponse = useCallback(async (auth: AuthResponseDto) => {
    await saveSession(auth);
    setUser({ userId: auth.userId, role: auth.role });
  }, []);

  const login = useCallback(
    async (dto: LoginDto) => {
      const { data } = await authApi.authControllerLogin(dto);
      await applyAuthResponse(data);
    },
    [applyAuthResponse],
  );

  const register = useCallback(
    async (dto: RegisterDto) => {
      const { data } = await authApi.authControllerRegister(dto);
      await applyAuthResponse(data);
    },
    [applyAuthResponse],
  );

  const value = useMemo(
    () => ({ user, isLoading, login, register, logout }),
    [user, isLoading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
