'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, Plus, ImagePlus, Share2, MoreHorizontal, X,
  Flame, Sparkles, Bot, MessageSquare,
} from 'lucide-react';
import { bf } from '@/lib/api-bonfire';
import { useAuth } from '@/components/auth/AuthProvider';
import type { BackendAgent } from '@/lib/types';
import InviteToServerModal from '@/components/marketplace/InviteToServerModal';
import CreateAgentModal from '@/components/marketplace/CreateAgentModal';
import LeftNav from '@/components/layout/LeftNav';
import DmSidebar, { upsertDmSession } from '@/components/dm/DmSidebar';

const CATEGORY_COLOR: Record<string, string> = {
  Research: '#8116E0',
  Code: '#43b581',
  Finance: '#8116E0',
  Voice: '#8116E0',
  Generalist: '#8116E0',
};

const TAG_BANNER: Record<string, string> = {
  research: 'linear-gradient(135deg,#0a0014 0%,#2a0060 60%,#8116E0 100%)',
  code: 'linear-gradient(135deg,#0a0014 0%,#1b3a1b 60%,#43b581 100%)',
  finance: 'linear-gradient(135deg,#0a0014 0%,#2a0060 60%,#8116E0 100%)',
  voice: 'linear-gradient(135deg,#0a0014 0%,#2a0060 50%,#8116E0 100%)',
  generalist: 'linear-gradient(135deg,#0a0014 0%,#2a0060 50%,#8116E0 100%)',
};

const TAG_COLOR: Record<string, string> = {
  research: '#8116E0',
  code: '#43b581',
  finance: '#8116E0',
  voice: '#8116E0',
  generalist: '#8116E0',
};

function agentBanner(a: BackendAgent) {
  const tag = a.tags[0]?.toLowerCase() ?? '';
  return TAG_BANNER[tag] ?? 'linear-gradient(135deg,#0a0014 0%,#2a0060 50%,#8116E0 100%)';
}
function agentColor(a: BackendAgent) {
  const tag = a.tags[0]?.toLowerCase() ?? '';
  return TAG_COLOR[tag] ?? '#8116E0';
}

// ── Detail overlay ────────────────────────────────────────────────────────────

