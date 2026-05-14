'use client';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { bf } from '@/lib/api-bonfire';
import { useAuth } from '@/components/auth/AuthProvider';
import type { BackendAgent } from '@/lib/types';
import AgentCard from '@/components/marketplace/AgentCard';
import InviteToServerModal from '@/components/marketplace/InviteToServerModal';

function MarketplaceContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { status } = useAuth();

  const q = params.get('q') ?? '';
  const tag = params.get('tag') ?? '';

  const [agents, setAgents] = useState<BackendAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteTarget, setInviteTarget] = useState<BackendAgent | null>(null);
  // query is the controlled input value for the search input only; updated on submit
  const [query, setQuery] = useState(q);

  // Use a ref to track cancellation so setState calls only happen in async callbacks
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    bf.listAgents({ q: q || undefined, tag: tag || undefined })
      .then((r) => {
        if (!cancelledRef.current) {
          setAgents(r.agents);
          setLoading(false);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelledRef.current) {
          setError(e instanceof Error ? e.message : 'Failed to load agents');
          setLoading(false);
        }
      });
    return () => {
      cancelledRef.current = true;
    };
  }, [q, tag]);

  const allTags = useMemo(
    () => Array.from(new Set(agents.flatMap((a) => a.tags))).sort(),
    [agents],
  );

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const sp = new URLSearchParams(params.toString());
    if (query) sp.set('q', query);
    else sp.delete('q');
    router.replace(`/marketplace?${sp.toString()}`);
  };

  const toggleTag = (t: string) => {
    const sp = new URLSearchParams(params.toString());
    if (sp.get('tag') === t) sp.delete('tag');
    else sp.set('tag', t);
    router.replace(`/marketplace?${sp.toString()}`);
  };

  const handleInvite = (a: BackendAgent) => {
    if (status !== 'authenticated') {
      router.push('/login');
      return;
    }
    setInviteTarget(a);
  };

  const handleReset = () => {
    setQuery('');
    router.replace('/marketplace');
  };

  return (
    <div
      className="flex-1 overflow-y-auto px-6 py-8"
      style={{ background: 'var(--bf-tertiary)' }}
    >
      <div className="max-w-6xl mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Marketplace</h1>
          <p style={{ color: 'var(--bf-gray)' }}>
            Browse and invite agents into your servers.
          </p>
        </header>

        {/* Search bar */}
        <form onSubmit={submitSearch} className="mb-4 flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search agents by name…"
            className="flex-1 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--bf-accent)]"
            style={{ background: 'var(--bf-chat-input)', color: 'var(--bf-white)' }}
          />
          <button
            type="submit"
            className="px-4 py-2 rounded text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: 'var(--bf-fire)', color: 'var(--bf-white)' }}
          >
            Search
          </button>
        </form>

        {/* Tag filter chips */}
        {allTags.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {allTags.map((t) => (
              <button
                key={t}
                onClick={() => toggleTag(t)}
                className="text-xs px-3 py-1 rounded-full transition-opacity hover:opacity-90"
                style={{
                  background: tag === t ? 'var(--bf-fire)' : 'var(--bf-secondary)',
                  color: 'var(--bf-white)',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="mb-4 p-3 rounded bg-rose-900/40 text-rose-300 text-sm">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-48 rounded-xl animate-pulse"
                style={{ background: 'var(--bf-secondary)' }}
              />
            ))}
          </div>
        ) : agents.length === 0 ? (
          /* Empty state */
          <p className="text-center py-12" style={{ color: 'var(--bf-gray)' }}>
            No agents match your filter.{' '}
            <button onClick={handleReset} className="underline">
              Reset
            </button>
          </p>
        ) : (
          /* Agent grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((a) => (
              <AgentCard key={a.id} agent={a} onInvite={handleInvite} />
            ))}
          </div>
        )}
      </div>

      {/* Invite modal */}
      {inviteTarget && (
        <InviteToServerModal
          agent={inviteTarget}
          onClose={() => setInviteTarget(null)}
        />
      )}
    </div>
  );
}

export default function MarketplacePage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex-1 overflow-y-auto px-6 py-8"
          style={{ background: 'var(--bf-tertiary)' }}
        >
          <div className="max-w-6xl mx-auto">
            <div className="h-10 w-48 rounded animate-pulse mb-4" style={{ background: 'var(--bf-secondary)' }} />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-48 rounded-xl animate-pulse"
                  style={{ background: 'var(--bf-secondary)' }}
                />
              ))}
            </div>
          </div>
        </div>
      }
    >
      <MarketplaceContent />
    </Suspense>
  );
}
