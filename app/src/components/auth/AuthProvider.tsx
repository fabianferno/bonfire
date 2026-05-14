'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, ApiError } from '@/lib/api';
import { getToken, setToken, clearToken } from '@/lib/auth';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
}

export type AuthStatus = 'unknown' | 'authenticated' | 'guest';

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  status: AuthStatus;
  login: (emailOrUsername: string, password: string) => Promise<void>;
  register: (input: {
    email: string;
    username: string;
    password: string;
    displayName: string;
  }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

interface AuthLoginResponse {
  token: string;
  user: AuthUser;
}

interface AuthMeResponse {
  user: AuthUser;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  // Initialise token from localStorage synchronously (safe — runs only on client).
  // This avoids calling setState inside an effect for the "no token" fast-path.
  const [token, setTokenState] = useState<string | null>(() =>
    typeof window !== 'undefined' ? getToken() : null,
  );
  // If there is no stored token we can start as 'guest' immediately.
  const [status, setStatus] = useState<AuthStatus>(() =>
    typeof window !== 'undefined' && getToken() ? 'unknown' : 'guest',
  );

  // On mount, attempt to restore session from localStorage only when a token exists.
  useEffect(() => {
    if (!token) return;

    api<AuthMeResponse>('GET', '/v1/auth/me')
      .then(({ user: me }) => {
        setUser(me);
        setStatus('authenticated');
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) {
          clearToken();
          setTokenState(null);
        }
        // Non-401 errors: keep the token so a retry could work.
        setStatus('guest');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (emailOrUsername: string, password: string) => {
    const { token: t, user: u } = await api<AuthLoginResponse>(
      'POST',
      '/v1/auth/login',
      { emailOrUsername, password },
      { auth: false },
    );
    setToken(t);
    setTokenState(t);
    setUser(u);
    setStatus('authenticated');
  }, []);

  const register = useCallback(
    async (input: {
      email: string;
      username: string;
      password: string;
      displayName: string;
    }) => {
      const { token: t, user: u } = await api<AuthLoginResponse>(
        'POST',
        '/v1/auth/register',
        input,
        { auth: false },
      );
      setToken(t);
      setTokenState(t);
      setUser(u);
      setStatus('authenticated');
    },
    [],
  );

  const logout = useCallback(() => {
    clearToken();
    setTokenState(null);
    setUser(null);
    setStatus('guest');
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, status, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
