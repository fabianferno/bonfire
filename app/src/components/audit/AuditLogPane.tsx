"use client";
import { useState, useEffect, useCallback } from "react";
import { ShieldAlert, RefreshCw } from "lucide-react";
import { bf, type AuditLogEntry } from "@/lib/api-bonfire";
import { useApp } from "@/context/AppContext";

const ACTION_CHIP: Record<string, string> = {
  agent_invoked:  "var(--bf-accent)",
  agent_replied:  "#4ade80",
  agent_failed:   "var(--bf-red)",
};

function actionLabel(entry: AuditLogEntry): string {
  const p = entry.payload;
  switch (entry.action) {
    case "agent_invoked":
      return `invoked: "${String(p.inputPreview ?? "").slice(0, 80)}"`;
    case "agent_replied":
      return `replied: "${String(p.replyPreview ?? "").slice(0, 80)}" (${p.durationMs ?? "?"}ms)`;
    case "agent_failed":
      return `failed: ${String(p.error ?? "unknown error").slice(0, 100)}`;
    default:
      return JSON.stringify(p).slice(0, 120);
  }
}

function RelativeTime({ iso }: { iso: string }) {
  const abs = new Date(iso).toLocaleString();
  const diff = Date.now() - new Date(iso).getTime();
  let rel: string;
  if (diff < 60_000) rel = "just now";
  else if (diff < 3_600_000) rel = `${Math.floor(diff / 60_000)}m ago`;
  else if (diff < 86_400_000) rel = `${Math.floor(diff / 3_600_000)}h ago`;
  else rel = `${Math.floor(diff / 86_400_000)}d ago`;
  return (
    <span title={abs} style={{ color: "var(--bf-gray)", fontSize: 11, cursor: "help" }}>
      {rel}
    </span>
  );
}

export default function AuditLogPane({ channelId }: { channelId: string }) {
  const { activeServer } = useApp();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    try {
      const { entries: data } = await bf.getAuditLog(channelId, { limit: 50 });
      setEntries(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  // Initial load + 5-second poll
  useEffect(() => {
    fetchEntries();
    const id = setInterval(fetchEntries, 5000);
    return () => clearInterval(id);
  }, [fetchEntries]);

  return (
    <main className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ background: "var(--bf-primary)" }}>
      {/* Header */}
      <header
        className="flex items-center gap-3 px-4 h-14 border-b flex-shrink-0"
        style={{ borderColor: "var(--bf-quinary)" }}
      >
        <ShieldAlert size={20} style={{ color: "var(--bf-fire)", flexShrink: 0 }} strokeWidth={1.5} />
        <span className="font-bold text-white text-lg">
          Audit Log{activeServer ? ` · ${activeServer.name}` : ""}
        </span>
        <span
          className="ml-1 px-2 py-0.5 rounded text-xs font-bold uppercase"
          style={{ background: "rgba(240,91,91,0.15)", color: "var(--bf-red)", border: "1px solid rgba(240,91,91,0.3)" }}
        >
          Owner-only
        </span>
        <div className="flex-1" />
        <button
          onClick={fetchEntries}
          title="Refresh"
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
          style={{ color: "var(--bf-gray)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "white"; (e.currentTarget as HTMLElement).style.background = "var(--bf-quinary)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--bf-gray)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          <RefreshCw size={16} strokeWidth={1.5} />
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading && (
          <p className="text-sm text-center py-12" style={{ color: "var(--bf-gray)" }}>
            Loading audit events…
          </p>
        )}

        {!loading && error && (
          <p className="text-sm text-center py-12" style={{ color: "var(--bf-red)" }}>
            {error}
          </p>
        )}

        {!loading && !error && entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <ShieldAlert size={32} strokeWidth={1} style={{ color: "var(--bf-symbol)" }} />
            <p className="text-sm" style={{ color: "var(--bf-gray)" }}>No audit events yet.</p>
          </div>
        )}

        {!loading && !error && entries.length > 0 && (
          <div className="flex flex-col gap-2 max-w-3xl">
            {entries.map((entry) => (
              <AuditRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function AuditRow({ entry }: { entry: AuditLogEntry }) {
  const chipColor = ACTION_CHIP[entry.action] ?? "var(--bf-gray)";
  return (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-xl"
      style={{ background: "var(--bf-secondary)", border: "1px solid var(--bf-quinary)" }}
    >
      {/* Timestamp */}
      <div className="flex-shrink-0 pt-0.5 min-w-16 text-right">
        <RelativeTime iso={entry.createdAt} />
      </div>

      {/* Action chip */}
      <span
        className="flex-shrink-0 mt-0.5 px-2 py-0.5 rounded text-xs font-bold uppercase"
        style={{ background: `${chipColor}22`, color: chipColor, border: `1px solid ${chipColor}44` }}
      >
        {entry.action.replace("_", " ")}
      </span>

      {/* Agent slug */}
      {entry.agentSlug && (
        <span className="flex-shrink-0 mt-0.5 text-xs font-mono" style={{ color: "var(--bf-accent)" }}>
          @{entry.agentSlug}
        </span>
      )}

      {/* Description */}
      <span className="text-xs leading-relaxed truncate" style={{ color: "var(--bf-gray)" }}>
        {actionLabel(entry)}
      </span>
    </div>
  );
}
