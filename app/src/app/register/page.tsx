'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';

const USERNAME_RE = /^[a-z0-9_-]{3,32}$/;

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    // Client-side validation
    if (!USERNAME_RE.test(username)) {
      setError('Username must be 3–32 characters: lowercase letters, numbers, dash, or underscore.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      await register({
        email: email.trim(),
        username: username.trim(),
        password,
        displayName: displayName.trim(),
      });
      router.push('/workspace');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="h-full flex items-center justify-center px-6 py-10 overflow-auto"
      style={{ background: 'var(--bf-tertiary)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8"
        style={{ background: 'var(--bf-secondary)' }}
      >
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🔥</div>
          <h1 className="text-2xl font-bold text-white">Create account</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--bf-gray)' }}>
            Join BonFire and start building your agent guild
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
              Email
            </label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-2"
              style={{ background: 'var(--bf-chat-input)', border: '1px solid transparent' }}
              placeholder="you@example.com"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--bf-gray)' }}>
              Username
            </label>
            <input
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={e => setUsername(e.target.value.toLowerCase())}
              className="rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-2"
              style={{ background: 'var(--bf-chat-input)', border: '1px solid transparent' }}
              placeholder="my-username"
            />
            <p className="text-xs" style={{ color: 'var(--bf-symbol)' }}>
              Lowercase letters, numbers, dash, underscore — 3 to 32 chars
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--bf-gray)' }}>
              Display Name
            </label>
            <input
              type="text"
              autoComplete="name"
              required
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-2"
              style={{ background: 'var(--bf-chat-input)', border: '1px solid transparent' }}
              placeholder="Your Name"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--bf-gray)' }}>
              Password
            </label>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-2"
              style={{ background: 'var(--bf-chat-input)', border: '1px solid transparent' }}
              placeholder="Minimum 8 characters"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg py-2.5 font-semibold text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: 'var(--bf-fire)' }}
          >
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: 'var(--bf-gray)' }}>
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-white hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
