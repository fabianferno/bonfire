"use client";
import { useState, useRef, useEffect } from "react";
import { Plus, Smile, Gift, Volume2 } from "lucide-react";
import type { Channel } from "@/context/AppContext";

interface Props {
  channel: Channel;
  onSend: (text: string) => void;
}

const SLASH_COMMANDS = [
  { cmd: "/search",   desc: "Search the web (ResearchBot)" },
  { cmd: "/summarise",desc: "Summarise a URL or text (ResearchBot)" },
  { cmd: "/review",   desc: "Code review (CodeAssist)" },
  { cmd: "/write",    desc: "Write code from spec (CodeAssist)" },
  { cmd: "/balance",  desc: "Show server balance" },
  { cmd: "/agents",   desc: "List server agents" },
  { cmd: "/help",     desc: "Show all commands" },
];

export default function MessageComposer({ channel, onSend }: Props) {
  const [text, setText] = useState("");
  const [showCommands, setShowCommands] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredCmds = SLASH_COMMANDS.filter(c =>
    text.startsWith("/") && c.cmd.startsWith(text.split(" ")[0])
  );

  useEffect(() => {
    setShowCommands(text.startsWith("/") && filteredCmds.length > 0);
  }, [text, filteredCmds.length]);

  const send = () => {
    if (!text.trim()) return;
    onSend(text);
    setText("");
    setShowCommands(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    if (e.key === "Escape") setShowCommands(false);
  };

  if (channel.type === "voice") {
    return (
      <div className="px-4 pb-6">
        <div
          className="rounded-lg flex items-center gap-3 px-4 py-4"
          style={{ background: "var(--bf-chat-input)" }}
        >
          <Volume2 size={22} style={{ color: "var(--bf-symbol)" }} strokeWidth={1.5} />
          <span style={{ color: "var(--bf-gray)" }}>
            Voice channel — join to speak with agents via LiveKit
          </span>
        </div>
      </div>
    );
  }

  const estimatedCost = text.length > 3
    ? (text.split(" ").length * 0.00015).toFixed(5)
    : null;

  return (
    <div className="px-4 pb-6 relative">
      {/* Slash command autocomplete */}
      {showCommands && (
        <div
          className="absolute bottom-full left-4 right-4 mb-1 rounded-lg overflow-hidden shadow-2xl border"
          style={{ background: "var(--bf-quaternary)", borderColor: "var(--bf-quinary)" }}
        >
          <p
            className="text-xs px-3 py-1.5 uppercase tracking-wider font-semibold border-b"
            style={{ color: "var(--bf-gray)", borderColor: "var(--bf-quinary)" }}
          >
            Commands
          </p>
          {filteredCmds.map(c => (
            <button
              key={c.cmd}
              onClick={() => {
                setText(c.cmd + " ");
                setShowCommands(false);
                inputRef.current?.focus();
              }}
              className="flex items-center gap-3 w-full px-3 py-2 text-left transition-colors hover:bg-[var(--bf-quinary)]"
            >
              <code className="text-sm font-bold" style={{ color: "var(--bf-accent)" }}>{c.cmd}</code>
              <span className="text-sm" style={{ color: "var(--bf-gray)" }}>{c.desc}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div
        className="rounded-lg flex items-center"
        style={{ background: "var(--bf-chat-input)" }}
      >
        {/* Attach / upload button */}
        <button
          className="flex-shrink-0 w-11 flex items-center justify-center transition-colors"
          style={{ color: "var(--bf-symbol)" }}
          title="Attach File"
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--bf-gray)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--bf-symbol)"; }}
        >
          <Plus size={22} strokeWidth={2} />
        </button>

        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder={`Message #${channel.name}`}
          className="flex-1 bg-transparent py-2.5 text-sm text-white focus:outline-none placeholder-[var(--bf-gray)]"
          style={{ color: "var(--bf-white)" }}
        />

        {/* Cost estimate */}
        {estimatedCost && (
          <span className="text-xs flex-shrink-0 pr-2" style={{ color: "var(--bf-symbol)" }}>
            ~{estimatedCost} 0G
          </span>
        )}

        {/* Right icons */}
        <div className="flex items-center gap-0.5 pr-2 flex-shrink-0">
          <ComposerBtn title="Send a gift"><Gift size={20} strokeWidth={1.5} /></ComposerBtn>
          <ComposerBtn title="Emoji"><Smile size={20} strokeWidth={1.5} /></ComposerBtn>
        </div>
      </div>
    </div>
  );
}

function ComposerBtn({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <button
      title={title}
      className="w-8 h-8 flex items-center justify-center rounded transition-colors"
      style={{ color: "var(--bf-symbol)" }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--bf-gray)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--bf-symbol)"; }}
    >
      {children}
    </button>
  );
}
