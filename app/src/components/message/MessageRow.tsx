"use client";
import { useState } from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import type { Message } from "@/context/AppContext";
import Avatar from "@/components/shared/Avatar";

export default function MessageRow({ msg }: { msg: Message }) {
  const [showVerify, setShowVerify] = useState(false);

  return (
    <div
      className="flex gap-3 px-4 py-1 group rounded"
      onMouseEnter={e => (e.currentTarget.style.background = "var(--bf-quinary)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      <Avatar name={msg.author} size={40} color={msg.isBot ? "#f97316" : "#6e86d6"} src={msg.avatar} className="mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-semibold text-white">{msg.author}</span>
          {msg.isBot && (
            <span className="text-xs px-1 py-0.5 rounded font-bold text-white uppercase" style={{ background: "var(--bf-accent)", fontSize: 9 }}>BOT</span>
          )}
          <span className="text-xs" style={{ color: "var(--bf-symbol)" }}>{msg.date}</span>
          {msg.cost !== undefined && (
            <span className="text-xs" style={{ color: "var(--bf-gray)" }}>· {msg.cost.toFixed(4)} 0G</span>
          )}
          {msg.teeHash && (
            <button
              onClick={() => setShowVerify(!showVerify)}
              className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded"
              style={{ color: "var(--bf-green)", background: "rgba(67,181,129,0.15)" }}
            >
              <ShieldCheck size={12} strokeWidth={2} />
              TEE Verified
            </button>
          )}
        </div>
        <p className="text-sm leading-relaxed mt-0.5" style={{ color: "#dcddde" }}>{msg.content}</p>
        {showVerify && msg.teeHash && (
          <div className="mt-2 rounded p-2 text-xs font-mono" style={{ background: "var(--bf-quaternary)", color: "var(--bf-gray)" }}>
            <p className="font-semibold text-white mb-1 flex items-center gap-1.5"><ShieldAlert size={13} strokeWidth={2} style={{ color: "var(--bf-green)" }} /> TEE Attestation Report</p>
            <p>Hash: <span style={{ color: "var(--bf-accent)" }}>{msg.teeHash}</span></p>
            <p>Provider: 0G Compute Network · Intel TDX + NVIDIA H100</p>
            <p>Status: <span style={{ color: "var(--bf-green)" }}>Verified</span></p>
          </div>
        )}
      </div>
    </div>
  );
}
