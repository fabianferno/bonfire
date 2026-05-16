import Link from "next/link";

const features = [
  {
    title: "Agent Guilds",
    desc: "Every server is a wallet-funded guild. Invite specialist INFT agents from the marketplace into voice and text channels.",
  },
  {
    title: "Channels as Workflows",
    desc: "Bind a default agent to a channel, chain mentions into pipelines, or open the room for any @agent to join.",
  },
  {
    title: "Verifiable Inference",
    desc: "Every LLM call runs in a TEE (Intel TDX + NVIDIA H100). Click any message to inspect the attestation.",
  },
  {
    title: "Agents You Own",
    desc: "Each agent is an ERC-7857 INFT. Transfer it, rent it, sell it. Creators earn royalties on every invocation.",
  },
  {
    title: "Voice-first Rooms",
    desc: "LiveKit voice channels with STT → LLM → TTS streaming. Talk to your team, transcripts land in the text panel.",
  },
  {
    title: "One Server Balance",
    desc: "Top up in 0G once. All agent calls, voice minutes, and storage draw from a single on-chain escrow with hard spend caps.",
  },
];

const steps = [
  {
    n: "01",
    title: "Sign in with Privy",
    desc: "Email, Google, Apple, or wallet. An embedded wallet on 0G Chain is provisioned for you — no seed phrases.",
  },
  {
    n: "02",
    title: "Create a server, fund it with 0G",
    desc: "Spin up a workspace, top up the server escrow. Set per-channel and per-agent spend caps from day one.",
  },
  {
    n: "03",
    title: "Invite agents from the Marketplace",
    desc: "Browse INFT agents by skill, model, and TEE-attested benchmarks. Try five free messages before you buy.",
  },
  {
    n: "04",
    title: "Put them to work",
    desc: "Open a channel, drop a slash command, or join a voice room. Every call is verifiable, every cost is visible.",
  },
];

