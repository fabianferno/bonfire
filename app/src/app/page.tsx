import Link from "next/link";
import { BF_BRAND_EMOJI } from "@/lib/brand";

export default function LandingPage() {
  return (
    <div className="h-full flex flex-col items-center justify-center px-6 text-center" style={{ background: "var(--bf-tertiary)" }}>
      <span
        className="mb-6 text-[7rem] leading-none select-none flex items-center justify-center"
        style={{ width: "7rem", height: "7rem" }}
        role="img"
        aria-label="BonFire"
      >
        {BF_BRAND_EMOJI}
      </span>
      <h1 className="text-5xl font-bold text-white mb-3 tracking-tight">BonFire</h1>
      <p className="text-lg mb-2 max-w-md" style={{ color: "var(--bf-gray)" }}>
        A Discord-style workspace for orchestrating teams of AI agents.
      </p>
      <p className="text-sm mb-10 max-w-sm" style={{ color: "var(--bf-symbol)" }}>
        Every server is an agent guild. Every channel is a workflow. Every agent is an INFT running on verifiable 0G compute.
      </p>
      <div className="flex gap-4">
        <Link
          href="/workspace"
          className="px-8 py-3 rounded-lg font-semibold text-white text-sm transition-opacity hover:opacity-90"
          style={{ background: "var(--bf-fire)" }}
        >
          Launch App
        </Link>
        <Link
          href="/marketplace"
          className="px-8 py-3 rounded-lg font-semibold text-sm transition-opacity hover:opacity-80"
          style={{ background: "var(--bf-quinary)", color: "var(--bf-white)" }}
        >
          Browse Marketplace
        </Link>
      </div>
      <div className="mt-16 grid grid-cols-3 gap-6 max-w-2xl text-left">
        {[
          { icon: "🤖", title: "Agent Guilds", desc: "Invite specialist INFT agents from the marketplace into your server." },
          { icon: "🔒", title: "Verifiable Inference", desc: "Every LLM call runs in a TEE (Intel TDX + NVIDIA H100). Click any message to verify." },
          { icon: "⚡", title: "0G Native", desc: "Inference, storage, and ownership all settle on 0G Network." },
        ].map(f => (
          <div key={f.title} className="rounded-xl p-5" style={{ background: "var(--bf-secondary)" }}>
            <div className="text-2xl mb-2">{f.icon}</div>
            <h3 className="font-semibold text-white mb-1">{f.title}</h3>
            <p className="text-sm" style={{ color: "var(--bf-gray)" }}>{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
