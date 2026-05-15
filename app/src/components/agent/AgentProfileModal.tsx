"use client";
import { useState, useEffect } from "react";
import { ShieldCheck, ChevronRight, ChevronDown, Terminal, AlertTriangle, Info, Wrench, Plus, Trash2, Server, Loader2, Sparkles } from "lucide-react";
import type { Agent, AgentLog } from "@/context/AppContext";
import Modal from "@/components/shared/Modal";
import Avatar from "@/components/shared/Avatar";
import SkillManager from "./SkillManager";
import { bf, type McpServerConfig } from "@/lib/api-bonfire";
import { ModalLabel, ModalInput } from "@/components/shared/Modal";
import { MCP_PRESETS, type McpPreset } from "./mcp-presets";

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
  const [activeTab, setActiveTab] = useState<"overview" | "skills" | "mcp" | "logs">("overview");

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
        {(["overview", "skills", "mcp", "logs"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-4 py-2 text-sm font-semibold capitalize transition-colors"
            style={{
              color: activeTab === tab ? "var(--bf-white)" : "var(--bf-gray)",
              borderBottom: activeTab === tab ? "2px solid var(--bf-accent)" : "2px solid transparent",
            }}
          >
            {tab === "logs" ? "Audit Logs" : tab === "skills" ? "Skills" : tab === "mcp" ? "MCP Servers" : "Overview"}
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

        </div>
      )}

      {activeTab === "skills" && (
        <div className="pt-2">
          <SkillManager agentId={agent.id} canManage />
        </div>
      )}

      {activeTab === "mcp" && (
        <div className="pt-2">
          <McpManager agentId={agent.id} />
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

// ---------------------------------------------------------------------------
// McpManager
// ---------------------------------------------------------------------------

const EMPTY_FORM = { id: "", command: "", args: "", env: "" };

function McpManager({ agentId }: { agentId: string }) {
  const [servers, setServers] = useState<Record<string, McpServerConfig>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Partial<typeof EMPTY_FORM>>({});

  useEffect(() => {
    bf.listMcpServers(agentId)
      .then(r => setServers(r.servers))
      .catch(() => setServers({}))
      .finally(() => setLoading(false));
  }, [agentId]);

  const validateForm = () => {
    const errs: Partial<typeof EMPTY_FORM> = {};
    if (!form.id.trim() || !/^[a-z0-9_-]+$/.test(form.id.trim())) errs.id = "ID: lowercase letters, numbers, - or _";
    if (!form.command.trim()) errs.command = "Command is required";
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleAdd = async () => {
    if (!validateForm()) return;
    setSaving(true);
    setError(null);
    try {
      const args = form.args.trim() ? form.args.split(/\s+/).filter(Boolean) : [];
      const env: Record<string, string> = {};
      for (const line of form.env.split("\n")) {
        const eq = line.indexOf("=");
        if (eq > 0) env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
      }
      await bf.addMcpServer(agentId, { id: form.id.trim(), command: form.command.trim(), args, env });
      const r = await bf.listMcpServers(agentId);
      setServers(r.servers);
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (e: any) {
      setError(e?.message ?? "Failed to add server");
    } finally {
      setSaving(false);
    }
  };

  const applyPreset = (preset: McpPreset) => {
    let id = preset.id;
    let n = 2;
    while (servers[id]) {
      id = `${preset.id}-${n++}`;
    }
    setForm({
      id,
      command: preset.command,
      args: preset.args,
      env: preset.envHints ?? "",
    });
    setFormErrors({});
    setShowForm(true);
  };

  const handleRemove = async (id: string) => {
    setRemoving(id);
    setError(null);
    try {
      await bf.removeMcpServer(agentId, id);
      setServers(prev => { const n = { ...prev }; delete n[id]; return n; });
    } catch (e: any) {
      setError(e?.message ?? "Failed to remove server");
    } finally {
      setRemoving(null);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-12" style={{ color: "var(--bf-gray)" }}>
      <Loader2 size={20} className="animate-spin mr-2" /> Loading…
    </div>
  );

  const entries = Object.entries(servers);

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="text-rose-300 bg-rose-900/40 rounded p-2 text-sm">{error}</p>
      )}

      {entries.length === 0 && !showForm && (
        <div className="flex flex-col items-center gap-2 py-8" style={{ color: "var(--bf-gray)" }}>
          <Server size={28} strokeWidth={1.5} />
          <p className="text-sm">No MCP servers configured yet.</p>
        </div>
      )}

      {entries.map(([id, cfg]) => (
        <div
          key={id}
          className="flex items-start gap-3 rounded-lg px-3 py-2.5"
          style={{ background: "var(--bf-quaternary)", border: "1px solid var(--bf-quinary)" }}
        >
          <Server size={14} style={{ color: "var(--bf-accent)", flexShrink: 0, marginTop: 3 }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">{id}</p>
            <p className="text-xs font-mono mt-0.5 truncate" style={{ color: "var(--bf-gray)" }}>
              {cfg.command}{cfg.args?.length ? " " + cfg.args.join(" ") : ""}
            </p>
            {Object.keys(cfg.env ?? {}).length > 0 && (
              <p className="text-xs mt-0.5" style={{ color: "var(--bf-symbol)" }}>
                {Object.keys(cfg.env).length} env var{Object.keys(cfg.env).length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className="text-xs px-1.5 py-0.5 rounded font-semibold"
              style={{
                background: cfg.enabled ? "rgba(110,134,214,0.15)" : "rgba(75,85,99,0.3)",
                color: cfg.enabled ? "var(--bf-accent)" : "var(--bf-gray)",
              }}
            >
              {cfg.enabled ? "enabled" : "disabled"}
            </span>
            <button
              onClick={() => handleRemove(id)}
              disabled={removing === id}
              className="rounded p-1 transition-colors hover:bg-rose-900/30 disabled:opacity-40"
              title="Remove server"
            >
              {removing === id
                ? <Loader2 size={13} className="animate-spin" style={{ color: "var(--bf-gray)" }} />
                : <Trash2 size={13} style={{ color: "#f05b5b" }} />
              }
            </button>
          </div>
        </div>
      ))}

      {showForm && (
        <div
          className="rounded-lg p-3 flex flex-col gap-3"
          style={{ background: "var(--bf-quaternary)", border: "1px solid var(--bf-quinary)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--bf-gray)" }}>New MCP Server</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <ModalLabel>Server ID <span style={{ color: "var(--bf-fire)" }}>*</span></ModalLabel>
              <ModalInput
                type="text"
                value={form.id}
                onChange={e => setForm(p => ({ ...p, id: e.target.value }))}
                placeholder="my-mcp-server"
                autoComplete="off"
              />
              {formErrors.id && <p className="text-rose-300 text-xs mt-1">{formErrors.id}</p>}
            </div>
            <div>
              <ModalLabel>Command <span style={{ color: "var(--bf-fire)" }}>*</span></ModalLabel>
              <ModalInput
                type="text"
                value={form.command}
                onChange={e => setForm(p => ({ ...p, command: e.target.value }))}
                placeholder="npx"
                autoComplete="off"
              />
              {formErrors.command && <p className="text-rose-300 text-xs mt-1">{formErrors.command}</p>}
            </div>
            <div className="sm:col-span-2">
              <ModalLabel>Arguments</ModalLabel>
              <ModalInput
                type="text"
                value={form.args}
                onChange={e => setForm(p => ({ ...p, args: e.target.value }))}
                placeholder="-y @modelcontextprotocol/server-filesystem /path"
                autoComplete="off"
              />
              <p className="text-xs mt-1" style={{ color: "var(--bf-gray)" }}>Space-separated args</p>
            </div>
            <div className="sm:col-span-2">
              <ModalLabel>Environment variables</ModalLabel>
              <textarea
                rows={3}
                value={form.env}
                onChange={e => setForm(p => ({ ...p, env: e.target.value }))}
                placeholder={"API_KEY=abc123\nANOTHER_VAR=value"}
                className="w-full rounded px-3 py-2 text-sm font-mono resize-y"
                style={{
                  background: "var(--bf-tertiary)",
                  border: "1px solid var(--bf-quinary)",
                  color: "var(--bf-white)",
                  outline: "none",
                }}
              />
              <p className="text-xs mt-1" style={{ color: "var(--bf-gray)" }}>One KEY=VALUE per line</p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setFormErrors({}); }}
              className="px-3 py-1.5 text-sm rounded"
              style={{ color: "var(--bf-gray)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded disabled:opacity-40"
              style={{ background: "var(--bf-accent)", color: "var(--bf-primary)" }}
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Add Server
            </button>
          </div>
        </div>
      )}

      {!showForm && (
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5" style={{ color: "var(--bf-gray)" }}>
              <Sparkles size={11} /> Suggested servers
            </p>
            <div className="flex flex-wrap gap-2">
              {MCP_PRESETS.map(p => {
                const added = !!servers[p.id] || Object.keys(servers).some(k => k.startsWith(p.id + "-"));
                const tooltip = p.archived
                  ? `${p.description}\n\nNote: package is archived but still works.`
                  : p.description;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p)}
                    title={tooltip}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-full transition-colors"
                    style={{
                      background: added ? "rgba(110,134,214,0.18)" : "var(--bf-tertiary)",
                      color: added ? "var(--bf-accent)" : "var(--bf-white)",
                      border: `1px solid ${added ? "var(--bf-accent)" : "var(--bf-quinary)"}`,
                    }}
                  >
                    {added && <span style={{ color: "var(--bf-accent)" }}>✓</span>}
                    {p.name}
                    {p.archived && (
                      <span
                        className="rounded-full"
                        style={{ width: 5, height: 5, background: "#fbbf24", display: "inline-block" }}
                        aria-label="archived package"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg transition-colors self-start"
            style={{ background: "var(--bf-quaternary)", color: "var(--bf-accent)", border: "1px dashed var(--bf-accent)" }}
          >
            <Plus size={14} />
            Add custom server
          </button>
        </div>
      )}
    </div>
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