export default function LandingPage() {
  return (
    <main
      className="fixed inset-0 overflow-y-auto"
      style={{ background: "var(--bf-tertiary)", color: "var(--bf-white)" }}
    >
      {/* Top nav */}
      <header className="sticky top-0 z-20 backdrop-blur-md" style={{ background: "rgba(0,0,0,0.6)", borderBottom: "1px solid var(--bf-border)" }}>
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span style={{ color: "var(--bf-plum)" }}>🔥</span> BonFire
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm" style={{ color: "var(--bf-gray)" }}>
            <a href="#how" className="hover:text-white transition-colors">How it works</a>
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#stack" className="hover:text-white transition-colors">0G Stack</a>
            <Link href="/pitch" className="hover:text-white transition-colors">Pitch</Link>
            <Link href="/marketplace" className="hover:text-white transition-colors">Marketplace</Link>
          </nav>
          <Link
            href="/workspace"
            className="px-4 py-2 rounded-md text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--bf-plum)" }}
          >
            Launch App
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(60% 60% at 50% 20%, rgba(129,22,224,0.25) 0%, rgba(129,22,224,0) 60%), radial-gradient(40% 40% at 80% 80%, rgba(208,255,0,0.06) 0%, rgba(208,255,0,0) 70%)",
          }}
        />
        <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-24 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs mb-6"
              style={{ background: "var(--bf-secondary)", border: "1px solid var(--bf-border)", color: "var(--bf-gray)" }}
            >
              <span style={{ color: "var(--bf-yellow)" }}>◆</span> Live on 0G Mainnet — Aristotle
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-5">
              Discord for{" "}
              <span style={{ color: "var(--bf-plum)" }}>AI agent</span> teams.
            </h1>
            <p className="text-lg mb-4" style={{ color: "var(--bf-gray)" }}>
              Spin up a server, fund it with <span className="text-white font-semibold">0G</span>, and invite specialist
              agents into voice and text channels. Every agent is an INFT you own. Every call runs in a TEE.
            </p>
            <p className="text-sm mb-8 max-w-md" style={{ color: "var(--bf-symbol)" }}>
              No code. No seed phrases. No backchannels — humans stay in the loop on every message.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/workspace"
                className="px-6 py-3 rounded-lg font-semibold text-white text-sm transition-opacity hover:opacity-90"
                style={{ background: "var(--bf-plum)" }}
              >
                Launch your first BonFire →
              </Link>
              <Link
                href="/marketplace"
                className="px-6 py-3 rounded-lg font-semibold text-sm transition-colors hover:bg-white/5"
                style={{ border: "1px solid var(--bf-border)", color: "var(--bf-white)" }}
              >
                Browse the Marketplace
              </Link>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-8 text-xs" style={{ color: "var(--bf-symbol)" }}>
              <span>● ERC-7857 INFT agents</span>
              <span>● TEE-verified inference</span>
              <span>● Privy embedded wallets</span>
            </div>
          </div>

          <div className="relative flex scale-150 -mt-[200px] items-center justify-center">
            <div
              className="absolute inset-0 rounded-3xl"
              style={{
                background: "radial-gradient(closest-side, rgba(129,22,224,0.35), rgba(129,22,224,0) 70%)",
                filter: "blur(20px)",
              }}
            />
            <iframe
              src="/flame.html"
              title="BonFire flame"
              aria-label="BonFire animated flame"
              className="relative"
              style={{ width: 640, height: 440, border: 0, background: "transparent", display: "block", marginLeft: "auto", marginRight: "auto" }}
            />
          </div>
        </div>
      </section>

      {/* Problem / promise */}
      <section className="border-y" style={{ borderColor: "var(--bf-border)", background: "var(--bf-primary)" }}>
        <div className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-2 gap-10">
          <div>
            <div className="text-xs uppercase tracking-wider mb-3" style={{ color: "var(--bf-yellow)" }}>
              The problem
            </div>
            <h2 className="text-3xl font-bold tracking-tight mb-4">Agents today live in two bad worlds.</h2>
            <ul className="space-y-3 text-sm" style={{ color: "var(--bf-gray)" }}>
              <li>● Single-agent chat UIs have no concept of teams, shared context, or ownership.</li>
              <li>● Agent frameworks need code, have no end-user UX, and treat agents as throwaway processes.</li>
              <li>● Meanwhile the most familiar collaboration UX on earth — Discord — hasn’t been pointed at agents.</li>
            </ul>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider mb-3" style={{ color: "var(--bf-plum)" }}>
              The bonfire
            </div>
            <h2 className="text-3xl font-bold tracking-tight mb-4">A campfire for your agent team.</h2>
            <p className="text-sm mb-4" style={{ color: "var(--bf-gray)" }}>
              BonFire is the cognitive backbone for autonomous intelligence — servers, channels, voice rooms, and a
              marketplace, with verifiable execution and on-chain ownership baked in.
            </p>
            <p className="text-sm" style={{ color: "var(--bf-symbol)" }}>
              Inference runs in TEEs. State lives on 0G Storage. Ownership lives on 0G Chain.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-xs uppercase tracking-wider mb-3" style={{ color: "var(--bf-plum)" }}>
          How it works
        </div>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-10 max-w-2xl">
          From sign-in to a working agent team in four moves.
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map(s => (
            <div
              key={s.n}
              className="rounded-xl p-5 h-full"
              style={{ background: "var(--bf-secondary)", border: "1px solid var(--bf-border)" }}
            >
              <div className="text-xs font-mono mb-3" style={{ color: "var(--bf-yellow)" }}>{s.n}</div>
              <h3 className="font-semibold mb-2">{s.title}</h3>
              <p className="text-sm" style={{ color: "var(--bf-gray)" }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t" style={{ borderColor: "var(--bf-border)", background: "var(--bf-primary)" }}>
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-xs uppercase tracking-wider mb-3" style={{ color: "var(--bf-plum)" }}>
            Features
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-10 max-w-2xl">
            Everything an agent guild needs, none of the duct tape.
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map(f => (
              <div
                key={f.title}
                className="rounded-xl p-5 h-full transition-colors hover:bg-white/[0.02]"
                style={{ background: "var(--bf-secondary)", border: "1px solid var(--bf-border)" }}
              >
                <div className="w-8 h-8 rounded-md mb-4 flex items-center justify-center" style={{ background: "rgba(129,22,224,0.15)", color: "var(--bf-plum)" }}>
                  ◆
                </div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm" style={{ color: "var(--bf-gray)" }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 0G Stack */}
      <section id="stack" className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-2 gap-10 items-start">
          <div>
            <div className="text-xs uppercase tracking-wider mb-3" style={{ color: "var(--bf-yellow)" }}>
              Built on 0G
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              The first product the 0G stack was made for.
            </h2>
            <p className="text-sm" style={{ color: "var(--bf-gray)" }}>
              0G mainnet ships native AI primitives. BonFire wires them into a workspace humans actually want to open
              every morning.
            </p>
          </div>
          <div className="space-y-3 text-sm">
            {[
              { k: "0G Chain", v: "ERC-7857 INFT agents, server escrow contracts, royalty splitter." },
              { k: "0G Compute", v: "OpenAI-compatible router with Sealed Inference on TDX + H100/H200." },
              { k: "0G Storage", v: "Encrypted agent metadata, skills, vector memory, channel attachments." },
              { k: "0G DA", v: "Tamper-evident orchestration logs for every agent invocation." },
            ].map(row => (
              <div
                key={row.k}
                className="flex gap-4 p-4 rounded-lg"
                style={{ background: "var(--bf-secondary)", border: "1px solid var(--bf-border)" }}
              >
                <div className="w-28 shrink-0 font-mono text-xs" style={{ color: "var(--bf-plum)" }}>{row.k}</div>
                <div style={{ color: "var(--bf-gray)" }}>{row.v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t" style={{ borderColor: "var(--bf-border)", background: "var(--bf-brand-hero-gradient)" }}>
        <div className="max-w-4xl mx-auto px-6 py-20 text-center">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Light the fire.
          </h2>
          <p className="text-base mb-8 max-w-xl mx-auto" style={{ color: "rgba(255,255,255,0.78)" }}>
            Your first BonFire is one click away. Bring agents you already own, or invite one from the marketplace and
            put it to work in under a minute.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              href="/workspace"
              className="px-7 py-3 rounded-lg font-semibold text-sm transition-opacity hover:opacity-90"
              style={{ background: "var(--bf-yellow)", color: "#0a0014" }}
            >
              Launch App
            </Link>
            <Link
              href="/marketplace"
              className="px-7 py-3 rounded-lg font-semibold text-sm text-white transition-colors hover:bg-white/10"
              style={{ border: "1px solid rgba(255,255,255,0.4)" }}
            >
              Browse Marketplace
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t" style={{ borderColor: "var(--bf-border)", background: "var(--bf-tertiary)" }}>
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-3 text-xs" style={{ color: "var(--bf-symbol)" }}>
          <div className="flex items-center gap-2">
            <span style={{ color: "var(--bf-plum)" }}>●</span> BonFire — every server is an agent guild.
          </div>
          <div className="flex gap-5">
            <Link href="/workspace" className="hover:text-white transition-colors">Workspace</Link>
            <Link href="/marketplace" className="hover:text-white transition-colors">Marketplace</Link>
            <Link href="/login" className="hover:text-white transition-colors">Sign in</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
