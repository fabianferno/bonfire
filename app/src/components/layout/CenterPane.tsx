"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Hash, Volume2, Bell, Pin, Users, Search, HelpCircle, UserPlus, Mic, MicOff, Plus, Compass, Sparkles, MessageSquare, ShieldCheck, ArrowLeft, Pencil, Check, X } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useVoiceCtx, type VoiceParticipant } from "@/context/VoiceContext";
import MessageFeed from "@/components/message/MessageFeed";
import MessageComposer from "@/components/message/MessageComposer";
import Avatar from "@/components/shared/Avatar";
import { BF_BRAND_EMOJI } from "@/lib/brand";
import { appAgentAvatarSrc } from "@/lib/agent-identicon";
import { resolveGreetingName, greetingUsesFallback } from "@/lib/greeting-name";
import AuditLogPane from "@/components/audit/AuditLogPane";

export default function CenterPane() {
  const { servers, activeServer, activeChannel, activeServerId, activeChannelId, sendMessage } = useApp();
  const voice = useVoiceCtx();

  if (!activeServer) {
    return servers.length === 0
      ? <NoServersHero />
      : <NoServerSelectedHero />;
  }

  if (!activeChannel) {
    return <NoChannelSelected serverName={activeServer.name} />;
  }

  const isVoice = activeChannel.type === "voice";
  const isAudit = activeChannel.type === "audit";

  // Audit channels get their own self-contained pane.
  if (isAudit) {
    return <AuditLogPane channelId={activeChannel.id} />;
  }

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

// ── Empty states ──────────────────────────────────────────────────────────────

function NoServersHero() {
  const router = useRouter();
  const { user, preferredName, setPreferredName } = useApp();
  const openCreate = () => window.dispatchEvent(new Event("bonfire:open-create-server"));

  const displayName = resolveGreetingName(preferredName, user.username);
  const usingFallback = greetingUsesFallback(preferredName, user.username);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(preferredName);

  const saveName = () => {
    setPreferredName(draft);
    setEditing(false);
  };
  const cancelEdit = () => {
    setDraft(preferredName);
    setEditing(false);
  };

  const features = [
    {
      Icon: Sparkles,
      title: "Mint an iNFT agent",
      body: "Spin up a soul-bound AI agent on 0G. Voice, memory, and skills baked in.",
      color: "var(--bf-fire)",
    },
    {
      Icon: MessageSquare,
      title: "Chat & voice channels",
      body: "Talk to your agents in text or jump into a Daily-powered voice room.",
      color: "var(--bf-accent)",
    },
    {
      Icon: ShieldCheck,
      title: "TEE-verified actions",
      body: "Every agent call is logged with an on-chain attestation in the audit log.",
      color: "var(--bf-fire)",
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: "var(--bf-primary)" }}>
      <div className="max-w-3xl mx-auto px-8 py-16 flex flex-col items-center text-center">
        <div className="text-6xl mb-4 leading-none select-none" role="img" aria-label="BonFire">{BF_BRAND_EMOJI}</div>

        {editing ? (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-3xl font-bold text-white">Hey,</span>
            <input
              autoFocus
              value={draft}
              maxLength={40}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") saveName();
                if (e.key === "Escape") cancelEdit();
              }}
              placeholder="what should we call you?"
              className="text-3xl font-bold bg-transparent border-b-2 outline-none text-white placeholder:text-gray-600 min-w-0"
              style={{ borderColor: "var(--bf-accent)", width: "auto", minWidth: 240 }}
            />
            <button
              onClick={saveName}
              title="Save"
              className="w-9 h-9 flex items-center justify-center rounded-lg transition-opacity hover:opacity-90"
              style={{ background: "var(--bf-accent)", color: "black" }}
            >
              <Check size={18} strokeWidth={2.5} />
            </button>
            <button
              onClick={cancelEdit}
              title="Cancel"
              className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors"
              style={{ background: "var(--bf-quaternary)", color: "var(--bf-gray)", border: "1px solid var(--bf-quinary)" }}
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>
        ) : (
          <h1 className="flex items-center gap-3 text-3xl font-bold text-white mb-2">
            <span>
              Hey, <span style={{ color: usingFallback ? "var(--bf-gray)" : "white", fontStyle: usingFallback ? "italic" : "normal", marginRight: usingFallback ? "0.15em" : 0 }}>{displayName}</span>!
            </span>
            <button
              onClick={() => { setDraft(preferredName); setEditing(true); }}
              title="What should agents call you?"
              className="ml-2 w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:text-white"
              style={{ color: "var(--bf-gray)", background: "var(--bf-quaternary)", border: "1px solid var(--bf-quinary)" }}
            >
              <Pencil size={14} strokeWidth={2} />
            </button>
          </h1>
        )}

        <p className="text-base max-w-lg" style={{ color: "var(--bf-gray)" }}>
          Servers are your private workspaces where humans and on-chain agents collaborate.
          Create your first one, or browse the marketplace to invite an existing agent.
          {usingFallback && !editing && (
            <>
              {" "}
              <button
                onClick={() => { setDraft(""); setEditing(true); }}
                className="underline hover:text-white transition-colors"
                style={{ color: "var(--bf-accent)" }}
              >
                Tell us what to call you →
              </button>
            </>
          )}
        </p>

        <div className="flex flex-wrap gap-3 justify-center mt-8">
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-black transition-opacity hover:opacity-90"
            style={{ background: "var(--bf-accent)" }}
          >
            <Plus size={18} strokeWidth={2.5} />
            Create your first server
          </button>
          <button
            onClick={() => router.push("/marketplace")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-colors"
            style={{ background: "var(--bf-quaternary)", color: "white", border: "1px solid var(--bf-quinary)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--bf-quinary)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--bf-quaternary)"; }}
          >
            <Compass size={18} strokeWidth={2} />
            Browse the marketplace
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-12 w-full">
          {features.map(({ Icon, title, body, color }) => (
            <div
              key={title}
              className="p-5 rounded-2xl text-left"
              style={{ background: "var(--bf-secondary)", border: "1px solid var(--bf-quinary)" }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                style={{ background: "var(--bf-quaternary)", color }}
              >
                <Icon size={18} strokeWidth={2} />
              </div>
              <p className="text-white font-bold text-sm mb-1">{title}</p>
              <p className="text-xs leading-relaxed" style={{ color: "var(--bf-gray)" }}>{body}</p>
            </div>
          ))}
        </div>

        <div
          className="mt-10 px-4 py-3 rounded-xl flex items-center gap-3 text-sm"
          style={{ background: "var(--bf-secondary)", border: "1px solid var(--bf-quinary)", color: "var(--bf-gray)" }}
        >
          <span style={{ color: "var(--bf-fire)" }}>💡</span>
          <span>
            Each new server gets its own 0G wallet for paying agent inference and gas. You&apos;ll be asked to fund it after creation.
          </span>
        </div>
      </div>
    </div>
  );
}

