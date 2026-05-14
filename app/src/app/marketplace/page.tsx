'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck, Star, Cpu, Mic, Search, LayoutGrid, Plus,
  ChevronLeft, ChevronRight, ImagePlus, Share2, MoreHorizontal, X,
} from 'lucide-react';
import { bf } from '@/lib/api-bonfire';
import { useAuth } from '@/components/auth/AuthProvider';
import type { BackendAgent } from '@/lib/types';
import InviteToServerModal from '@/components/marketplace/InviteToServerModal';
import CreateAgentModal from '@/components/marketplace/CreateAgentModal';
import LeftNav from '@/components/layout/LeftNav';

// ── Static data ──────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: 'Agents', icon: LayoutGrid },
  { label: 'Models', icon: Cpu },
  { label: 'Voice',  icon: Mic },
];

const CATEGORIES = ['Home', 'Research', 'Code', 'Finance', 'Voice', 'Generalist'];

const CATEGORY_COLOR: Record<string, string> = {
  Research:   '#6e86d6',
  Code:       '#43b581',
  Finance:    '#faa61a',
  Voice:      '#f97316',
  Generalist: '#9b59b6',
};

const TAG_BANNER: Record<string, string> = {
  research:   'linear-gradient(135deg,#1a237e 0%,#6e86d6 100%)',
  code:       'linear-gradient(135deg,#1b5e20 0%,#43b581 100%)',
  finance:    'linear-gradient(135deg,#e65100 0%,#faa61a 100%)',
  voice:      'linear-gradient(135deg,#e65100 0%,#f97316 100%)',
  generalist: 'linear-gradient(135deg,#4a148c 0%,#a855f7 100%)',
};

const TAG_COLOR: Record<string, string> = {
  research:   '#6e86d6',
  code:       '#43b581',
  finance:    '#faa61a',
  voice:      '#f97316',
  generalist: '#9b59b6',
};

function agentBanner(a: BackendAgent) {
  const tag = a.tags[0]?.toLowerCase() ?? '';
  return TAG_BANNER[tag] ?? 'linear-gradient(135deg,#1a1060 0%,#6e86d6 100%)';
}
function agentColor(a: BackendAgent) {
  const tag = a.tags[0]?.toLowerCase() ?? '';
  return TAG_COLOR[tag] ?? '#6e86d6';
}

// ── Detail overlay ────────────────────────────────────────────────────────────

