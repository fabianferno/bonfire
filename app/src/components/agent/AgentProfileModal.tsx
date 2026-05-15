"use client";
import { useState } from "react";
import { ShieldCheck, Zap, ChevronRight, ChevronDown, Terminal, AlertTriangle, Info, Wrench } from "lucide-react";
import type { Agent, AgentLog } from "@/context/AppContext";
import Modal from "@/components/shared/Modal";
import Avatar from "@/components/shared/Avatar";

const STATUS_COLOR: Record<string, string> = {
  online:  "var(--bf-accent)",
  busy:    "#f05b5b",
  idle:    "#fbbf24",
  offline: "#4b5563",
};

interface Props {
  agent: Agent;
  onClose: () => void;
}

export default function AgentProfileModal({ agent, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<"overview" | "logs">("overview");

  return (
    <Modal title="" onClose={onClose} wide maxHeight="70vh">
      {/* Header */}
      <div className="flex items-center gap-4 pb-4" style={{ borderBottom: "1px solid var(--bf-quinary)" }}>
        <div className="relative flex-shrink-0">
          <Avatar
            name={agent.name}
            emoji={agent.emoji}
            size={64}
            color={agent.avatar?.startsWith("#") ? agent.avatar : "#6e86d6"}
            src={agent.avatar?.startsWith("#") ? undefined : agent.avatar}
          />
          <span
            className="absolute rounded-full"
            style={{
              width: 14,
              height: 14,
              background: STATUS_COLOR[agent.status] ?? "#4b5563",
              border: "3px solid var(--bf-primary)",
              bottom: 0,
              right: 0,
            }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white text-xl font-bold">{agent.name}</span>
            <span className="text-xs px-1.5 py-0.5 rounded font-bold text-white uppercase" style={{ background: "var(--bf-accent)", fontSize: 10 }}>BOT</span>
            <span className="text-xs font-medium capitalize" style={{ color: STATUS_COLOR[agent.status] }}>● {agent.status}</span>
          </div>
          <p className="text-sm mt-1 leading-relaxed" style={{ color: "var(--bf-gray)" }}>{agent.description}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1" style={{ borderBottom: "1px solid var(--bf-quinary)" }}>
        {(["overview", "logs"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-4 py-2 text-sm font-semibold capitalize transition-colors"
            style={{
              color: activeTab === tab ? "var(--bf-white)" : "var(--bf-gray)",
              borderBottom: activeTab === tab ? "2px solid var(--bf-accent)" : "2px solid transparent",
            }}
          >
            {tab === "logs" ? "Audit Logs" : "Overview"}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="flex flex-col gap-4 pt-2">
          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3 text-sm">
            <StatCard label="Model" value={agent.model ?? "—"} />
            <StatCard label="Rate In" value={agent.rateInput !== undefined ? `${agent.rateInput} OG/1k` : "—"} />
            <StatCard label="Rate Out" value={agent.rateOutput !== undefined ? `${agent.rateOutput} OG/1k` : "—"} />
          </div>

          {agent.acquisition && (
            <div className="rounded-lg p-3 text-sm" style={{ background: "var(--bf-quaternary)" }}>
              <p className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--bf-gray)" }}>Acquisition</p>
              <p className="text-white font-medium capitalize">{agent.acquisition}</p>
            </div>
          )}

          {agent.teeHash && (
            <div className="rounded-lg p-3 text-sm" style={{ background: "var(--bf-quaternary)" }}>
              <p className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--bf-gray)" }}>TEE Attestation</p>
              <div className="flex items-center gap-2">
                <code className="text-xs flex-1 truncate" style={{ color: "var(--bf-accent)" }}>{agent.teeHash}</code>
                <button
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded font-semibold text-black flex-shrink-0"
                  style={{ background: "var(--bf-accent)" }}
                  onClick={() => alert(`TEE Attestation:\n${agent.teeHash}\n\nVerified on 0G Compute Network`)}
                >
                  <ShieldCheck size={12} strokeWidth={2} />
                  Verify
                </button>
              </div>
            </div>
          )}

          {agent.skills.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide mb-2 font-semibold" style={{ color: "var(--bf-gray)" }}>Skills</p>
              <div className="grid grid-cols-2 gap-2">
                {agent.skills.map(skill => (
                  <div key={skill.id} className="rounded-lg p-3" style={{ background: "var(--bf-quaternary)" }}>
                    <div className="flex items-center gap-2 mb-1">
                      <Zap size={13} strokeWidth={2} style={{ color: "var(--bf-accent)", flexShrink: 0 }} />
                      <code className="text-xs font-semibold" style={{ color: "var(--bf-accent)" }}>{skill.command}</code>
                    </div>
                    <p className="text-white text-sm font-semibold">{skill.name}</p>
                    <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--bf-gray)" }}>{skill.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "logs" && (
        <div className="flex flex-col gap-2 pt-2">
          {(!agent.logs || agent.logs.length === 0) ? (
            <p className="text-center py-8 text-sm" style={{ color: "var(--bf-gray)" }}>No logs recorded yet.</p>
          ) : (
            agent.logs.map(log => <LogRow key={log.id} log={log} />)
          )}
        </div>
      )}
    </Modal>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg p-3" style={{ background: "var(--bf-quaternary)" }}>
      <p className="text-xs uppercase tracking-wide mb-1 font-semibold" style={{ color: "var(--bf-gray)" }}>{label}</p>
      <p className="text-white font-semibold text-sm">{value}</p>
    </div>
  );
}

function LogRow({ log }: { log: AgentLog }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = log.toolInput || log.toolOutput;

  const Icon = log.level === "tool" ? Wrench
    : log.level === "warn" ? AlertTriangle
    : log.level === "error" ? AlertTriangle
    : log.level === "info" ? Info
    : Terminal;

  const iconColor = log.level === "tool" ? "var(--bf-accent)"
    : log.level === "warn" ? "var(--bf-yellow)"
    : log.level === "error" ? "var(--bf-red)"
    : "var(--bf-gray)";

  const time = new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: "var(--bf-quaternary)", border: "1px solid var(--bf-quinary)" }}>
      <button
        onClick={() => hasDetail && setExpanded(v => !v)}
        className="flex items-start gap-3 w-full px-3 py-2.5 text-left"
        style={{ cursor: hasDetail ? "pointer" : "default" }}
      >
        <Icon size={14} style={{ color: iconColor, flexShrink: 0, marginTop: 2 }} strokeWidth={2} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white leading-snug">{log.message}</p>
          {log.toolName && (
            <p className="text-xs mt-0.5 font-mono" style={{ color: "var(--bf-accent)" }}>
              {log.toolName}{log.durationMs !== undefined ? ` · ${log.durationMs}ms` : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-mono" style={{ color: "var(--bf-symbol)" }}>{time}</span>
          {hasDetail && (
            expanded
              ? <ChevronDown size={13} style={{ color: "var(--bf-gray)" }} />
              : <ChevronRight size={13} style={{ color: "var(--bf-gray)" }} />
          )}
        </div>
      </button>

      {expanded && hasDetail && (
        <div className="px-3 pb-3 flex flex-col gap-2" style={{ borderTop: "1px solid var(--bf-quinary)" }}>
          {log.toolInput && (
            <div>
              <p className="text-xs uppercase tracking-wide mb-1 pt-2 font-semibold" style={{ color: "var(--bf-gray)" }}>Input</p>
              <pre className="text-xs rounded p-2 overflow-x-auto" style={{ background: "var(--bf-tertiary)", color: "var(--bf-accent)" }}>
                {JSON.stringify(JSON.parse(log.toolInput), null, 2)}
              </pre>
            </div>
          )}
          {log.toolOutput && (
            <div>
              <p className="text-xs uppercase tracking-wide mb-1 font-semibold" style={{ color: "var(--bf-gray)" }}>Output</p>
              <pre className="text-xs rounded p-2 overflow-x-auto" style={{ background: "var(--bf-tertiary)", color: "var(--bf-fire)" }}>
                {JSON.stringify(JSON.parse(log.toolOutput), null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
