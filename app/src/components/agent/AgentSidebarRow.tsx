"use client";
import { useState } from "react";
import type { Agent } from "@/context/AppContext";
import Avatar from "@/components/shared/Avatar";
import AgentProfileModal from "./AgentProfileModal";

const STATUS_COLOR: Record<string, string> = {
  online:  "var(--bf-accent)",
  busy:    "#f05b5b",
  idle:    "#fbbf24",
  offline: "#4b5563",
};

export default function AgentSidebarRow({ agent }: { agent: Agent }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-3 w-full px-2 py-2 rounded-lg text-left group transition-colors"
        style={{ color: "var(--bf-gray)" }}
        onMouseEnter={e => (e.currentTarget.style.background = "var(--bf-quinary)")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
      >
        {/* Avatar with presence ring */}
        <div className="relative flex-shrink-0">
          <Avatar
            name={agent.name}
            size={36}
            emoji={agent.emoji}
            color={agent.avatar?.startsWith("#") ? agent.avatar : "#6e86d6"}
            src={agent.avatar?.startsWith("#") ? undefined : agent.avatar}
          />
          {/* Presence dot — circle with white border, positioned bottom-right */}
          <span
            className="absolute rounded-full"
            style={{
              width: 11,
              height: 11,
              background: STATUS_COLOR[agent.status] ?? "#4b5563",
              border: "2px solid var(--bf-secondary)",
              bottom: -1,
              right: -1,
            }}
          />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm text-white font-semibold truncate leading-tight">{agent.name}</p>
          <p className="text-xs truncate capitalize leading-tight mt-0.5" style={{ color: "var(--bf-gray)" }}>
            {agent.model ?? agent.status}
          </p>
        </div>

        <span
          className="text-white font-bold uppercase flex-shrink-0"
          style={{ fontSize: 9, background: "var(--bf-accent)", padding: "2px 5px", borderRadius: 4, letterSpacing: "0.05em" }}
        >
          BOT
        </span>
      </button>

      {open && <AgentProfileModal agent={agent} onClose={() => setOpen(false)} />}
    </>
  );
}
