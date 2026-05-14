"use client";
import { useState } from "react";
import { Hash, Volume2, Bell, Pin, Users, Search, HelpCircle, UserPlus, Mic, MicOff } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useVoiceCtx, type VoiceParticipant } from "@/context/VoiceContext";
import MessageFeed from "@/components/message/MessageFeed";
import MessageComposer from "@/components/message/MessageComposer";
import Avatar from "@/components/shared/Avatar";

export default function CenterPane() {
  const { activeServer, activeChannel, activeServerId, activeChannelId, sendMessage } = useApp();
  const voice = useVoiceCtx();

  if (!activeServer || !activeChannel) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: "var(--bf-primary)" }}>
        <div className="text-center" style={{ color: "var(--bf-gray)" }}>
          <div className="text-5xl mb-3">🔥</div>
          <p className="font-bold text-white text-xl">Select a channel to start</p>
          <p className="text-sm mt-1">Pick a text channel from the sidebar.</p>
        </div>
      </div>
    );
  }

  const isVoice = activeChannel.type === "voice";

  return (
    <main className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ background: "var(--bf-primary)" }}>

      {/* Channel header */}
      <header
        className="flex items-center gap-1 px-4 h-14 border-b flex-shrink-0"
        style={{ borderColor: "var(--bf-quinary)" }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isVoice
            ? <Volume2 size={22} style={{ color: "var(--bf-symbol)", flexShrink: 0 }} strokeWidth={1.5} />
            : <Hash size={22} style={{ color: "var(--bf-symbol)", flexShrink: 0 }} strokeWidth={2} />
          }
          <span className="font-bold text-white text-lg">{activeChannel.name}</span>

          {activeChannel.description && (
            <>
              <span className="w-px h-5 mx-1 flex-shrink-0" style={{ background: "var(--bf-quinary)" }} />
              <span className="text-sm truncate" style={{ color: "var(--bf-gray)" }}>
                {activeChannel.description}
              </span>
            </>
          )}
        </div>

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
              className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: "var(--bf-gray)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "white"; (e.currentTarget as HTMLElement).style.background = "var(--bf-quinary)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--bf-gray)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <Icon size={20} strokeWidth={1.5} />
            </button>
          ))}
        </div>
      </header>

      {isVoice ? (
        <VoiceStatusPane
          channelId={activeChannel.id}
          channelName={activeChannel.name}
          agents={activeServer.agents}
        />
      ) : (
        <>
          <MessageFeed messages={activeChannel.messages} />
          <MessageComposer
            channel={activeChannel}
            onSend={text => sendMessage(activeServerId, activeChannelId, text)}
          />
        </>
      )}
    </main>
  );
}

// ── Voice status pane ─────────────────────────────────────────────────────────

interface VoiceAgent {
  id: string;
  name: string;
  emoji?: string;
  avatar?: string;
  status: string;
}