function NoServerSelectedHero() {
  const router = useRouter();
  return (
    <div className="flex-1 flex items-center justify-center" style={{ background: "var(--bf-primary)" }}>
      <div className="text-center max-w-md px-8">
        <ArrowLeft
          size={28}
          className="mx-auto mb-4 animate-pulse"
          style={{ color: "var(--bf-gray)" }}
          strokeWidth={1.5}
        />
        <p className="font-bold text-white text-xl mb-2">Pick a server</p>
        <p className="text-sm" style={{ color: "var(--bf-gray)" }}>
          Choose a server from the left to see its channels, agents, and wallet.
        </p>
        <button
          onClick={() => router.push("/marketplace")}
          className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          style={{ background: "var(--bf-quaternary)", color: "white", border: "1px solid var(--bf-quinary)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--bf-quinary)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--bf-quaternary)"; }}
        >
          <Compass size={15} />
          Browse marketplace
        </button>
      </div>
    </div>
  );
}

function NoChannelSelected({ serverName }: { serverName: string }) {
  return (
    <div className="flex-1 flex items-center justify-center" style={{ background: "var(--bf-primary)" }}>
      <div className="text-center max-w-md px-8" style={{ color: "var(--bf-gray)" }}>
        <Hash size={32} className="mx-auto mb-3" style={{ color: "var(--bf-symbol)" }} strokeWidth={1.5} />
        <p className="font-bold text-white text-xl">No channel selected</p>
        <p className="text-sm mt-1">
          Pick a text or voice channel in <span className="text-white font-semibold">{serverName}</span> to start chatting.
        </p>
      </div>
    </div>
  );
}

// ── Voice status pane ─────────────────────────────────────────────────────────

interface VoiceAgent {
  id: string;
  name: string;
  emoji?: string;
  avatar?: string;
  slug?: string;
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
      [agent.id]: { name: agent.name, emoji: agent.emoji, color: appAgentAvatarSrc(agent) },
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
              className="px-8 py-2.5 rounded-xl font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: "var(--bf-accent)" }}
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
              : <Mic size={14} style={{ color: "var(--bf-accent)" }} />
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
  /** Hex fallback color or image URL (e.g. identicon). */
  color?: string;
  onTalk?: () => void;
  talkingTo?: boolean;
}) {
  const displayName = participant.userName.startsWith("did:")
    ? participant.userName.slice(0, 14) + "…"
    : participant.userName;

  const avatarSrc = color && !color.startsWith("#") ? color : undefined;
  const fallbackColor = color?.startsWith("#") ? color : "var(--bf-plum)";

  return (
    <div
      className="flex flex-col items-center gap-3 p-5 rounded-2xl transition-all"
      style={{
        background: participant.speaking ? "rgba(208,255,0,0.08)" : "var(--bf-secondary)",
        border: participant.speaking
          ? "1px solid rgba(208,255,0,0.35)"
          : talkingTo
          ? "1px solid var(--bf-accent)"
          : "1px solid var(--bf-quinary)",
      }}
    >
      <div className="relative">
        <Avatar
          name={participant.userName}
          size={60}
          color={fallbackColor}
          emoji={emoji}
          src={avatarSrc}
        />
        {participant.speaking && (
          <span
            className="absolute -bottom-1 -right-1 rounded-full text-xs flex items-center justify-center"
            style={{ width: 20, height: 20, background: "var(--bf-accent)", fontSize: 10 }}
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
