"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck, Star, Cpu, Mic, Search, LayoutGrid, Zap, X, Check, Plus,
  ChevronLeft, ChevronRight, Upload, ImagePlus, Share2, MoreHorizontal,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import LeftNav from "@/components/layout/LeftNav";

const NAV_ITEMS = [
  { label: "Agents", icon: LayoutGrid, filter: null },
  { label: "Models", icon: Cpu,        filter: "Models" },
  { label: "Voice",  icon: Mic,        filter: "Voice" },
];

const CATEGORIES = ["Home", "Research", "Code", "Finance", "Voice", "Generalist"];

const FEATURED = [
  {
    id: "researcher",
    name: "ResearchBot",
    category: "Research",
    banner: "linear-gradient(135deg,#1a237e 0%,#6e86d6 100%)",
    logo: "R",
    logoColor: "#6e86d6",
    desc: "Web search, summarisation, and synthesis. The go-to agent for literature reviews and market research.",
    rating: 4.9,
    tee: true,
    price: "0.001 0G/1k",
  },
  {
    id: "coder",
    name: "CodeAssist",
    category: "Code",
    banner: "linear-gradient(135deg,#1b5e20 0%,#43b581 100%)",
    logo: "C",
    logoColor: "#43b581",
    desc: "Code review, generation, and debugging across all major languages. Powered by DeepSeek-V3.",
    rating: 4.8,
    tee: true,
    price: "0.001 0G/1k",
  },
  {
    id: "analyst",
    name: "DataAnalyst",
    category: "Finance",
    banner: "linear-gradient(135deg,#e65100 0%,#faa61a 100%)",
    logo: "D",
    logoColor: "#faa61a",
    desc: "Financial modelling, data analysis, and chart generation from structured data.",
    rating: 4.7,
    tee: true,
    price: "0.002 0G/1k",
  },
];

const ALL_AGENTS = [
  { id: "researcher", name: "ResearchBot",  category: "Research", model: "Qwen3.6-Plus",  rating: 4.9, price: "0.001 0G/1k", royalty: "5%", tee: true,  desc: "Web search, summarisation, and synthesis.", servers: 1240, banner: "linear-gradient(135deg,#1a237e 0%,#6e86d6 100%)", logoColor: "#6e86d6", screenshots: [] as string[] },
  { id: "coder",      name: "CodeAssist",   category: "Code",     model: "DeepSeek-V3",   rating: 4.8, price: "0.001 0G/1k", royalty: "3%", tee: true,  desc: "Code review, generation, and debugging.", servers: 980, banner: "linear-gradient(135deg,#1b5e20 0%,#43b581 100%)", logoColor: "#43b581", screenshots: [] as string[] },
  { id: "analyst",    name: "DataAnalyst",  category: "Finance",  model: "GLM-5",         rating: 4.7, price: "0.002 0G/1k", royalty: "7%", tee: true,  desc: "Financial modelling and data analysis.", servers: 654, banner: "linear-gradient(135deg,#e65100 0%,#faa61a 100%)", logoColor: "#faa61a", screenshots: [] as string[] },
  { id: "writer",     name: "CopyWriter",   category: "Research", model: "Qwen3.6-Plus",  rating: 4.6, price: "0.001 0G/1k", royalty: "4%", tee: false, desc: "Long-form content, blog posts, and emails.", servers: 430, banner: "linear-gradient(135deg,#4a148c 0%,#a855f7 100%)", logoColor: "#a855f7", screenshots: [] as string[] },
  { id: "critic",     name: "CriticAgent",  category: "Code",     model: "DeepSeek-V3",   rating: 4.5, price: "0.0008 0G/1k",royalty: "2%", tee: true,  desc: "Adversarial reviewer — pokes holes in plans.", servers: 312, banner: "linear-gradient(135deg,#b71c1c 0%,#f04747 100%)", logoColor: "#f04747", screenshots: [] as string[] },
  { id: "voice",      name: "VoiceCoach",   category: "Voice",    model: "GLM-5",         rating: 4.4, price: "0.003 0G/min",royalty: "6%", tee: true,  desc: "Real-time voice coaching over LiveKit.", servers: 210, banner: "linear-gradient(135deg,#e65100 0%,#f97316 100%)", logoColor: "#f97316", screenshots: [] as string[] },
];

const CATEGORY_COLOR: Record<string, string> = {
  Research: "#6e86d6",
  Code:     "#43b581",
  Finance:  "#faa61a",
  Voice:    "#f97316",
  Generalist: "#9b59b6",
};

export default function MarketplacePage() {
  return <MarketplaceInner />;
}

type InviteTarget = typeof ALL_AGENTS[number];

const AVATAR_COLORS = ["#6e86d6", "#f97316", "#43b581", "#f04747", "#faa61a", "#a855f7"];
const WIZ_CATEGORIES = ["Research", "Code", "Finance", "Voice", "Generalist"] as const;
const MODELS = [
  { id: "Qwen3.6-Plus", label: "Qwen3.6-Plus", desc: "Alibaba's balanced model — fast, cost-efficient, great for general tasks." },
  { id: "DeepSeek-V3",  label: "DeepSeek-V3",  desc: "DeepSeek's dense model, excellent at code and structured reasoning." },
  { id: "GLM-5",        label: "GLM-5",         desc: "Zhipu's flagship reasoning model, strong on multilingual tasks." },
] as const;
const ACQ_MODES = ["owned", "rented", "licensed"] as const;
const STEP_TITLES: Record<number, string> = {
  1: "Identity", 2: "Banner & Screenshots", 3: "Model & Rates", 4: "System Prompt & Skills", 5: "Review & Confirm",
};
const BANNER_PRESETS = [
  "linear-gradient(135deg,#1a1060 0%,#6e86d6 100%)",
  "linear-gradient(135deg,#1b5e20 0%,#43b581 100%)",
  "linear-gradient(135deg,#e65100 0%,#faa61a 100%)",
  "linear-gradient(135deg,#4a148c 0%,#a855f7 100%)",
  "linear-gradient(135deg,#b71c1c 0%,#f04747 100%)",
  "linear-gradient(135deg,#006064 0%,#00bcd4 100%)",
];

