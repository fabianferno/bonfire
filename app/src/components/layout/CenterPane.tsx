"use client";
import { Hash, Volume2, Bell, Pin, Users, Search, HelpCircle } from "lucide-react";
import { useApp } from "@/context/AppContext";
import MessageFeed from "@/components/message/MessageFeed";
import MessageComposer from "@/components/message/MessageComposer";

export default function CenterPane() {
  const { activeServer, activeChannel, activeServerId, activeChannelId, sendMessage } = useApp();

  if (!activeServer || !activeChannel) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: "var(--bf-primary)" }}>
        <div className="text-center" style={{ color: "var(--bf-gray)" }}>
          <div className="text-5xl mb-3">🔥</div>
          <p className="font-semibold text-white text-lg">Select a channel to start</p>
          <p className="text-sm mt-1">Pick a text channel from the sidebar.</p>
        </div>
      </div>
    );
  }

  const isVoice = activeChannel.type === "voice";

  return (
    <main className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ background: "var(--bf-primary)" }}>

      {/* Channel header — matches Discord's exact topbar layout */}
      <header
        className="flex items-center gap-1 px-4 h-12 border-b flex-shrink-0"
        style={{ borderColor: "var(--bf-quaternary)" }}
      >
        {/* Channel icon + name */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isVoice
            ? <Volume2 size={22} style={{ color: "var(--bf-symbol)", flexShrink: 0 }} strokeWidth={1.5} />
            : <Hash size={22} style={{ color: "var(--bf-symbol)", flexShrink: 0 }} strokeWidth={2} />
          }
          <span className="font-semibold text-white">{activeChannel.name}</span>

          {activeChannel.description && (
            <>
              <span className="w-px h-5 mx-1 flex-shrink-0" style={{ background: "var(--bf-quinary)" }} />
              <span className="text-sm truncate" style={{ color: "var(--bf-gray)" }}>
                {activeChannel.description}
              </span>
            </>
          )}
        </div>

        {/* Right icons — Discord toolbar */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {[
            { Icon: Bell,       title: "Notification Preferences" },
            { Icon: Pin,        title: "Pinned Messages" },
            { Icon: Users,      title: "Member List" },
            { Icon: Search,     title: "Search" },
            { Icon: HelpCircle, title: "Help" },
          ].map(({ Icon, title }) => (
            <button
              key={title}
              title={title}
              className="w-8 h-8 flex items-center justify-center rounded transition-colors"
              style={{ color: "var(--bf-gray)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "white"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--bf-gray)"; }}
            >
              <Icon size={20} strokeWidth={1.5} />
            </button>
          ))}
        </div>
      </header>

      <MessageFeed messages={activeChannel.messages} />
      <MessageComposer
        channel={activeChannel}
        onSend={text => sendMessage(activeServerId, activeChannelId, text)}
      />
    </main>
  );
}