function AgentDetailOverlay({
  agent,
  onClose,
  onInvite,
  onMessage,
}: {
  agent: BackendAgent;
  onClose: () => void;
  onInvite: (a: BackendAgent) => void;
  onMessage: (a: BackendAgent) => void;
}) {
  const [ssIdx, setSsIdx] = useState(0);
  const banner = agentBanner(agent);
  const color = agentColor(agent);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={onClose}
    >
      <div
        className="m-auto w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{ background: 'var(--bf-secondary)', maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Banner */}
        <div className="relative h-44 flex-shrink-0" style={{ background: banner }}>
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.4)', color: 'white' }}
          >
            <X size={16} />
          </button>
          {agent.avatarUrl
            ? <img src={agent.avatarUrl} alt="" className="absolute bottom-0 left-6 translate-y-1/2 w-20 h-20 rounded-2xl border-4 object-cover" style={{ borderColor: 'var(--bf-secondary)' }} />
            : <div className="absolute bottom-0 left-6 translate-y-1/2 w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold text-white border-4" style={{ background: color, borderColor: 'var(--bf-secondary)' }}>{agent.name[0]}</div>
          }
        </div>

        {/* Action bar */}
        <div className="flex items-center justify-end gap-2 px-6 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--bf-quaternary)' }}>
          <button className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--bf-quinary)]" style={{ color: 'var(--bf-gray)' }}>
            <Share2 size={15} />
          </button>
          <button className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--bf-quinary)]" style={{ color: 'var(--bf-gray)' }}>
            <MoreHorizontal size={15} />
          </button>
          <button
            onClick={() => { onMessage(agent); onClose(); }}
            className="px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5"
            style={{ background: 'var(--bf-quinary)', color: 'white' }}
          >
            <MessageSquare size={14} />
            Message
          </button>
          <button
            onClick={() => { onInvite(agent); onClose(); }}
            className="px-5 py-2 rounded-lg text-sm font-bold text-white"
            style={{ background: 'var(--bf-accent)' }}
          >
            Add to Server
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left */}
          <div className="flex-1 overflow-y-auto px-6 pt-14 pb-6">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-white text-2xl font-bold">{agent.name}</h2>
              <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{ background: 'var(--bf-accent)', color: 'white' }}>BOT</span>
            </div>
            <p className="text-sm mb-1" style={{ color: 'var(--bf-gray)' }}>@{agent.slug}</p>
            <p className="text-sm mb-4" style={{ color: 'var(--bf-gray)' }}>{agent.description}</p>

            {/* Screenshot placeholder */}
            <div className="mb-6 rounded-xl flex items-center justify-center" style={{ background: 'var(--bf-quaternary)', aspectRatio: '16/9' }}>
              <div className="text-center">
                <ImagePlus size={32} style={{ color: 'var(--bf-gray)', margin: '0 auto 8px' }} />
                <p className="text-xs" style={{ color: 'var(--bf-gray)' }}>No screenshots uploaded</p>
              </div>
            </div>

            {/* Tags */}
            {agent.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {agent.tags.map(t => (
                  <span key={t} className="text-xs px-2.5 py-1 rounded-full font-medium"
                    style={{ background: (CATEGORY_COLOR[t] ?? '#888') + '33', color: CATEGORY_COLOR[t] ?? '#888' }}>
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="w-56 flex-shrink-0 px-4 pt-6 pb-6 overflow-y-auto border-l flex flex-col gap-4" style={{ borderColor: 'var(--bf-quaternary)' }}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--bf-gray)' }}>Details</p>
              <div className="flex flex-col gap-2">
                <DetailRow label="Slug" value={`@${agent.slug}`} />
                <DetailRow label="Created" value={new Date(agent.createdAt).toLocaleDateString()} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-xs flex-shrink-0" style={{ color: 'var(--bf-gray)' }}>{label}</span>
      <span className="text-xs font-medium text-right" style={{ color: color ?? 'white' }}>{value}</span>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({
  hasAgents,
  query,
  onClearSearch,
  onCreateAgent,
}: {
  hasAgents: boolean;
  query: string;
  onClearSearch: () => void;
  onCreateAgent?: () => void;
}) {
  const isFiltered = hasAgents && query;

  if (isFiltered) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-5">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: 'var(--bf-secondary)' }}
        >
          <Search size={28} style={{ color: 'var(--bf-gray)' }} />
        </div>
        <div className="text-center">
          <p className="text-white font-semibold text-base mb-1">No agents found</p>
          <p className="text-sm" style={{ color: 'var(--bf-gray)' }}>
            No results for <span className="text-white font-medium">&ldquo;{query}&rdquo;</span>. Try a different search.
          </p>
        </div>
        <button
          onClick={onClearSearch}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-80"
          style={{ background: 'var(--bf-accent)' }}
        >
          Clear filters
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 gap-6">
      {/* Glyph cluster */}
      <div className="relative w-24 h-24">
        <div
          className="absolute inset-0 rounded-3xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg,#0a0014 0%,#2a0060 50%,#8116E0 100%)' }}
        >
          <Flame size={40} className="text-white opacity-90" />
        </div>
        <div
          className="absolute -bottom-2 -right-2 w-9 h-9 rounded-xl flex items-center justify-center border-2"
          style={{ background: 'var(--bf-secondary)', borderColor: 'var(--bf-quaternary)' }}
        >
          <Bot size={18} style={{ color: 'var(--bf-accent)' }} />
        </div>
        <div
          className="absolute -top-2 -right-2 w-7 h-7 rounded-lg flex items-center justify-center border-2"
          style={{ background: 'var(--bf-secondary)', borderColor: 'var(--bf-quaternary)' }}
        >
          <Sparkles size={14} style={{ color: '#faa61a' }} />
        </div>
      </div>

      <div className="text-center max-w-sm">
        <h3 className="text-white font-bold text-xl mb-2">No agents yet</h3>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--bf-gray)' }}>
          The marketplace is empty. Be the first to publish an agent running verifiable inference on&nbsp;0G&nbsp;Compute.
        </p>
      </div>

      <div className="flex flex-col items-center gap-3">
        {onCreateAgent ? (
          <button
            onClick={onCreateAgent}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--bf-fire)' }}
          >
            <Plus size={16} strokeWidth={2.5} />
            Create the first agent
          </button>
        ) : (
          <p className="text-xs" style={{ color: 'var(--bf-gray)' }}>
            Sign in to publish an agent.
          </p>
        )}
        <p className="text-xs" style={{ color: 'var(--bf-symbol)' }}>
          Agents are INFTs with on-chain provenance via 0G Storage
        </p>
      </div>
    </div>
  );
}

// ── Inner page ────────────────────────────────────────────────────────────────