type WizardStep = 1 | 2 | 3 | 4 | 5;
type SkillDraft = { command: string; name: string; description: string };
type AgentDraft = {
  name: string; description: string; avatarColor: string; category: string;
  bannerColor: string; bannerImage: string; screenshots: string[];
  model: "GLM-5" | "Qwen3.6-Plus" | "DeepSeek-V3";
  rateInput: number; rateOutput: number; acquisition: string;
  systemPrompt: string; skills: SkillDraft[];
};
const DRAFT_DEFAULTS: AgentDraft = {
  name: "", description: "", avatarColor: "#6e86d6", category: "",
  bannerColor: "linear-gradient(135deg,#1a1060 0%,#6e86d6 100%)", bannerImage: "", screenshots: [],
  model: "Qwen3.6-Plus", rateInput: 0.001, rateOutput: 0.002,
  acquisition: "owned", systemPrompt: "", skills: [],
};

function MarketplaceInner() {
  const [activeCategory, setActiveCategory] = useState("Home");
  const [activeNav, setActiveNav] = useState("Agents");
  const [query, setQuery] = useState("");
  const [inviteAgent, setInviteAgent] = useState<InviteTarget | null>(null);
  const [selectedServerId, setSelectedServerId] = useState<string>("");
  const [invited, setInvited] = useState<string | null>(null);
  const [detailAgent, setDetailAgent] = useState<InviteTarget | null>(null);
  const [detailScreenshot, setDetailScreenshot] = useState(0);
  // Create agent wizard
  const [showWizard, setShowWizard] = useState(false);
  const [wizStep, setWizStep] = useState<WizardStep>(1);
  const [draft, setDraft] = useState<AgentDraft>(DRAFT_DEFAULTS);
  const { servers, addAgent, setActiveServer } = useApp();
  const router = useRouter();

  const bannerInputRef = useRef<HTMLInputElement>(null);
  const ssInputRef = useRef<HTMLInputElement>(null);

  const patch = <K extends keyof AgentDraft>(key: K, val: AgentDraft[K]) =>
    setDraft(prev => ({ ...prev, [key]: val }));
  const patchSkill = (i: number, field: keyof SkillDraft, val: string) =>
    setDraft(prev => ({ ...prev, skills: prev.skills.map((s, j) => j === i ? { ...s, [field]: val } : s) }));
  const addSkill = () => {
    if (draft.skills.length >= 3) return;
    setDraft(prev => ({ ...prev, skills: [...prev.skills, { command: "/", name: "", description: "" }] }));
  };
  const removeSkill = (i: number) =>
    setDraft(prev => ({ ...prev, skills: prev.skills.filter((_, j) => j !== i) }));
  const closeWizard = () => { setShowWizard(false); setWizStep(1); setDraft(DRAFT_DEFAULTS); };

  const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => patch("bannerImage", ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const remaining = 5 - draft.screenshots.length;
    files.slice(0, remaining).forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        const url = ev.target?.result as string;
        setDraft(prev => ({ ...prev, screenshots: [...prev.screenshots, url] }));
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const removeScreenshot = (i: number) =>
    setDraft(prev => ({ ...prev, screenshots: prev.screenshots.filter((_, j) => j !== i) }));

  const handleCreate = () => {
    if (!draft.name.trim()) return;
    const agent = {
      id: `agent-custom-${Date.now()}`,
      name: draft.name.trim(),
      avatar: draft.avatarColor,
      description: draft.systemPrompt.trim() || draft.description.trim() || "Custom agent",
      model: draft.model,
      status: "offline" as const,
      isBot: true,
      rateInput: draft.rateInput,
      rateOutput: draft.rateOutput,
      acquisition: draft.acquisition as "owned" | "rented" | "licensed",
      skills: draft.skills.filter(s => s.command.trim() && s.name.trim()).map((s, i) => ({
        id: `sk-${Date.now()}-${i}`, command: s.command.trim(), name: s.name.trim(), description: s.description.trim(),
      })),
    };
    if (servers[0]) addAgent(servers[0].id, agent);
    closeWizard();
  };

  const nextDisabled = wizStep === 1 && !draft.name.trim();

  const filtered = ALL_AGENTS.filter(a => {
    const matchNav = activeNav === "Agents" || a.category === activeNav;
    const matchCat = activeCategory === "Home" || a.category === activeCategory;
    const matchQ   = a.name.toLowerCase().includes(query.toLowerCase()) ||
                     a.desc.toLowerCase().includes(query.toLowerCase());
    return matchNav && matchCat && matchQ;
  });

  const handleInviteConfirm = () => {
    if (!inviteAgent || !selectedServerId) return;
    addAgent(selectedServerId, {
      id: `agent-${inviteAgent.id}-${Date.now()}`,
      name: inviteAgent.name,
      description: inviteAgent.desc,
      model: inviteAgent.model,
      status: "online",
      isBot: true,
      skills: [],
      rateInput: parseFloat(inviteAgent.price) || 0.001,
      rateOutput: parseFloat(inviteAgent.price) || 0.002,
      teeHash: inviteAgent.tee ? `0x${Math.random().toString(16).slice(2, 18)}` : undefined,
    });
    setInvited(selectedServerId);
  };

  const handleGoToServer = () => {
    if (invited) { setActiveServer(invited); router.push("/workspace"); }
  };

  const openInvite = (agent: InviteTarget) => {
    setInviteAgent(agent);
    setSelectedServerId(servers[0]?.id ?? "");
    setInvited(null);
  };

  const openDetail = (agent: InviteTarget) => {
    setDetailAgent(agent);
    setDetailScreenshot(0);
  };

  return (
    <>
    <div className="flex h-full" style={{ background: "var(--bf-tertiary)" }}>

      {/* Server rail */}
      <LeftNav />

      {/* Discover sidebar */}
      <aside className="w-60 flex-shrink-0 flex flex-col border-r" style={{ background: "var(--bf-secondary)", borderColor: "var(--bf-quaternary)" }}>
        <div className="px-4 h-12 border-b flex items-center" style={{ borderColor: "var(--bf-quaternary)" }}>
          <span className="font-bold" style={{ fontSize: 15, color: "white" }}>Discover</span>
        </div>
        <div className="px-2 pt-3 flex flex-col gap-1">
          {NAV_ITEMS.map(({ label, icon: Icon }) => {
            const isActive = activeNav === label;
            return (
              <button
                key={label}
                onClick={() => { setActiveNav(label); setActiveCategory("Home"); }}
                className="flex items-center gap-3 w-full px-3 py-2 rounded-md transition-colors"
                style={{ color: isActive ? "white" : "var(--bf-gray)", background: isActive ? "var(--bf-quinary)" : "transparent", fontSize: 15, fontWeight: 500 }}
                onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = "var(--bf-quinary)"; (e.currentTarget as HTMLElement).style.color = "white"; }}}
                onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--bf-gray)"; }}}
              >
                <Icon size={20} strokeWidth={1.5} style={{ flexShrink: 0 }} />
                {label}
              </button>
            );
          })}
        </div>
        <div className="mt-auto px-3 pb-4 pt-2 border-t" style={{ borderColor: "var(--bf-quaternary)" }}>
          <button
            onClick={() => setShowWizard(true)}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--bf-fire)", fontSize: 14 }}
          >
            <Plus size={16} strokeWidth={2.5} />
            Create Agent
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Hero banner */}
        <div
          className="relative flex-shrink-0"
          style={{ background: "linear-gradient(160deg,#1a1060 0%,#2d1f7a 40%,#6e86d6 100%)", minHeight: 260 }}
        >
          <div className="flex items-center gap-1 px-6 border-b" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)} className="px-4 py-3 border-b-2 transition-colors"
                style={{ fontSize: 15, fontWeight: 500, borderColor: activeCategory === cat ? "white" : "transparent", color: activeCategory === cat ? "white" : "rgba(255,255,255,0.55)" }}>
                {cat}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2 my-2 px-3 py-1.5 rounded" style={{ background: "rgba(0,0,0,0.3)" }}>
              <Search size={14} style={{ color: "rgba(255,255,255,0.6)" }} />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search agents"
                className="bg-transparent text-sm focus:outline-none w-36 text-white placeholder-white/50" />
            </div>
          </div>
          <div className="px-10 pt-8 pb-10">
            <h1 className="font-display text-white mb-4" style={{ fontSize: "clamp(2.8rem, 5vw, 4.5rem)" }}>
              {activeNav === "Voice" ? (<>VOICE AGENTS<br />ON BONFIRE</>) :
               activeNav === "Models" ? (<>LLM MODELS<br />ON BONFIRE</>) :
               activeCategory === "Home" ? (<>FIND YOUR AGENT<br />ON BONFIRE</>) :
               activeCategory}
            </h1>
            <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 15 }}>
              {activeNav === "Voice" ? "Real-time voice agents powered by LiveKit and 0G Compute." :
               activeNav === "Models" ? "Browse available LLM models for your agents." :
               activeCategory === "Home" ? "Every agent is an INFT running verifiable inference on 0G Compute." :
               `Browse ${activeCategory} agents on the BonFire marketplace.`}
            </p>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto" style={{ background: "var(--bf-tertiary)" }}>
          <div className="max-w-5xl mx-auto px-8 py-8">

            {/* Featured cards */}
            {activeCategory === "Home" && (
              <section className="mb-10">
                <h2 className="text-white font-bold text-lg mb-4">Featured Agents</h2>
                <div className="grid grid-cols-3 gap-4">
                  {FEATURED.map(agent => (
                    <div key={agent.id} className="rounded-xl overflow-hidden cursor-pointer" style={{ background: "var(--bf-secondary)" }}
                      onClick={() => { const a = ALL_AGENTS.find(a => a.id === agent.id); if (a) openDetail(a); }}>
                      <div className="h-32 relative" style={{ background: agent.banner }}>
                        <div className="absolute bottom-0 left-4 translate-y-1/2 w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold text-white border-4"
                          style={{ background: agent.logoColor, borderColor: "var(--bf-secondary)" }}>
                          {agent.logo}
                        </div>
                      </div>
                      <div className="pt-8 px-4 pb-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-white text-sm">{agent.name}</span>
                          {agent.tee && <ShieldCheck size={13} style={{ color: "#43b581" }} strokeWidth={2} />}
                        </div>
                        <p className="text-xs leading-relaxed mb-3" style={{ color: "var(--bf-gray)" }}>{agent.desc}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium" style={{ color: "var(--bf-fire)" }}>{agent.price}</span>
                          <button
                            onClick={e => { e.stopPropagation(); const a = ALL_AGENTS.find(a => a.id === agent.id); if (a) openInvite(a); }}
                            className="text-xs px-3 py-1 rounded font-semibold text-white"
                            style={{ background: "var(--bf-accent)" }}>
                            Invite
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* All agents grid */}
            <section>
              <h2 className="text-white font-bold text-lg mb-4">
                {activeCategory === "Home" ? "All Agents" : activeCategory}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(agent => (
                  <div key={agent.id} className="rounded-xl overflow-hidden cursor-pointer" style={{ background: "var(--bf-secondary)" }}
                    onClick={() => openDetail(agent)}>
                    {/* Mini banner */}
                    <div className="h-16 relative" style={{ background: agent.banner }}>
                      <div className="absolute bottom-0 left-3 translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold text-white border-2"
                        style={{ background: agent.logoColor, borderColor: "var(--bf-secondary)" }}>
                        {agent.name[0]}
                      </div>
                    </div>
                    <div className="pt-7 px-4 pb-4 flex flex-col gap-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-white font-bold text-sm">{agent.name}</span>
                            {agent.tee && <ShieldCheck size={13} style={{ color: "#43b581" }} strokeWidth={2} />}
                          </div>
                          <span className="text-xs px-2 py-0.5 rounded font-medium"
                            style={{ background: (CATEGORY_COLOR[agent.category] ?? "#888") + "33", color: CATEGORY_COLOR[agent.category] ?? "#888" }}>
                            {agent.category}
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <Star size={11} fill="#faa61a" stroke="none" />
                          <span className="text-xs" style={{ color: "#faa61a" }}>{agent.rating}</span>
                        </div>
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: "var(--bf-gray)" }}>{agent.desc}</p>
                      <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: "var(--bf-quaternary)" }}>
                        <div>
                          <p className="text-xs font-medium" style={{ color: "var(--bf-fire)" }}>{agent.price}</p>
                          <p className="text-xs" style={{ color: "var(--bf-symbol)" }}>{agent.model}</p>
                        </div>
                        <div className="flex gap-2">
                          <button className="text-xs px-3 py-1.5 rounded font-semibold" style={{ background: "var(--bf-quinary)", color: "var(--bf-gray)" }}
                            onClick={e => e.stopPropagation()}>
                            <Zap size={11} className="inline mr-1" strokeWidth={2} />Try
                          </button>
                          <button onClick={e => { e.stopPropagation(); openInvite(agent); }} className="text-xs px-3 py-1.5 rounded font-semibold text-white" style={{ background: "var(--bf-accent)" }}>
                            Invite
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>

    {/* ── Agent Detail Overlay ── */}
    {detailAgent && (
      <div className="fixed inset-0 z-50 flex" style={{ background: "rgba(0,0,0,0.85)" }}
        onClick={() => setDetailAgent(null)}>
        <div className="m-auto w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl flex flex-col"
          style={{ background: "var(--bf-secondary)", maxHeight: "90vh" }}
          onClick={e => e.stopPropagation()}>

          {/* Banner */}
          <div className="relative h-44 flex-shrink-0" style={{ background: detailAgent.banner }}>
            {/* Close */}
            <button onClick={() => setDetailAgent(null)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: "rgba(0,0,0,0.4)", color: "white" }}>
              <X size={16} />
            </button>
            {/* Logo overlaid on banner bottom-left */}
            <div className="absolute bottom-0 left-6 translate-y-1/2 w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold text-white border-4"
              style={{ background: detailAgent.logoColor, borderColor: "var(--bf-secondary)" }}>
              {detailAgent.name[0]}
            </div>
          </div>

          {/* Action bar */}
          <div className="flex items-center justify-end gap-2 px-6 py-3 flex-shrink-0" style={{ borderBottom: "1px solid var(--bf-quaternary)" }}>
            <button className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--bf-quinary)]" style={{ color: "var(--bf-gray)" }}>
              <Share2 size={15} />
            </button>
            <button className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--bf-quinary)]" style={{ color: "var(--bf-gray)" }}>
              <MoreHorizontal size={15} />
            </button>
            <button onClick={() => { openInvite(detailAgent); setDetailAgent(null); }}
              className="px-5 py-2 rounded-lg text-sm font-bold text-white"
              style={{ background: "var(--bf-accent)" }}>
              Add to Server
            </button>
          </div>

          {/* Body — two columns */}
          <div className="flex flex-1 overflow-hidden">

            {/* Left: main content */}
            <div className="flex-1 overflow-y-auto px-6 pt-14 pb-6">
              {/* Name row */}
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-white text-2xl font-bold">{detailAgent.name}</h2>
                {detailAgent.tee && (
                  <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded"
                    style={{ background: "#43b58122", color: "#43b581" }}>
                    <ShieldCheck size={11} strokeWidth={2} /> TEE Verified
                  </span>
                )}
              </div>
              <p className="text-sm mb-4" style={{ color: "var(--bf-gray)" }}>{detailAgent.desc}</p>

              {/* Screenshots carousel */}
              {detailAgent.screenshots && detailAgent.screenshots.length > 0 ? (
                <div className="mb-6">
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--bf-gray)" }}>Screenshots</p>
                  <div className="relative rounded-xl overflow-hidden" style={{ background: "var(--bf-quaternary)", aspectRatio: "16/9" }}>
                    <img src={detailAgent.screenshots[detailScreenshot]} alt="" className="w-full h-full object-cover" />
                    {detailAgent.screenshots.length > 1 && (
                      <>
                        <button onClick={() => setDetailScreenshot(s => Math.max(0, s - 1))}
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ background: "rgba(0,0,0,0.5)", color: "white", opacity: detailScreenshot === 0 ? 0.3 : 1 }}>
                          <ChevronLeft size={16} />
                        </button>
                        <button onClick={() => setDetailScreenshot(s => Math.min(detailAgent.screenshots.length - 1, s + 1))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ background: "rgba(0,0,0,0.5)", color: "white", opacity: detailScreenshot === detailAgent.screenshots.length - 1 ? 0.3 : 1 }}>
                          <ChevronRight size={16} />
                        </button>
                        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                          {detailAgent.screenshots.map((_, i) => (
                            <button key={i} onClick={() => setDetailScreenshot(i)}
                              style={{ width: 6, height: 6, borderRadius: "50%", background: i === detailScreenshot ? "white" : "rgba(255,255,255,0.4)" }} />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                /* Placeholder banner when no screenshots */
                <div className="mb-6 rounded-xl flex items-center justify-center" style={{ background: "var(--bf-quaternary)", aspectRatio: "16/9" }}>
                  <div className="text-center">
                    <ImagePlus size={32} style={{ color: "var(--bf-gray)", margin: "0 auto 8px" }} />
                    <p className="text-xs" style={{ color: "var(--bf-gray)" }}>No screenshots uploaded</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right: metadata sidebar */}
            <div className="w-56 flex-shrink-0 px-4 pt-6 pb-6 overflow-y-auto border-l flex flex-col gap-4" style={{ borderColor: "var(--bf-quaternary)" }}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--bf-gray)" }}>Details</p>
                <div className="flex flex-col gap-2">
                  <DetailRow label="Category" value={detailAgent.category} color={CATEGORY_COLOR[detailAgent.category]} />
                  <DetailRow label="Model" value={detailAgent.model} />
                  <DetailRow label="Servers" value={detailAgent.servers.toLocaleString()} />
                  <DetailRow label="Rating" value={`⭐ ${detailAgent.rating}`} />
                  <DetailRow label="Price" value={detailAgent.price} color="var(--bf-fire)" />
                  <DetailRow label="Royalty" value={detailAgent.royalty} />
                  <DetailRow label="Acquisition" value="Licensed" />
                </div>
              </div>

              {detailAgent.tee && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--bf-gray)" }}>TEE Attestation</p>
                  <div className="rounded p-2 text-xs" style={{ background: "var(--bf-quaternary)" }}>
                    <p className="truncate mb-1" style={{ color: "var(--bf-accent)" }}>0x{detailAgent.id}...ff</p>
                    <span className="flex items-center gap-1 font-semibold" style={{ color: "#43b581" }}>
                      <ShieldCheck size={11} strokeWidth={2} /> Verified on 0G
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )}

    {/* ── Invite modal ── */}
    {inviteAgent && (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }}>
        <div className="w-full max-w-sm rounded-xl shadow-2xl overflow-hidden" style={{ background: "var(--bf-secondary)" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--bf-quaternary)" }}>
            <div>
              <p className="text-white font-bold">Add {inviteAgent.name}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--bf-gray)" }}>Choose a server to add this agent to</p>
            </div>
            <button onClick={() => { setInviteAgent(null); setInvited(null); }} className="rounded p-1 hover:bg-[var(--bf-quinary)]" style={{ color: "var(--bf-gray)" }}>
              <X size={18} />
            </button>
          </div>
          <div className="px-5 py-3 border-b flex items-center gap-3" style={{ borderColor: "var(--bf-quaternary)" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold text-white flex-shrink-0"
              style={{ background: CATEGORY_COLOR[inviteAgent.category] ?? "var(--bf-accent)" }}>
              {inviteAgent.name[0]}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-white text-sm font-semibold">{inviteAgent.name}</span>
                {inviteAgent.tee && <ShieldCheck size={12} style={{ color: "#43b581" }} strokeWidth={2} />}
              </div>
              <p className="text-xs" style={{ color: "var(--bf-gray)" }}>{inviteAgent.model} · {inviteAgent.price}</p>
            </div>
          </div>
          <div className="px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--bf-gray)" }}>Your Servers</p>
            {servers.length === 0 && <p className="text-sm text-center py-4" style={{ color: "var(--bf-gray)" }}>No servers yet. Create one first.</p>}
            <div className="flex flex-col gap-1">
              {servers.map(srv => (
                <button key={srv.id} onClick={() => setSelectedServerId(srv.id)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors w-full text-left"
                  style={{ background: selectedServerId === srv.id ? "var(--bf-quinary)" : "transparent", border: selectedServerId === srv.id ? "1px solid var(--bf-accent)" : "1px solid transparent" }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ background: srv.color }}>
                    {srv.name[0].toUpperCase()}
                  </div>
                  <span className="text-sm text-white flex-1">{srv.name}</span>
                  {selectedServerId === srv.id && <Check size={15} style={{ color: "var(--bf-accent)" }} strokeWidth={2.5} />}
                </button>
              ))}
            </div>
          </div>
          <div className="px-5 py-4 border-t flex gap-2 justify-end" style={{ borderColor: "var(--bf-quaternary)" }}>
            {invited ? (
              <>
                <span className="text-sm flex items-center gap-1.5 mr-auto" style={{ color: "#43b581" }}>
                  <Check size={14} strokeWidth={2.5} /> Added to {servers.find(s => s.id === invited)?.name}
                </span>
                <button onClick={() => { setInviteAgent(null); setInvited(null); }} className="text-sm px-4 py-2 rounded-lg font-semibold" style={{ background: "var(--bf-quinary)", color: "var(--bf-gray)" }}>
                  Close
                </button>
                <button onClick={handleGoToServer} className="text-sm px-4 py-2 rounded-lg font-semibold text-white" style={{ background: "var(--bf-accent)" }}>
                  Go to Server
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setInviteAgent(null)} className="text-sm px-4 py-2 rounded-lg font-semibold" style={{ background: "var(--bf-quinary)", color: "var(--bf-gray)" }}>Cancel</button>
                <button onClick={handleInviteConfirm} disabled={!selectedServerId} className="text-sm px-4 py-2 rounded-lg font-semibold text-white disabled:opacity-40" style={{ background: "var(--bf-accent)" }}>
                  Add to Server
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    )}

    {/* ── Create Agent Wizard ── */}
    {showWizard && (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.75)" }}>
        <div className="w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col" style={{ background: "var(--bf-primary)", maxHeight: "90vh" }}>

          {/* Progress bar + title */}
          <div className="px-6 pt-6 pb-0">
            <div className="flex gap-1.5 mb-3">
              {[1,2,3,4,5].map(i => (
                <div key={i} style={{ flex: 1, height: 3, borderRadius: 2,
                  background: i < wizStep ? "var(--bf-accent)" : i === wizStep ? "var(--bf-accent)" : "var(--bf-quinary)",
                  opacity: i === wizStep ? 1 : i < wizStep ? 0.55 : 0.35 }} />
              ))}
            </div>
            <p className="text-white text-xl font-bold mb-1">{STEP_TITLES[wizStep]}</p>
            <p className="text-xs mb-4" style={{ color: "var(--bf-gray)" }}>Step {wizStep} of 5</p>
          </div>

          {/* Scrollable body */}
          <div className="px-6 overflow-y-auto flex-1">

            {/* Step 1 — Identity */}
            {wizStep === 1 && (
              <div className="flex flex-col gap-4 pb-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--bf-gray)" }}>Agent Name *</label>
                  <input autoFocus value={draft.name} onChange={e => patch("name", e.target.value)}
                    placeholder="e.g. ResearchBot"
                    className="w-full rounded px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[var(--bf-accent)]"
                    style={{ background: "var(--bf-quaternary)" }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--bf-gray)" }}>Description</label>
                  <textarea rows={2} value={draft.description} onChange={e => patch("description", e.target.value)}
                    placeholder="What does this agent do?"
                    className="w-full rounded px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[var(--bf-accent)] resize-none"
                    style={{ background: "var(--bf-quaternary)" }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--bf-gray)" }}>Avatar Color</label>
                  <div className="flex items-center gap-4">
                    <div style={{ width: 48, height: 48, borderRadius: "50%", background: draft.avatarColor, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 20, flexShrink: 0 }}>
                      {draft.name.charAt(0).toUpperCase() || "?"}
                    </div>
                    <div className="flex gap-2">
                      {AVATAR_COLORS.map(c => (
                        <button key={c} onClick={() => patch("avatarColor", c)}
                          style={{ width: 28, height: 28, borderRadius: "50%", background: c, cursor: "pointer", border: draft.avatarColor === c ? "3px solid white" : "3px solid transparent" }} />
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--bf-gray)" }}>Category</label>
                  <div className="flex flex-wrap gap-2">
                    {WIZ_CATEGORIES.map(cat => (
                      <button key={cat} onClick={() => patch("category", cat)}
                        style={{ padding: "4px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: "pointer",
                          background: draft.category === cat ? "var(--bf-accent)" : "var(--bf-quaternary)", color: "white" }}>
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2 — Banner & Screenshots */}
            {wizStep === 2 && (
              <div className="flex flex-col gap-5 pb-2">
                {/* Banner preview */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--bf-gray)" }}>Banner</label>
                  <div className="relative rounded-xl overflow-hidden mb-3" style={{ height: 120, background: draft.bannerImage ? "transparent" : draft.bannerColor }}>
                    {draft.bannerImage
                      ? <img src={draft.bannerImage} alt="banner" className="w-full h-full object-cover" />
                      : null}
                    {/* Logo overlay on banner */}
                    <div className="absolute bottom-0 left-4 translate-y-1/2 w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white border-2"
                      style={{ background: draft.avatarColor, borderColor: "var(--bf-primary)", fontSize: 16 }}>
                      {draft.name.charAt(0).toUpperCase() || "?"}
                    </div>
                    {/* Upload overlay button */}
                    <button onClick={() => bannerInputRef.current?.click()}
                      className="absolute top-2 right-2 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
                      style={{ background: "rgba(0,0,0,0.55)", color: "white" }}>
                      <Upload size={12} /> {draft.bannerImage ? "Change" : "Upload"}
                    </button>
                    <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />
                  </div>
                  {draft.bannerImage && (
                    <button onClick={() => patch("bannerImage", "")} className="text-xs" style={{ color: "var(--bf-red)" }}>Remove image</button>
                  )}

                  {/* Gradient presets */}
                  {!draft.bannerImage && (
                    <>
                      <p className="text-xs mb-2" style={{ color: "var(--bf-gray)" }}>Or choose a gradient</p>
                      <div className="flex gap-2 flex-wrap">
                        {BANNER_PRESETS.map((bg, i) => (
                          <button key={i} onClick={() => patch("bannerColor", bg)}
                            style={{ width: 40, height: 24, borderRadius: 6, background: bg, cursor: "pointer",
                              border: draft.bannerColor === bg ? "2px solid white" : "2px solid transparent" }} />
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Screenshots */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--bf-gray)" }}>
                      Screenshots ({draft.screenshots.length}/5)
                    </label>
                    {draft.screenshots.length < 5 && (
                      <button onClick={() => ssInputRef.current?.click()}
                        className="flex items-center gap-1 text-xs font-semibold"
                        style={{ color: "var(--bf-accent)", cursor: "pointer" }}>
                        <ImagePlus size={14} /> Add Images
                      </button>
                    )}
                  </div>
                  <input ref={ssInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleScreenshotUpload} />

                  {draft.screenshots.length === 0 ? (
                    <button onClick={() => ssInputRef.current?.click()}
                      className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-8 transition-colors hover:border-[var(--bf-accent)]"
                      style={{ borderColor: "var(--bf-quinary)", color: "var(--bf-gray)" }}>
                      <ImagePlus size={28} />
                      <p className="text-xs">Click to upload up to 5 screenshots</p>
                    </button>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {draft.screenshots.map((ss, i) => (
                        <div key={i} className="relative rounded-lg overflow-hidden" style={{ aspectRatio: "16/9" }}>
                          <img src={ss} alt="" className="w-full h-full object-cover" />
                          <button onClick={() => removeScreenshot(i)}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
                            style={{ background: "rgba(0,0,0,0.6)", color: "white" }}>
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                      {draft.screenshots.length < 5 && (
                        <button onClick={() => ssInputRef.current?.click()}
                          className="rounded-lg border-2 border-dashed flex items-center justify-center transition-colors hover:border-[var(--bf-accent)]"
                          style={{ borderColor: "var(--bf-quinary)", color: "var(--bf-gray)", aspectRatio: "16/9" }}>
                          <Plus size={20} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 3 — Model & Rates */}
            {wizStep === 3 && (
              <div className="flex flex-col gap-4 pb-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--bf-gray)" }}>Model</label>
                  <div className="flex flex-col gap-2">
                    {MODELS.map(m => (
                      <button key={m.id} onClick={() => patch("model", m.id)}
                        style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", borderRadius: 8, textAlign: "left", cursor: "pointer",
                          background: draft.model === m.id ? "var(--bf-quinary)" : "var(--bf-quaternary)",
                          border: `2px solid ${draft.model === m.id ? "var(--bf-accent)" : "transparent"}` }}>
                        <span style={{ width: 16, height: 16, borderRadius: "50%", flexShrink: 0, marginTop: 2, display: "inline-block",
                          background: draft.model === m.id ? "var(--bf-accent)" : "transparent",
                          border: draft.model === m.id ? "none" : "2px solid var(--bf-gray)" }} />
                        <div>
                          <p style={{ color: "white", fontWeight: 700, fontSize: 14 }}>{m.label}</p>
                          <p style={{ color: "var(--bf-gray)", fontSize: 12, marginTop: 2 }}>{m.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--bf-gray)" }}>Rate Input (0G/1k)</label>
                    <input type="number" step="0.0001" min="0" value={draft.rateInput} onChange={e => patch("rateInput", parseFloat(e.target.value) || 0)}
                      className="w-full rounded px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[var(--bf-accent)]"
                      style={{ background: "var(--bf-quaternary)" }} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--bf-gray)" }}>Rate Output (0G/1k)</label>
                    <input type="number" step="0.0001" min="0" value={draft.rateOutput} onChange={e => patch("rateOutput", parseFloat(e.target.value) || 0)}
                      className="w-full rounded px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[var(--bf-accent)]"
                      style={{ background: "var(--bf-quaternary)" }} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--bf-gray)" }}>Acquisition Mode</label>
                  <div className="flex gap-2">
                    {ACQ_MODES.map(mode => (
                      <button key={mode} onClick={() => patch("acquisition", mode)}
                        style={{ padding: "5px 16px", borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: "pointer", textTransform: "capitalize",
                          background: draft.acquisition === mode ? "var(--bf-accent)" : "var(--bf-quaternary)", color: "white" }}>
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 4 — System Prompt & Skills */}
            {wizStep === 4 && (
              <div className="flex flex-col gap-4 pb-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--bf-gray)" }}>System Prompt</label>
                  <textarea rows={5} value={draft.systemPrompt} onChange={e => patch("systemPrompt", e.target.value)}
                    placeholder="You are a helpful agent that..."
                    className="w-full rounded px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[var(--bf-accent)] resize-none"
                    style={{ background: "var(--bf-quaternary)" }} />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--bf-gray)" }}>Skills (up to 3)</label>
                    {draft.skills.length < 3 && (
                      <button onClick={addSkill} style={{ color: "var(--bf-accent)", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                        <Plus size={14} /> Add Skill
                      </button>
                    )}
                  </div>
                  {draft.skills.length === 0 && <p style={{ color: "var(--bf-gray)", fontSize: 12 }}>No skills yet. Add up to 3 slash-command skills.</p>}
                  {draft.skills.map((skill, i) => (
                    <div key={i} style={{ background: "var(--bf-quaternary)", borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        {(["command", "name", "description"] as const).map(field => (
                          <div key={field}>
                            <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--bf-gray)" }}>{field}</label>
                            <input value={skill[field]} onChange={e => patchSkill(i, field, e.target.value)}
                              placeholder={field === "command" ? "/search" : field === "name" ? "Web Search" : "Search the web"}
                              className="w-full rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[var(--bf-accent)]"
                              style={{ background: "var(--bf-quinary)" }} />
                          </div>
                        ))}
                      </div>
                      <button onClick={() => removeSkill(i)} style={{ color: "var(--bf-red)", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 3, cursor: "pointer" }}>
                        <X size={12} /> Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 5 — Review */}
            {wizStep === 5 && (
              <div className="flex flex-col gap-3 pb-2">
                {/* Banner preview */}
                <div className="rounded-xl overflow-hidden relative" style={{ height: 80, background: draft.bannerImage ? "transparent" : draft.bannerColor }}>
                  {draft.bannerImage && <img src={draft.bannerImage} alt="" className="w-full h-full object-cover" />}
                  <div className="absolute bottom-0 left-4 translate-y-1/2 w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white border-4"
                    style={{ background: draft.avatarColor, borderColor: "var(--bf-primary)", fontSize: 18 }}>
                    {draft.name.charAt(0).toUpperCase()}
                  </div>
                </div>

                <div className="pt-6 px-1 flex items-center gap-3">
                  <div>
                    <p className="text-white text-lg font-bold">{draft.name}</p>
                    <p style={{ color: "var(--bf-gray)", fontSize: 12 }}>{draft.description || "No description"}</p>
                    {draft.category && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "var(--bf-accent)", color: "white", fontWeight: 600, marginTop: 4, display: "inline-block" }}>{draft.category}</span>}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[{ label: "Model", value: draft.model }, { label: "Rate In", value: `${draft.rateInput} 0G` }, { label: "Rate Out", value: `${draft.rateOutput} 0G` }].map(item => (
                    <div key={item.label} className="rounded p-3" style={{ background: "var(--bf-quaternary)" }}>
                      <p style={{ color: "var(--bf-gray)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{item.label}</p>
                      <p className="text-white font-semibold text-sm">{item.value}</p>
                    </div>
                  ))}
                </div>

                {draft.screenshots.length > 0 && (
                  <div>
                    <p style={{ color: "var(--bf-gray)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Screenshots ({draft.screenshots.length})</p>
                    <div className="flex gap-2 overflow-x-auto">
                      {draft.screenshots.map((ss, i) => (
                        <img key={i} src={ss} alt="" className="rounded flex-shrink-0 object-cover" style={{ width: 96, height: 54 }} />
                      ))}
                    </div>
                  </div>
                )}

                {draft.systemPrompt && (
                  <div className="rounded p-3" style={{ background: "var(--bf-quaternary)" }}>
                    <p style={{ color: "var(--bf-gray)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>System Prompt</p>
                    <p className="text-white text-sm" style={{ overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>{draft.systemPrompt}</p>
                  </div>
                )}

                {draft.skills.length > 0 && (
                  <div>
                    <p style={{ color: "var(--bf-gray)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Skills</p>
                    {draft.skills.map((s, i) => (
                      <div key={i} className="flex items-center gap-3 rounded p-2 mb-1" style={{ background: "var(--bf-quaternary)" }}>
                        <code style={{ color: "var(--bf-accent)", fontSize: 12 }}>{s.command}</code>
                        <span className="text-white text-sm font-medium">{s.name}</span>
                        <span style={{ color: "var(--bf-gray)", fontSize: 12, marginLeft: "auto" }}>{s.description}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer nav */}
          <div className="px-6 py-4 flex justify-between items-center border-t flex-shrink-0" style={{ borderColor: "var(--bf-quinary)" }}>
            <button onClick={wizStep === 1 ? closeWizard : () => setWizStep(s => (s - 1) as WizardStep)}
              style={{ color: "var(--bf-gray)", fontSize: 14, fontWeight: 500, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
              {wizStep === 1 ? "Cancel" : <><ChevronLeft size={16} /> Back</>}
            </button>
            {wizStep < 5 ? (
              <button disabled={nextDisabled} onClick={() => setWizStep(s => (s + 1) as WizardStep)}
                style={{ background: "var(--bf-accent)", color: "white", padding: "8px 20px", borderRadius: 6, fontWeight: 600, fontSize: 14,
                  display: "flex", alignItems: "center", gap: 4, opacity: nextDisabled ? 0.4 : 1, cursor: nextDisabled ? "default" : "pointer" }}>
                Next <ChevronRight size={16} />
              </button>
            ) : (
              <button onClick={handleCreate}
                style={{ background: "var(--bf-green)", color: "white", padding: "8px 20px", borderRadius: 6, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                Create Agent
              </button>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function DetailRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-xs flex-shrink-0" style={{ color: "var(--bf-gray)" }}>{label}</span>
      <span className="text-xs font-medium text-right" style={{ color: color ?? "white" }}>{value}</span>
    </div>
  );
}
