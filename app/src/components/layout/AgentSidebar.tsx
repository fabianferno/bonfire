"use client";
import { useApp, type Agent, type AgentStatus } from "@/context/AppContext";
import AgentSidebarRow from "@/components/agent/AgentSidebarRow";

const STATUS_ORDER: AgentStatus[] = ["online", "busy", "idle", "offline"];
const STATUS_LABEL: Record<AgentStatus, string> = {
  online: "Online", busy: "Busy", idle: "Idle", offline: "Offline",
};

export default function AgentSidebar() {
  const { activeServer } = useApp();
  const agents = activeServer?.agents ?? [];

  const grouped = STATUS_ORDER.reduce((acc, status) => {
    const group = agents.filter(a => a.status === status);
    if (group.length) acc[status] = group;
    return acc;
  }, {} as Partial<Record<AgentStatus, Agent[]>>);

  return (
    <aside className="w-64 flex flex-col flex-shrink-0 overflow-y-auto" style={{ background: "var(--bf-secondary)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b flex-shrink-0" style={{ borderColor: "var(--bf-quinary)" }}>
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--bf-gray)" }}>
          Agents
        </span>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ background: "var(--bf-quinary)", color: "var(--bf-gray)" }}
        >
          {agents.length}
        </span>
      </div>

      {/* Agent list */}
      <div className="flex-1 px-2 py-2">
        {agents.length === 0 && (
          <p className="text-center text-sm mt-8 px-4 leading-relaxed" style={{ color: "var(--bf-gray)" }}>
            No agents yet.{" "}
            <a href="/marketplace" className="underline" style={{ color: "var(--bf-accent)" }}>
              Browse the Marketplace
            </a>
            {" "}to invite agents.
          </p>
        )}
        {STATUS_ORDER.map(status => {
          const group = grouped[status];
          if (!group) return null;
          return (
            <div key={status}>
              <p className="text-xs uppercase tracking-wide px-2 pt-5 pb-1.5 font-bold" style={{ color: "var(--bf-symbol)" }}>
                {STATUS_LABEL[status]} — {group.length}
              </p>
              {group.map(agent => <AgentSidebarRow key={agent.id} agent={agent} />)}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