function MarketplaceInner() {
  const [query, setQuery] = useState('');
  const [agents, setAgents] = useState<BackendAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteTarget, setInviteTarget] = useState<BackendAgent | null>(null);
  const [detailAgent, setDetailAgent] = useState<BackendAgent | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const { status } = useAuth();
  const router = useRouter();
  const cancelRef = useRef(false);

  // Fetch agents from backend
  useEffect(() => {
    cancelRef.current = false;
    setLoading(true);
    bf.listAgents()
      .then(r => { if (!cancelRef.current) { setAgents(r.agents); setLoading(false); } })
      .catch(() => { if (!cancelRef.current) setLoading(false); });
    return () => { cancelRef.current = true; };
  }, []);

  const filtered = agents.filter(a =>
    a.name.toLowerCase().includes(query.toLowerCase()) ||
    a.description.toLowerCase().includes(query.toLowerCase())
  );

  const featured = agents.slice(0, 3);

  const openInvite = (a: BackendAgent) => {
    if (status !== 'authenticated') { router.push('/login'); return; }
    setInviteTarget(a);
  };

  const startDm = (a: BackendAgent) => {
    upsertDmSession({
      agentId: a.id,
      agentName: a.name,
      agentSlug: a.slug,
      agentAvatar: a.avatarUrl,
      agentBaseUrl: a.baseUrl,
      lastMessage: '',
      lastMessageAt: new Date().toISOString(),
    });
    router.push(`/dm/${a.id}`);
  };

  return (
    <>
      <div className="flex h-full" style={{ background: 'var(--bf-tertiary)' }}>

        {/* Server rail */}
        <LeftNav />

        {/* DM sidebar */}
        <DmSidebar />

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Hero banner */}
          <div className="relative flex-shrink-0" style={{ background: 'var(--bf-brand-hero-gradient)' }}>
            <div className="px-10 pt-8 pb-10 flex items-end justify-between">
              <div>
                <h1 className="font-display !font-normal text-white mb-4" style={{ fontSize: 'clamp(2.8rem, 5vw, 4.5rem)' }}>
                  FIND YOUR AGENT<br />ON BONFIRE
                </h1>
                <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 15 }}>
                  Every agent is an INFT running verifiable inference on 0G Compute.
                </p>
              </div>
              {status === 'authenticated' && (
                <button
                  onClick={() => setShowCreate(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition-opacity hover:opacity-90 flex-shrink-0"
                  style={{ background: 'var(--bf-white)', color: 'var(--bf-fire)', fontSize: 14 }}
                >
                  <Plus size={16} strokeWidth={2.5} />
                  Create Agent
                </button>
              )}
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto" style={{ background: 'var(--bf-tertiary)' }}>
            <div className="w-full px-8 py-4">

              {loading ? (
                <div className="grid grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-48 rounded-xl animate-pulse" style={{ background: 'var(--bf-secondary)' }} />
                  ))}
                </div>
              ) : (
                <>
                  {/* Featured */}
                  {featured.length > 0 && (
                    <section className="mb-10">
                      <h2 className="text-white font-bold text-lg mb-4">Featured Agents</h2>
                      <div className="grid grid-cols-3 gap-4">
                        {featured.map(agent => (
                          <div key={agent.id}
                            className="rounded-xl overflow-hidden cursor-pointer"
                            style={{ background: 'var(--bf-secondary)' }}
                            onClick={() => setDetailAgent(agent)}
                          >
                            <div className="h-32 relative" style={{ background: agentBanner(agent) }}>
                              {agent.avatarUrl
                                ? <img src={agent.avatarUrl} alt="" className="absolute bottom-0 left-4 translate-y-1/2 w-12 h-12 rounded-xl border-4 object-cover" style={{ borderColor: 'var(--bf-secondary)' }} />
                                : <div className="absolute bottom-0 left-4 translate-y-1/2 w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold text-white border-4" style={{ background: agentColor(agent), borderColor: 'var(--bf-secondary)' }}>{agent.name[0]}</div>
                              }
                            </div>
                            <div className="pt-8 px-4 pb-4">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-white text-sm">{agent.name}</span>
                              </div>
                              <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--bf-gray)' }}>{agent.description}</p>
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={e => { e.stopPropagation(); startDm(agent); }}
                                  className="text-xs px-3 py-1 rounded font-semibold flex items-center gap-1"
                                  style={{ background: 'var(--bf-quinary)', color: 'white' }}
                                >
                                  <MessageSquare size={12} />
                                  Message
                                </button>
                                <button
                                  onClick={e => { e.stopPropagation(); openInvite(agent); }}
                                  className="text-xs px-3 py-1 rounded font-semibold text-white"
                                  style={{ background: 'var(--bf-accent)' }}
                                >
                                  Invite
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* All agents */}
                  <section>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                      <h2 className="text-white font-bold text-lg shrink-0">All Agents</h2>
                      <div
                        className="flex items-center gap-2 px-3 py-2 rounded-lg w-full sm:w-auto sm:min-w-[220px] sm:max-w-sm"
                        style={{ background: 'var(--bf-secondary)', border: '1px solid var(--bf-quaternary)' }}
                      >
                        <Search size={16} style={{ color: 'var(--bf-gray)', flexShrink: 0 }} />
                        <input
                          value={query}
                          onChange={e => setQuery(e.target.value)}
                          placeholder="Search agents"
                          className="bg-transparent text-sm focus:outline-none flex-1 min-w-0 text-white placeholder:opacity-50"
                          style={{ color: 'white' }}
                        />
                      </div>
                    </div>
                    {filtered.length === 0 ? (
                      <EmptyState
                        hasAgents={agents.length > 0}
                        query={query}
                        onClearSearch={() => { setQuery(''); }}
                        onCreateAgent={status === 'authenticated' ? () => setShowCreate(true) : undefined}
                      />
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filtered.map(agent => (
                          <div key={agent.id}
                            className="rounded-xl overflow-hidden cursor-pointer"
                            style={{ background: 'var(--bf-secondary)' }}
                            onClick={() => setDetailAgent(agent)}
                          >
                            {/* Mini banner */}
                            <div className="h-16 relative" style={{ background: agentBanner(agent) }}>
                              {agent.avatarUrl
                                ? <img src={agent.avatarUrl} alt="" className="absolute bottom-0 left-3 translate-y-1/2 w-9 h-9 rounded-lg border-2 object-cover" style={{ borderColor: 'var(--bf-secondary)' }} />
                                : <div className="absolute bottom-0 left-3 translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold text-white border-2" style={{ background: agentColor(agent), borderColor: 'var(--bf-secondary)' }}>{agent.name[0]}</div>
                              }
                            </div>
                            <div className="pt-7 px-4 pb-4 flex flex-col gap-2">
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <span className="text-white font-bold text-sm">{agent.name}</span>
                                  </div>
                                  {agent.tags[0] && (
                                    <span className="text-xs px-2 py-0.5 rounded font-medium"
                                      style={{ background: (CATEGORY_COLOR[agent.tags[0]] ?? '#888') + '33', color: CATEGORY_COLOR[agent.tags[0]] ?? '#888' }}>
                                      {agent.tags[0]}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs leading-relaxed" style={{ color: 'var(--bf-gray)' }}>{agent.description}</p>
                              <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--bf-quaternary)' }}>
                                <p className="text-xs" style={{ color: 'var(--bf-symbol)' }}>@{agent.slug}</p>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={e => { e.stopPropagation(); startDm(agent); }}
                                    className="text-xs px-2.5 py-1.5 rounded font-semibold flex items-center gap-1"
                                    style={{ background: 'var(--bf-quinary)', color: 'white' }}
                                  >
                                    <MessageSquare size={11} />
                                    Message
                                  </button>
                                  <button
                                    onClick={e => { e.stopPropagation(); openInvite(agent); }}
                                    className="text-xs px-2.5 py-1.5 rounded font-semibold text-white"
                                    style={{ background: 'var(--bf-accent)' }}
                                  >
                                    Invite
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Detail overlay */}
      {detailAgent && (
        <AgentDetailOverlay
          agent={detailAgent}
          onClose={() => setDetailAgent(null)}
          onInvite={openInvite}
          onMessage={startDm}
        />
      )}

      {/* Invite modal */}
      {inviteTarget && (
        <InviteToServerModal
          agent={inviteTarget}
          onClose={() => setInviteTarget(null)}
        />
      )}

      {/* Create agent modal */}
      {showCreate && (
        <CreateAgentModal
          onClose={() => setShowCreate(false)}
          onCreated={newAgent => {
            setAgents(prev => [newAgent, ...prev]);
            setShowCreate(false);
          }}
        />
      )}
    </>
  );
}

// ── Page export ───────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  return (
    <Suspense fallback={
      <div className="flex h-full items-center justify-center" style={{ background: 'var(--bf-tertiary)' }}>
        <div className="animate-pulse text-sm" style={{ color: 'var(--bf-gray)' }}>Loading marketplace…</div>
      </div>
    }>
      <MarketplaceInner />
    </Suspense>
  );
}