function AgentDetailOverlay({
  agent,
  onClose,
  onInvite,
}: {
  agent: BackendAgent;
  onClose: () => void;
  onInvite: (a: BackendAgent) => void;
}) {
  const [ssIdx, setSsIdx] = useState(0);
  const banner = agentBanner(agent);
  const color  = agentColor(agent);

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
                <DetailRow label="Slug"       value={`@${agent.slug}`} />
                <DetailRow label="Visibility" value={agent.visibility} />
                <DetailRow label="Created"    value={new Date(agent.createdAt).toLocaleDateString()} />
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

// ── Inner page ────────────────────────────────────────────────────────────────

function MarketplaceInner() {
  const [activeCategory, setActiveCategory] = useState('Home');
  const [activeNav,      setActiveNav]      = useState('Agents');
  const [query,          setQuery]          = useState('');
  const [agents,         setAgents]         = useState<BackendAgent[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [inviteTarget,   setInviteTarget]   = useState<BackendAgent | null>(null);
  const [detailAgent,    setDetailAgent]    = useState<BackendAgent | null>(null);
  const [showCreate,     setShowCreate]     = useState(false);
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

  const filtered = agents.filter(a => {
    const matchNav = activeNav === 'Agents' || a.tags.some(t => t.toLowerCase() === activeNav.toLowerCase());
    const matchCat = activeCategory === 'Home' || a.tags.some(t => t.toLowerCase() === activeCategory.toLowerCase());
    const matchQ   = a.name.toLowerCase().includes(query.toLowerCase()) ||
                     a.description.toLowerCase().includes(query.toLowerCase());
    return matchNav && matchCat && matchQ;
  });

  const featured = agents.slice(0, 3);

  const openInvite = (a: BackendAgent) => {
    if (status !== 'authenticated') { router.push('/login'); return; }
    setInviteTarget(a);
  };

  return (
    <>
    <div className="flex h-full" style={{ background: 'var(--bf-tertiary)' }}>

      {/* Server rail */}
      <LeftNav />

      {/* Discover sidebar */}
      <aside className="w-60 flex-shrink-0 flex flex-col border-r" style={{ background: 'var(--bf-secondary)', borderColor: 'var(--bf-quaternary)' }}>
        <div className="px-4 h-12 border-b flex items-center" style={{ borderColor: 'var(--bf-quaternary)' }}>
          <span className="font-bold" style={{ fontSize: 15, color: 'white' }}>Discover</span>
        </div>
        <div className="px-2 pt-3 flex flex-col gap-1">
          {NAV_ITEMS.map(({ label, icon: Icon }) => {
            const isActive = activeNav === label;
            return (
              <button
                key={label}
                onClick={() => { setActiveNav(label); setActiveCategory('Home'); }}
                className="flex items-center gap-3 w-full px-3 py-2 rounded-md transition-colors"
                style={{ color: isActive ? 'white' : 'var(--bf-gray)', background: isActive ? 'var(--bf-quinary)' : 'transparent', fontSize: 15, fontWeight: 500 }}
                onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'var(--bf-quinary)'; (e.currentTarget as HTMLElement).style.color = 'white'; }}}
                onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--bf-gray)'; }}}
              >
                <Icon size={20} strokeWidth={1.5} style={{ flexShrink: 0 }} />
                {label}
              </button>
            );
          })}
        </div>
        {status === 'authenticated' && (
          <div className="mt-auto px-3 pb-4 pt-2 border-t" style={{ borderColor: 'var(--bf-quaternary)' }}>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--bf-fire)', fontSize: 14 }}
            >
              <Plus size={16} strokeWidth={2.5} />
              Create Agent
            </button>
          </div>
        )}
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Hero banner */}
        <div className="relative flex-shrink-0" style={{ background: 'linear-gradient(160deg,#1a1060 0%,#2d1f7a 40%,#6e86d6 100%)', minHeight: 260 }}>
          <div className="flex items-center gap-1 px-6 border-b" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)} className="px-4 py-3 border-b-2 transition-colors"
                style={{ fontSize: 15, fontWeight: 500, borderColor: activeCategory === cat ? 'white' : 'transparent', color: activeCategory === cat ? 'white' : 'rgba(255,255,255,0.55)' }}>
                {cat}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2 my-2 px-3 py-1.5 rounded" style={{ background: 'rgba(0,0,0,0.3)' }}>
              <Search size={14} style={{ color: 'rgba(255,255,255,0.6)' }} />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search agents"
                className="bg-transparent text-sm focus:outline-none w-36 text-white placeholder-white/50" />
            </div>
          </div>
          <div className="px-10 pt-8 pb-10">
            <h1 className="font-display text-white mb-4" style={{ fontSize: 'clamp(2.8rem, 5vw, 4.5rem)' }}>
              {activeNav === 'Voice'  ? (<>VOICE AGENTS<br />ON BONFIRE</>) :
               activeNav === 'Models' ? (<>LLM MODELS<br />ON BONFIRE</>) :
               activeCategory === 'Home' ? (<>FIND YOUR AGENT<br />ON BONFIRE</>) :
               activeCategory}
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 15 }}>
              {activeNav === 'Voice'  ? 'Real-time voice agents powered by LiveKit and 0G Compute.' :
               activeNav === 'Models' ? 'Browse available LLM models for your agents.' :
               activeCategory === 'Home' ? 'Every agent is an INFT running verifiable inference on 0G Compute.' :
               `Browse ${activeCategory} agents on the BonFire marketplace.`}
            </p>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto" style={{ background: 'var(--bf-tertiary)' }}>
          <div className="max-w-5xl mx-auto px-8 py-8">

            {loading ? (
              <div className="grid grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-48 rounded-xl animate-pulse" style={{ background: 'var(--bf-secondary)' }} />
                ))}
              </div>
            ) : (
              <>
                {/* Featured */}
                {activeCategory === 'Home' && featured.length > 0 && (
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
                            <div className="flex items-center justify-end">
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
                  <h2 className="text-white font-bold text-lg mb-4">
                    {activeCategory === 'Home' ? 'All Agents' : activeCategory}
                  </h2>
                  {filtered.length === 0 ? (
                    <p className="text-center py-12 text-sm" style={{ color: 'var(--bf-gray)' }}>No agents match your filter.</p>
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
                              <button
                                onClick={e => { e.stopPropagation(); openInvite(agent); }}
                                className="text-xs px-3 py-1.5 rounded font-semibold text-white"
                                style={{ background: 'var(--bf-accent)' }}
                              >
                                Invite
                              </button>
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
