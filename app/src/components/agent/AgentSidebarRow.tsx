"use client";
import { useState } from "react";
import type { Agent } from "@/context/AppContext";
import Avatar from "@/components/shared/Avatar";
import PresenceDot from "./PresenceDot";
import AgentProfileModal from "./AgentProfileModal";

export default function AgentSidebarRow({ agent }: { agent: Agent }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-3 w-full px-2 py-1.5 rounded text-left group"
        style={{ color: "var(--bf-gray)" }}
        onMouseEnter={e => (e.currentTarget.style.background = "var(--bf-quinary)")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
      >
        <div className="relative flex-shrink-0">
          <Avatar
            name={agent.name}
            size={32}
            color={agent.avatar?.startsWith("#") ? agent.avatar : "#6e86d6"}
            src={agent.avatar?.startsWith("#") ? undefined : agent.avatar}
          />
          <span className="absolute -bottom-0.5 -right-0.5 rounded-full border-2" style={{ borderColor: "var(--bf-secondary)" }}>
            <PresenceDot status={agent.status} size={8} />
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white font-medium truncate">{agent.name}</p>
          <p className="text-xs truncate capitalize">{agent.status}</p>
        </div>
        <span className="text-xs px-1 py-0.5 rounded font-bold text-white uppercase" style={{ background: "var(--bf-accent)", fontSize: 9 }}>BOT</span>
      </button>
      {open && <AgentProfileModal agent={agent} onClose={() => setOpen(false)} />}
    </>
  );
}
