'use client';

import React from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { ogChain } from '@/lib/chain-config';

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '';

/**
 * Wraps the app in Privy's React provider.
 *
 * Must be a 'use client' component because PrivyProvider uses React context
 * and browser APIs internally. The root layout.tsx is a Server Component, so
 * we delegate the client boundary to this wrapper.
 *
 * appId is read from NEXT_PUBLIC_PRIVY_APP_ID. Set this in .env.local.
 *
 * SSR/build note: Privy validates the app ID immediately on render and throws
 * for missing/invalid IDs. When NEXT_PUBLIC_PRIVY_APP_ID is absent (e.g. in
 * a CI build without .env.local), we fall back to rendering children directly
 * so Next.js static-page generation can still succeed. At runtime the env var
 * must be set — Privy's usePrivy() hook will return ready=false until the
 * provider is properly mounted.
 */
export default function PrivyClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Privy requires exactly 25 characters in the app ID (validated internally).
  // Skip the provider during build/SSR when the env var is absent or clearly
  // invalid so static-generation prerender passes succeed.
  if (!appId || appId.length !== 25) {
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ['email', 'google', 'wallet'],
        embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
        appearance: { theme: 'dark', accentColor: '#5865F2' },
        defaultChain: ogChain,
        supportedChains: [ogChain],
      }}
    >
      {children}
    </PrivyProvider>
  );
}
