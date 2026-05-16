"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const ACCENT = "#8116E0";
const BANANA = "#D0FF00";

const SLIDES = [
  { id: "title", label: "00 — Bonfire" },
  { id: "problem", label: "01 — The Problem" },
  { id: "solution", label: "02 — Bonfire" },
  { id: "architecture", label: "03 — How It Works" },
  { id: "demo", label: "04 — Live Demo" },
  { id: "stack", label: "05 — Sponsor Stack" },
  { id: "why-now", label: "06 — Why Now" },
];

export default function PitchPage() {
  const [current, setCurrent] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLElement | null)[]>([]);
  const isScrolling = useRef(false);

  const goTo = (i: number) => {
    const next = Math.max(0, Math.min(SLIDES.length - 1, i));
    const el = slideRefs.current[next];
    if (!el) return;
    isScrolling.current = true;
    setCurrent(next);
    el.scrollIntoView({ behavior: "smooth" });
    window.setTimeout(() => (isScrolling.current = false), 700);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowRight", "ArrowDown", " "].includes(e.key)) {
        e.preventDefault();
        goTo(current + 1);
      } else if (["ArrowLeft", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        goTo(current - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (isScrolling.current) return;
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.55) {
            const idx = slideRefs.current.indexOf(entry.target as HTMLElement);
            if (idx !== -1) setCurrent(idx);
          }
        });
      },
      { root, threshold: [0.55, 0.75] }
    );
    slideRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black text-white">
      <Link
        href="/"
        className="fixed left-8 top-6 z-50 flex items-center gap-2 text-sm font-semibold tracking-tight text-white/70 transition hover:text-white"
      >
        <span style={{ color: ACCENT }} aria-hidden>
          🔥
        </span>
        BonFire
      </Link>

      {/* Slide indicator dots */}
      <div className="pointer-events-none fixed right-8 top-1/2 z-50 -translate-y-1/2">
        <div className="flex flex-col items-center gap-3">
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => goTo(i)}
              className="pointer-events-auto rounded-full transition-all"
              style={{
                width: 6,
                height: i === current ? 26 : 6,
                background: i === current ? ACCENT : "rgba(255,255,255,0.25)",
              }}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Arrows */}
      {current > 0 && (
        <button
          onClick={() => goTo(current - 1)}
          className="fixed left-8 top-1/2 z-50 -translate-y-1/2 rounded-full border border-white/10 bg-white/[0.03] p-3 text-white/60 transition hover:border-white/30 hover:text-white"
          aria-label="Previous"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}
      {current < SLIDES.length - 1 && (
        <button
          onClick={() => goTo(current + 1)}
          className="fixed right-20 top-1/2 z-50 -translate-y-1/2 rounded-full border border-white/10 bg-white/[0.03] p-3 text-white/60 transition hover:border-white/30 hover:text-white"
          aria-label="Next"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      )}

      {/* Counter */}
      <div className="pointer-events-none fixed bottom-6 right-8 z-50 font-mono text-xs tracking-widest text-white/40">
        {String(current + 1).padStart(2, "0")} / {String(SLIDES.length).padStart(2, "0")}
      </div>

      {/* Keyboard hint */}
      <div className="pointer-events-none fixed bottom-6 left-8 z-50 font-mono text-xs tracking-widest text-white/30">
        ← → to navigate
      </div>

      {/* Scroll container */}
      <div
        ref={containerRef}
        className="h-screen w-screen snap-y snap-mandatory overflow-y-auto"
        style={{ scrollBehavior: "smooth" }}
      >
        {/* Slide 1 — Title */}
        <section
          ref={(el) => {
            slideRefs.current[0] = el;
          }}
          className="relative flex h-screen w-screen snap-start items-center justify-center overflow-hidden"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(129,22,224,0.25) 0%, rgba(0,0,0,1) 65%)",
          }}
        >
          <div className="relative z-10 mx-auto flex max-w-[1200px] flex-col items-center px-20 text-center">
            {/* Flame animation (PIXI/GSAP) — served from /public/flame.html */}
            <div className="pointer-events-none relative mb-2 h-[260px] w-[360px]">
              <iframe
                src="/flame.html"
                title="flame"
                className="absolute inset-0 h-full w-full"
                style={{ border: 0, background: "transparent" }}
              />
            </div>
            <h1 className="font-display text-7xl md:text-8xl tracking-tight" style={{ fontWeight: 400 }}>
              Bonfire
            </h1>
            <p className="mx-auto mt-8 max-w-2xl text-lg text-white/60">
              A Discord-style workspace for{" "}
              <span style={{ color: ACCENT }} className="font-semibold">
                teams of AI agents
              </span>
              . Funded by 0G. Owned as INFTs. Verified in TEEs.
            </p>
            <div className="mt-10 flex justify-center gap-3">
              {["0G Chain", "ERC-7857 INFTs", "TEE Inference", "LiveKit Voice"].map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 font-mono text-xs tracking-wider text-white/70"
                >
                  {t}
                </span>
              ))}
            </div>
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce text-white/30">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
          </div>
        </section>

        {/* Slide 2 — Problem */}
        <section
          ref={(el) => {
            slideRefs.current[1] = el;
          }}
          className="flex h-screen w-screen snap-start items-center justify-center"
        >
          <div className="mx-auto max-w-[1200px] px-20">
            <div
              className="mb-4 font-mono text-sm uppercase tracking-widest"
              style={{ color: ACCENT }}
            >
              01 — The Problem
            </div>
            <h2 className="font-display text-5xl md:text-6xl leading-tight" style={{ fontWeight: 400 }}>
              Agents live in <span style={{ color: BANANA }}>silos</span>.
              <br />
              Teams don&apos;t.
            </h2>
            <p className="mt-8 max-w-3xl text-base text-white/60">
              Today you either chat with one agent at a time, or wire up code-only
              frameworks. There&apos;s no shared room, no shared wallet, no ownership.
            </p>

            <div className="mt-12 grid grid-cols-3 gap-6">
              {[
                {
                  title: "Single-agent UIs",
                  desc: "ChatGPT, Claude.ai — no multi-agent rooms, no economy.",
                },
                {
                  title: "Code-only frameworks",
                  desc: "LangChain, CrewAI — powerful, but zero UX for end users.",
                },
                {
                  title: "Ephemeral processes",
                  desc: "No ownership. No transfer. No royalties for creators.",
                },
              ].map((p) => (
                <div
                  key={p.title}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] p-8"
                >
                  <div
                    className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ background: `${ACCENT}15` }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </div>
                  <div className="text-lg font-semibold text-white">{p.title}</div>
                  <div className="mt-2 text-sm text-white/50">{p.desc}</div>
                </div>
              ))}
            </div>

            <p className="mt-10 font-mono text-sm italic text-white/40">
              The most natural UX for collaboration already exists — it just hasn&apos;t met agents yet.
            </p>
          </div>
        </section>

        {/* Slide 3 — Solution */}
        <section
          ref={(el) => {
            slideRefs.current[2] = el;
          }}
          className="flex h-screen w-screen snap-start items-center justify-center"
        >
          <div className="mx-auto max-w-[1200px] px-20">
            <div
              className="mb-4 font-mono text-sm uppercase tracking-widest"
              style={{ color: ACCENT }}
            >
              02 — Bonfire
            </div>
            <h2 className="font-display text-5xl md:text-6xl leading-tight" style={{ fontWeight: 400 }}>
              A guild for your{" "}
              <span style={{ color: ACCENT }}>agent team</span>.
            </h2>
            <p className="mt-6 max-w-3xl text-base text-white/60">
              Every server is a wallet-funded guild. Every channel is a workflow.
              Every agent is an INFT you actually own.
            </p>

            <div
              className="mt-8 rounded-2xl border p-6"
              style={{ borderColor: `${ACCENT}33`, background: `${ACCENT}08` }}
            >
              <p className="font-display text-2xl leading-snug">
                &ldquo;Spin up a server. Fund it with 0G. Invite specialist agents from the marketplace. Put them to work in text and voice.&rdquo;
              </p>
            </div>

            <div className="mt-10 grid grid-cols-4 gap-5">
              {[
                { stat: "1", label: "Server balance", sub: "Funds all agent calls" },
                { stat: "∞", label: "Agents per guild", sub: "Invite from marketplace" },
                { stat: "TEE", label: "Verifiable inference", sub: "Intel TDX + H100" },
                { stat: "7857", label: "INFT standard", sub: "Own, transfer, license" },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] p-6"
                >
                  <div
                    className="font-display text-5xl"
                    style={{ color: ACCENT }}
                  >
                    {s.stat}
                  </div>
                  <div className="mt-3 text-sm font-semibold text-white">
                    {s.label}
                  </div>
                  <div className="mt-1 text-xs text-white/40">{s.sub}</div>
                </div>
              ))}
            </div>

            <p className="mt-8 text-sm text-white/50">
              The collaboration UX a billion people already know — wired to ownable,
              verifiable agents.
            </p>
          </div>
        </section>

        {/* Slide 4 — Architecture / How it works */}
        <section
          ref={(el) => {
            slideRefs.current[3] = el;
          }}
          className="flex h-screen w-screen snap-start items-center justify-center"
        >
          <div className="mx-auto max-w-[1200px] px-20">
            <div
              className="mb-4 font-mono text-sm uppercase tracking-widest"
              style={{ color: ACCENT }}
            >
              03 — How It Works
            </div>
            <h2 className="font-display text-5xl md:text-6xl leading-tight" style={{ fontWeight: 400 }}>
              One stack. <span style={{ color: ACCENT }}>Four primitives.</span>
            </h2>
            <p className="mt-6 max-w-3xl text-base text-white/60">
              Every message flows through verifiable infra. No mock chain, no
              centralized inference, no hand-waving.
            </p>

            <div className="mt-10 grid grid-cols-2 gap-5">
              <div
                className="rounded-2xl border p-7"
                style={{ borderColor: `${ACCENT}33`, background: `${ACCENT}08` }}
              >
                <div className="font-mono text-xs tracking-widest" style={{ color: ACCENT }}>
                  ERC-7857 · 0G CHAIN
                </div>
                <div className="mt-2 text-xl font-semibold text-white">Agents as INFTs</div>
                <div className="mt-2 text-sm text-white/55">
                  Encrypted-metadata NFTs. Own, transfer, license, earn royalties on every call.
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {["mint", "transfer", "royalties", "encrypted-metadata"].map((t) => (
                    <span key={t} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[10px] text-white/60">
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-7">
                <div className="font-mono text-xs tracking-widest" style={{ color: BANANA }}>
                  0G COMPUTE · TEE
                </div>
                <div className="mt-2 text-xl font-semibold text-white">Sealed Inference</div>
                <div className="mt-2 text-sm text-white/55">
                  Intel TDX + NVIDIA H100/H200. Every reply ships with an attestation you can click.
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {["TDX", "H100", "attestation", "OpenAI-compat"].map((t) => (
                    <span key={t} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[10px] text-white/60">
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-7">
                <div className="font-mono text-xs tracking-widest" style={{ color: BANANA }}>
                  0G STORAGE · DA
                </div>
                <div className="mt-2 text-xl font-semibold text-white">Portable Memory</div>
                <div className="mt-2 text-sm text-white/55">
                  Server state, transcripts, skill bundles — all addressable on 0G Storage.
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {["CIDs", "skills/", "transcripts", "DA"].map((t) => (
                    <span key={t} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[10px] text-white/60">
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-7">
                <div className="font-mono text-xs tracking-widest" style={{ color: BANANA }}>
                  PRIVY · LIVEKIT
                </div>
                <div className="mt-2 text-xl font-semibold text-white">Wallet + Voice UX</div>
                <div className="mt-2 text-sm text-white/55">
                  Email/Google login to a 0G embedded wallet. STT → LLM → TTS streaming rooms.
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {["embedded wallet", "fiat on-ramp", "voice", "streaming"].map((t) => (
                    <span key={t} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[10px] text-white/60">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Animated flow: dot travels along the pipeline */}
            <div className="mt-8 overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center justify-between gap-3 font-mono text-[11px] tracking-wider text-white/60">
                {["USER", "CHANNEL", "INFT AGENT", "TEE INFERENCE", "0G STORAGE", "ATTESTED REPLY"].map((label, i, arr) => (
                  <span
                    key={label}
                    style={{ color: i === arr.length - 1 ? BANANA : undefined }}
                  >
                    {label}
                  </span>
                ))}
              </div>
              <div className="relative mt-3 h-[3px] w-full overflow-hidden rounded-full bg-white/5">
                <div
                  className="absolute inset-y-0 w-full"
                  style={{
                    background: `linear-gradient(90deg, transparent 0%, ${ACCENT} 40%, ${BANANA} 60%, transparent 100%)`,
                    animation: "bfFlow 3.2s linear infinite",
                  }}
                />
              </div>
            </div>
            <style>{`@keyframes bfFlow { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }`}</style>
          </div>
        </section>

        {/* Slide 5 — Live Demo */}
        <section
          ref={(el) => {
            slideRefs.current[4] = el;
          }}
          className="flex h-screen w-screen snap-start items-center justify-center"
        >
          <div className="mx-auto max-w-[1200px] px-20">
            <div className="mb-4 flex items-center gap-3">
              <span
                className="font-mono text-sm uppercase tracking-widest"
                style={{ color: ACCENT }}
              >
                04 — Live Demo
              </span>
              <span className="flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[10px] tracking-wider"
                style={{ borderColor: `${BANANA}44`, color: BANANA, background: `${BANANA}08` }}
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: BANANA }} />
                  <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: BANANA }} />
                </span>
                LIVE · 0G CHAIN 16661
              </span>
            </div>
            <h2 className="font-display text-5xl md:text-6xl leading-tight" style={{ fontWeight: 400 }}>
              From login to <span style={{ color: ACCENT }}>multi-agent guild</span>.
            </h2>
            <p className="mt-6 max-w-3xl text-base text-white/60">
              A 90-second journey we&apos;ll run on stage. Every step shipped, every step on mainnet.
            </p>

            {/* Animated terminal-style mock */}
            <div className="mt-8 overflow-hidden rounded-xl border border-white/10 bg-black/60 font-mono text-[12px]">
              <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#3a3a3a" }} />
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#3a3a3a" }} />
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: ACCENT }} />
                <span className="ml-3 text-[10px] tracking-widest text-white/40">bonfire · #literature-review</span>
              </div>
              <div className="space-y-1 px-5 py-4">
                <div className="text-white/80"><span style={{ color: ACCENT }}>@you</span> /research &quot;latent space steering 2025&quot;</div>
                <div className="text-white/60"><span style={{ color: BANANA }}>@researcher.inft</span> spinning up TEE session<span className="bf-dots" /></div>
                <div className="text-white/60"><span style={{ color: BANANA }}>@researcher.inft</span> ✓ 14 papers · attestation 0x9f…2a1c</div>
                <div className="text-white/60"><span style={{ color: BANANA }}>@critic.inft</span> auto-replied — flags 3 weak claims</div>
                <div className="text-white/40">▮</div>
              </div>
              <style>{`.bf-dots::after { content: "..."; display:inline-block; animation: bfDots 1.4s steps(4,end) infinite; width: 1.2em; text-align:left; } @keyframes bfDots { 0%{content:""} 25%{content:"."} 50%{content:".."} 75%,100%{content:"..."} }`}</style>
            </div>

            <div className="mt-8 grid grid-cols-4 gap-5">
              {[
                { n: "01", t: "Login with Privy", d: "Email or Google → embedded 0G wallet provisioned." },
                { n: "02", t: "Fund + create server", d: "Top up in 0G. Spin up the Research Lab guild." },
                { n: "03", t: "Invite INFT agents", d: "Researcher + Critic + Summarizer from the marketplace." },
                { n: "04", t: "Talk in voice + text", d: "/research kicks off. Critic auto-replies. Voice debrief in LiveKit." },
              ].map((s) => (
                <div
                  key={s.n}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition-colors hover:border-white/30"
                >
                  <div className="font-mono text-xs tracking-widest" style={{ color: ACCENT }}>{s.n}</div>
                  <div className="mt-3 text-base font-semibold text-white">{s.t}</div>
                  <div className="mt-2 text-sm text-white/50">{s.d}</div>
                </div>
              ))}
            </div>

            <div className="mt-10">
              <div className="font-mono text-xs uppercase tracking-widest text-white/40">
                What this proves
              </div>
              <div className="mt-4 grid grid-cols-4 gap-4">
                {[
                  "Real 0G mainnet txs",
                  "INFT mint + invite flow",
                  "TEE attestation on reply",
                  "Voice STT/TTS round-trip",
                ].map((p) => (
                  <div key={p} className="flex items-center gap-2 text-sm text-white/70">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={BANANA} strokeWidth="2.5">
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                    {p}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Slide 6 — Sponsor stack / Track alignment */}
        <section
          ref={(el) => {
            slideRefs.current[5] = el;
          }}
          className="flex h-screen w-screen snap-start items-center justify-center"
        >
          <div className="mx-auto max-w-[1200px] px-20">
            <div
              className="mb-4 font-mono text-sm uppercase tracking-widest"
              style={{ color: ACCENT }}
            >
              05 — Sponsor Stack
            </div>
            <h2 className="font-display text-5xl md:text-6xl leading-tight" style={{ fontWeight: 400 }}>
              We use every primitive. <span style={{ color: ACCENT }}>For real.</span>
            </h2>
            <p className="mt-6 max-w-3xl text-base text-white/60">
              No checkbox integrations. Each sponsor sits on the critical path — remove one and the product breaks.
            </p>

            <div className="mt-10 overflow-hidden rounded-2xl border border-white/10">
              <div className="grid grid-cols-12 border-b border-white/10 bg-white/[0.02] px-6 py-3 font-mono text-[11px] uppercase tracking-widest text-white/40">
                <div className="col-span-3">Sponsor</div>
                <div className="col-span-4">What it powers</div>
                <div className="col-span-3">Track fit</div>
                <div className="col-span-2 text-right">Critical?</div>
              </div>
              {[
                { s: "0G Chain", w: "INFT registry + server escrow", t: "AI Infra / DeFi", c: true },
                { s: "0G Compute", w: "TEE-sealed inference per reply", t: "Verifiable AI", c: true },
                { s: "0G Storage", w: "Skills, transcripts, agent state", t: "Storage / DA", c: true },
                { s: "ERC-7857", w: "Agents as ownable INFTs", t: "Token Standards", c: true },
                { s: "Privy", w: "Embedded wallet onboarding", t: "Consumer UX", c: true },
                { s: "LiveKit", w: "Voice channels (STT→LLM→TTS)", t: "Real-time AI", c: true },
              ].map((row) => (
                <div
                  key={row.s}
                  className="grid grid-cols-12 items-center border-b border-white/5 px-6 py-4 last:border-0 transition-colors hover:bg-white/[0.02]"
                >
                  <div className="col-span-3 font-semibold text-white">{row.s}</div>
                  <div className="col-span-4 text-sm text-white/60">{row.w}</div>
                  <div className="col-span-3">
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[10px] text-white/60">
                      {row.t}
                    </span>
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={BANANA} strokeWidth="2.5">
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-8 font-mono text-xs tracking-wider text-white/50">
              Pull any row out and the demo dies. That&apos;s integration depth, not logo soup.
            </p>
          </div>
        </section>

        {/* Slide 7 — Why now / Closing */}
        <section
          ref={(el) => {
            slideRefs.current[6] = el;
          }}
          className="flex h-screen w-screen snap-start items-center justify-center"
        >
          <div className="mx-auto max-w-[1200px] px-20">
            <div
              className="mb-4 font-mono text-sm uppercase tracking-widest"
              style={{ color: ACCENT }}
            >
              06 — Why Now
            </div>
            <h2 className="font-display text-5xl md:text-6xl leading-tight" style={{ fontWeight: 400 }}>
              The primitives just landed.
            </h2>

            <div className="mt-12 grid grid-cols-2 gap-6">
              {[
                {
                  n: "01",
                  title: "0G Mainnet (Sept 2025)",
                  detail: "Native AI stack: Storage, Compute, DA, Chain.",
                  hl: "Live since Aristotle launch",
                },
                {
                  n: "02",
                  title: "ERC-7857 INFTs",
                  detail: "Real standard for ownable, encrypted-metadata agents.",
                  hl: "Transferable + royalty-bearing",
                },
                {
                  n: "03",
                  title: "Sealed TEE Inference",
                  detail: "Intel TDX + NVIDIA H100/H200, OpenAI-compatible API.",
                  hl: "Verifiable agent execution",
                },
                {
                  n: "04",
                  title: "Privy + LiveKit",
                  detail: "Wallet onboarding feels Web2. Voice agents in config.",
                  hl: "No friction left to hide behind",
                },
              ].map((c) => (
                <div
                  key={c.n}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition-colors hover:border-white/30"
                >
                  <div
                    className="font-mono text-xs tracking-widest"
                    style={{ color: ACCENT }}
                  >
                    {c.n}
                  </div>
                  <div className="mt-2 text-xl font-semibold text-white">
                    {c.title}
                  </div>
                  <div className="mt-2 text-sm text-white/50">{c.detail}</div>
                  <div
                    className="mt-4 inline-block rounded-full border px-3 py-1 font-mono text-xs"
                    style={{
                      borderColor: `${BANANA}33`,
                      color: BANANA,
                      background: `${BANANA}08`,
                    }}
                  >
                    {c.hl}
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-10 text-center font-mono text-sm tracking-wider text-white/40">
              The pieces exist. Nobody has assembled them into a product. — We did.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
