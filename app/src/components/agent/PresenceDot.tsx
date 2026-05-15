import type { AgentStatus } from "@/context/AppContext";

const COLORS: Record<AgentStatus, string> = {
  online:  "var(--bf-accent)",
  busy:    "#f04747",
  idle:    "#faa61a",
  offline: "#747f8d",
};

const LABELS: Record<AgentStatus, string> = {
  online:  "Online",
  busy:    "Busy",
  idle:    "Idle",
  offline: "Offline",
};

export default function PresenceDot({ status, size = 10 }: { status: AgentStatus; size?: number }) {
  return (
    <span
      title={LABELS[status]}
      style={{ width: size, height: size, background: COLORS[status] }}
      className="rounded-full inline-block flex-shrink-0"
    />
  );
}
