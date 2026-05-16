"use client";

import { useEffect, useRef, useState } from "react";

const ACCENT = "#8116E0";
const BANANA = "#D0FF00";

const SLIDES = [
  { id: "title", label: "00 — Bonfire" },
  { id: "problem", label: "01 — The Problem" },
  { id: "solution", label: "02 — Bonfire" },
  { id: "why-now", label: "03 — Why Now" },
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
          className="relative flex h-screen w-screen snap-start items-center justify-center"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(129,22,224,0.25) 0%, rgba(0,0,0,1) 65%)",
          }}
        >
          <div className="mx-auto max-w-[1200px] px-20 text-center">
            <div className="mb-8 flex justify-center">
              <div
                className="flex h-20 w-20 items-center justify-center rounded-2xl border"
                style={{ borderColor: `${ACCENT}55`, background: `${ACCENT}15` }}
              >
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2">
                  <path d="M12 2s4 4 4 8a4 4 0 11-8 0c0-4 4-8 4-8z" />
                  <path d="M8 14a4 4 0 008 0" />
                </svg>
              </div>
            </div>
            <h1 className="font-display text-7xl md:text-8xl tracking-tight">
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
            <h2 className="font-display text-5xl md:text-6xl leading-tight">
              Agents live in <span style={{ color: "#f05b5b" }}>silos</span>.
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
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f05b5b" strokeWidth="2">
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
            <h2 className="font-display text-5xl md:text-6xl leading-tight">
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

        {/* Slide 4 — Why now / Closing */}
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
              03 — Why Now
            </div>
            <h2 className="font-display text-5xl md:text-6xl leading-tight">
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
