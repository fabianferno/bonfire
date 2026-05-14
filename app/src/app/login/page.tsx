'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(emailOrUsername.trim(), password);
      router.push('/workspace');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="h-full flex items-center justify-center px-6"
      style={{ background: 'var(--bf-tertiary)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8"
        style={{ background: 'var(--bf-secondary)' }}
      >
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🔥</div>
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--bf-gray)' }}>
            Sign in to your BonFire account
          </p>
        </div>

        {error && (
          <div
            className="rounded-lg px-4 py-3 mb-4 text-sm"
            style={{ background: 'rgba(240,71,71,0.15)', color: 'var(--bf-red)' }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--bf-gray)' }}>
              Email or Username
            </label>
            <input
              type="text"
              autoComplete="username"
              required
              value={emailOrUsername}
              onChange={e => setEmailOrUsername(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-2"
              style={{
                background: 'var(--bf-chat-input)',
                border: '1px solid transparent',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ['--tw-ring-color' as any]: 'var(--bf-fire)',
              }}
              placeholder="you@example.com"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--bf-gray)' }}>
              Password
            </label>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-2"
              style={{
                background: 'var(--bf-chat-input)',
                border: '1px solid transparent',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ['--tw-ring-color' as any]: 'var(--bf-fire)',
              }}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg py-2.5 font-semibold text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: 'var(--bf-fire)' }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: 'var(--bf-gray)' }}>
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-semibold text-white hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
