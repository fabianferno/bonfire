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
  // Start identical on server and client to avoid hydration mismatch.
  // The real token (from localStorage) is loaded in useEffect, post-hydration.
  const [token, setTokenState] = useState<string | null>(null);
  const [status, setStatus] = useState<AuthStatus>('unknown');

  // On mount (client only): read token, attempt /me, settle into authenticated/guest.
  useEffect(() => {
    const t = getToken();
    if (!t) { setStatus('guest'); return; }
    setTokenState(t);

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
