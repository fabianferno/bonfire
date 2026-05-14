'use client';

import React, { createContext, useContext, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { setAccessTokenProvider } from '@/lib/api';

/** Shape of a resolved BonFire user. */
export interface AuthUser {
  /** Privy decentralised identifier (privyDid). */
  id: string;
  username: string;
  email: string;
  /** Privy embedded-wallet address, if one has been created for this user. */
  walletAddress: string | null;
  displayName: string;
  avatarUrl: string | null;
}

export type AuthStatus = 'unknown' | 'authenticated' | 'guest';

export interface AuthState {
  user: AuthUser | null;
  /** @deprecated Use isAuthenticated. Kept for backward compatibility. */
  token: string | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => Promise<void>;
  /** Returns the current Privy access token or null if unauthenticated. */
  getAccessToken: () => Promise<string | null>;
  /** @deprecated No-op — email/password register is replaced by Privy. Kept so legacy callers compile. */
  register: (input: {
    email: string;
    username: string;
    password: string;
    displayName: string;
  }) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Builds an AuthUser from Privy user claims. */
function buildUser(privyUser: NonNullable<ReturnType<typeof usePrivy>['user']>): AuthUser {
  const emailAddress = privyUser.email?.address ?? '';

  const username = emailAddress ? emailAddress.split('@')[0] : privyUser.id;
  const displayName = username;

  const wallet = privyUser.wallet?.address ?? null;

  return {
    id: privyUser.id,
    email: emailAddress,
    username,
    displayName,
    walletAddress: wallet,
    avatarUrl: null,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy();

  // Wire the Privy token provider into the api module so every api() call
  // automatically attaches the correct Authorization header without needing
  // to read localStorage.
  useEffect(() => {
    setAccessTokenProvider(async () => {
      if (!authenticated) return null;
      try {
        return await getAccessToken();
      } catch {
        return null;
      }
    });
  }, [authenticated, getAccessToken]);

  const resolvedUser = authenticated && user ? buildUser(user) : null;

  const isLoading = !ready;
  const isAuthenticated = ready && authenticated;
  const status: AuthStatus = !ready ? 'unknown' : authenticated ? 'authenticated' : 'guest';

  const value: AuthState = {
    user: resolvedUser,
    // token kept for any legacy read but always null — consumers should call getAccessToken()
    token: null,
    status,
    isAuthenticated,
    isLoading,
    login,
    logout,
    getAccessToken: async () => {
      if (!authenticated) return null;
      try {
        return await getAccessToken();
      } catch {
        return null;
      }
    },
    register: async () => {
      // No-op: email/password registration is replaced by Privy.
      // Calling login() opens the Privy modal which handles sign-up too.
      login();
    },
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