function VoiceStatusPane({
  channelId,
  channelName,
  agents,
}: {
  channelId: string;
  channelName: string;
  agents: VoiceAgent[];
}) {
  const voice = useVoiceCtx();
  const [chatInput, setChatInput] = useState("");
  const [talkingToAgent, setTalkingToAgent] = useState<string | null>(null);

  const joined = !!voice.joinedChannelId;

  const handleSendToAgent = (agentId: string, agentName: string) => {
    if (!chatInput.trim()) return;
    const text = chatInput.trim();
    setChatInput("");
    voice.speakAsAgent(agentId, `${agentName} says: ${text}`);
  };

  const handleInviteAgent = (agent: VoiceAgent) => {
    voice.inviteAgentToVoice(agent.id);
    setParticipantInfo(prev => ({
      ...prev,
      [agent.id]: { name: agent.name, emoji: agent.emoji, color: agent.avatar },
    }));
  };

  const [participantInfo, setParticipantInfo] = useState<Record<string, { name: string; emoji?: string; color?: string }>>({});

  const agentsInVoice = voice.participants.filter(p => p.isAgent);
  const humansInVoice = voice.participants.filter(p => !p.isAgent);
  const availableAgents = agents.filter(a => !voice.participants.find(p => p.userId === a.id));

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: "var(--bf-primary)" }}>

      {/* Participants area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">

        {!joined && (
          <>
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: "var(--bf-quaternary)" }}
            >
              <Volume2 size={36} style={{ color: "var(--bf-gray)" }} strokeWidth={1.2} />
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-xl">{channelName}</p>
              <p className="text-sm mt-1" style={{ color: "var(--bf-gray)" }}>
                Voice channel — click to join and talk to agents
              </p>
            </div>
            <button
              onClick={() => voice.join(channelId, channelName)}
              disabled={voice.joining}
              className="px-8 py-2.5 rounded-xl font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: "var(--bf-green)" }}
            >
              {voice.joining ? "Joining…" : "Join Voice"}
            </button>
          </>
        )}

        {joined && (
          <>
            {/* Participant tiles */}
            {(voice.participants.length > 0) && (
              <div
                className="grid gap-4 w-full max-w-2xl"
                style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(voice.participants.length, 1), 4)}, 1fr)` }}
              >
                {voice.participants.map(p => {
                  const info = participantInfo[p.userId];
                  return (
                    <ParticipantTile
                      key={p.userId}
                      participant={p}
                      emoji={info?.emoji ?? p.emoji}
                      color={info?.color ?? p.agentColor}
                      onTalk={p.isAgent ? () => setTalkingToAgent(talkingToAgent === p.userId ? null : p.userId) : undefined}
                      talkingTo={talkingToAgent === p.userId}
                    />
                  );
                })}
              </div>
            )}

            {/* Chat-to-agent bar */}
            {talkingToAgent && (() => {
              const agent = voice.participants.find(p => p.userId === talkingToAgent);
              const info = participantInfo[talkingToAgent];
              const name = info?.name ?? agent?.userName ?? "Agent";
              return (
                <div
                  className="w-full max-w-2xl flex items-center gap-3 rounded-xl px-4 py-3"
                  style={{ background: "var(--bf-quaternary)", border: "1px solid var(--bf-quinary)" }}
                >
                  <span className="text-sm font-semibold flex-shrink-0" style={{ color: "var(--bf-accent)" }}>
                    → {name}
                  </span>
                  <input
                    autoFocus
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleSendToAgent(talkingToAgent, name); }}
                    placeholder={`Say something to ${name}…`}
                    className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-gray-500"
                  />
                  <button
                    onClick={() => handleSendToAgent(talkingToAgent, name)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white"
                    style={{ background: "var(--bf-accent)" }}
                  >
                    Send
                  </button>
                </div>
              );
            })()}

            {/* Invite agents */}
            {availableAgents.length > 0 && (
              <div className="w-full max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--bf-gray)" }}>
                  Invite agents to voice
                </p>
                <div className="flex flex-wrap gap-2">
                  {availableAgents.map(agent => (
                    <button
                      key={agent.id}
                      onClick={() => handleInviteAgent(agent)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-colors"
                      style={{ background: "var(--bf-quaternary)", color: "var(--bf-gray)", border: "1px solid var(--bf-quinary)" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--bf-quinary)"; (e.currentTarget as HTMLElement).style.color = "white"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--bf-quaternary)"; (e.currentTarget as HTMLElement).style.color = "var(--bf-gray)"; }}
                    >
                      <UserPlus size={14} strokeWidth={2} />
                      {agent.emoji && <span>{agent.emoji}</span>}
                      {agent.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {voice.error && (
          <p
            className="text-sm px-5 py-3 rounded-xl max-w-sm text-center"
            style={{ background: "rgba(240,91,91,0.12)", color: "#f05b5b", border: "1px solid rgba(240,91,91,0.3)" }}
          >
            {voice.error}
          </p>
        )}
      </div>

      {/* Bottom bar — participant count */}
      {joined && (
        <div
          className="flex items-center justify-between px-6 py-2 text-sm flex-shrink-0"
          style={{ borderTop: "1px solid var(--bf-quinary)", color: "var(--bf-gray)" }}
        >
          <span>
            {humansInVoice.length} human{humansInVoice.length !== 1 ? "s" : ""} · {agentsInVoice.length} agent{agentsInVoice.length !== 1 ? "s" : ""} · {channelName}
          </span>
          <div className="flex items-center gap-1 text-xs">
            {voice.muted
              ? <MicOff size={14} style={{ color: "var(--bf-red)" }} />
              : <Mic size={14} style={{ color: "var(--bf-green)" }} />
            }
            <span>{voice.muted ? "Muted" : "Live"}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Participant tile ───────────────────────────────────────────────────────────

function ParticipantTile({
  participant,
  emoji,
  color,
  onTalk,
  talkingTo,
}: {
  participant: VoiceParticipant;
  emoji?: string;
  color?: string;
  onTalk?: () => void;
  talkingTo?: boolean;
}) {
  const displayName = participant.userName.startsWith("did:")
    ? participant.userName.slice(0, 14) + "…"
    : participant.userName;

  return (
    <div
      className="flex flex-col items-center gap-3 p-5 rounded-2xl transition-all"
      style={{
        background: participant.speaking ? "rgba(87,201,138,0.12)" : "var(--bf-secondary)",
        border: participant.speaking
          ? "1px solid rgba(87,201,138,0.4)"
          : talkingTo
          ? "1px solid var(--bf-accent)"
          : "1px solid var(--bf-quinary)",
      }}
    >
      <div className="relative">
        <Avatar
          name={participant.userName}
          size={60}
          color={color?.startsWith("#") ? color : "#7c9cf5"}
          emoji={emoji}
        />
        {participant.speaking && (
          <span
            className="absolute -bottom-1 -right-1 rounded-full text-xs flex items-center justify-center"
            style={{ width: 20, height: 20, background: "var(--bf-green)", fontSize: 10 }}
          >
            🔊
          </span>
        )}
      </div>

      <div className="text-center">
        <p className="text-white text-sm font-bold truncate max-w-24">{displayName}</p>
        <p className="text-xs mt-0.5" style={{ color: "var(--bf-gray)" }}>
          {participant.isAgent ? "Agent" : "You"}
        </p>
      </div>

      {participant.isAgent && onTalk && (
        <button
          onClick={onTalk}
          className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors"
          style={{
            background: talkingTo ? "var(--bf-accent)" : "var(--bf-quaternary)",
            color: talkingTo ? "white" : "var(--bf-gray)",
            border: "1px solid var(--bf-quinary)",
          }}
        >
          {talkingTo ? "Talking…" : "Talk"}
        </button>
      )}
    </div>
  );
}
