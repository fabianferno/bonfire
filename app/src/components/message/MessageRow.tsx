"use client";
import { useState } from "react";
import { ShieldCheck, ShieldAlert, ChevronRight, ChevronDown, Wrench } from "lucide-react";
import type { Message } from "@/context/AppContext";
import Avatar from "@/components/shared/Avatar";

// Tool call block — thread-style expandable
function ToolCallThread({ content }: { content: string }) {
  const [open, setOpen] = useState(false);

  // Parse lines that look like: [tool: name] input / output
  const lines = content.split("\n").filter(Boolean);
  const toolLines = lines.filter(l => l.startsWith("[tool:") || l.startsWith("→") || l.startsWith("←"));
  const otherLines = lines.filter(l => !l.startsWith("[tool:") && !l.startsWith("→") && !l.startsWith("←"));

  if (toolLines.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
        style={{
          background: open ? "var(--bf-quinary)" : "var(--bf-quaternary)",
          color: "var(--bf-accent)",
          border: "1px solid var(--bf-quinary)",
        }}
      >
        <Wrench size={12} strokeWidth={2} />
        <span className="font-semibold">{toolLines.length} tool call{toolLines.length !== 1 ? "s" : ""}</span>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open && (
        <div
          className="mt-1.5 rounded-lg overflow-hidden"
          style={{ border: "1px solid var(--bf-quinary)" }}
        >
          {toolLines.map((line, i) => {
            const isInput = line.startsWith("[tool:") || line.startsWith("→");
            const isOutput = line.startsWith("←");
            return (
              <div
                key={i}
                className="px-3 py-2 text-xs font-mono"
                style={{
                  background: i % 2 === 0 ? "var(--bf-quaternary)" : "var(--bf-tertiary)",
                  color: isOutput ? "var(--bf-fire)" : isInput ? "var(--bf-accent)" : "var(--bf-gray)",
                  borderTop: i > 0 ? "1px solid var(--bf-quinary)" : "none",
                }}
              >
                {line}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Detect if a message contains tool call markers
function hasToolCalls(content: string): boolean {
  return content.includes("[tool:") || (content.includes("→") && content.includes("←"));
}

export default function MessageRow({ msg }: { msg: Message }) {
  const [showVerify, setShowVerify] = useState(false);

  // Split content into visible text and tool-call section
  const lines = msg.content.split("\n");
  const firstToolIdx = lines.findIndex(l => l.startsWith("[tool:") || (l.startsWith("→") && lines.some(x => x.startsWith("←"))));
  const visibleContent = firstToolIdx > 0
    ? lines.slice(0, firstToolIdx).join("\n").trim()
    : (hasToolCalls(msg.content) ? "" : msg.content);
  const toolContent = firstToolIdx >= 0 ? lines.slice(firstToolIdx).join("\n") : (hasToolCalls(msg.content) ? msg.content : "");

  return (
    <div
      className="flex gap-3 px-4 py-1.5 group rounded-lg transition-colors"
      onMouseEnter={e => (e.currentTarget.style.background = "var(--bf-quinary)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      <Avatar
        name={msg.author}
        size={42}
        color={msg.isBot ? "#fb923c" : "var(--bf-plum)"}
        src={msg.avatar}
        className="mt-0.5 flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-bold text-white">{msg.author}</span>
          {msg.isBot && (
            <span
              className="text-white font-bold uppercase"
              style={{ fontSize: 9, background: "var(--bf-accent)", padding: "2px 5px", borderRadius: 4 }}
            >
              BOT
            </span>
          )}
          <span className="text-xs" style={{ color: "var(--bf-symbol)" }}>{msg.date}</span>
          {msg.cost !== undefined && (
            <span className="text-xs" style={{ color: "var(--bf-gray)" }}>· {msg.cost.toFixed(4)} 0G</span>
          )}
          {msg.teeHash && (
            <button
              onClick={() => setShowVerify(!showVerify)}
              className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md"
              style={{ color: "var(--bf-accent)", background: "rgba(129,22,224,0.12)" }}
            >
              <ShieldCheck size={12} strokeWidth={2} />
              TEE Verified
            </button>
          )}
        </div>

        {visibleContent && (
          <p className="text-sm leading-relaxed mt-0.5" style={{ color: "#dde1e8" }}>{visibleContent}</p>
        )}

        {toolContent && <ToolCallThread content={toolContent} />}

        {showVerify && msg.teeHash && (
          <div className="mt-2 rounded-lg p-2.5 text-xs font-mono" style={{ background: "var(--bf-quaternary)", color: "var(--bf-gray)" }}>
            <p className="font-semibold text-white mb-1 flex items-center gap-1.5">
              <ShieldAlert size={13} strokeWidth={2} style={{ color: "var(--bf-accent)" }} />
              TEE Attestation Report
            </p>
            <p>Hash: <span style={{ color: "var(--bf-accent)" }}>{msg.teeHash}</span></p>
            <p>Provider: 0G Compute Network · Intel TDX + NVIDIA H100</p>
            <p>Status: <span style={{ color: "var(--bf-accent)" }}>Verified</span></p>
          </div>
        )}
      </div>
    </div>
  );
}
