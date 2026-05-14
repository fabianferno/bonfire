"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Hash, Volume2, Plus, ChevronDown, Mic, MicOff, Headphones, Settings,
  UserPlus, Cog, BarChart2, PlusCircle, FolderPlus, CalendarPlus, AppWindow,
  Bell, Shield, LogOut, ShieldAlert, ScrollText, ShieldCheck, PhoneOff, Signal,
} from "lucide-react";
import { useApp, type ChannelType, type AuditEntry } from "@/context/AppContext";
import { useVoiceCtx } from "@/context/VoiceContext";
import Modal, { ModalLabel, ModalInput } from "@/components/shared/Modal";
import Avatar from "@/components/shared/Avatar";
import WalletPanel from "@/components/server/WalletPanel";

export default function ServerSidebar() {
  const { activeServer, activeChannelId, setActiveChannel, setActiveVoiceChannelId, createChannel, user, leaveServer, activeServerId } = useApp();
  const voice = useVoiceCtx();

  const [showChannelModal, setShowChannelModal] = useState(false);
  const [newChType, setNewChType] = useState<ChannelType>("text");
  const [chName, setChName] = useState("");
  const [chDesc, setChDesc] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    if (showDropdown) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDropdown]);

  if (!activeServer) return null;

  const textChannels  = activeServer.channels.filter(c => c.type === "text");
  const voiceChannels = activeServer.channels.filter(c => c.type === "voice");

  const handleCreateCh = () => {
    if (!chName.trim()) return;
    createChannel(activeServer.id, chName.trim().toLowerCase().replace(/\s+/g, "-"), newChType, chDesc.trim());
    setChName(""); setChDesc(""); setShowChannelModal(false);
  };

  const handleLeave = () => { leaveServer(activeServerId); router.push("/workspace"); setShowDropdown(false); };

  const menuItem = (icon: React.ReactNode, label: string, onClick?: () => void, danger = false) => (
    <button key={label} onClick={() => { setShowDropdown(false); onClick?.(); }}
      className="flex items-center justify-between w-full px-3 py-2 rounded text-sm transition-colors"
      style={{ color: danger ? "var(--bf-red)" : "var(--bf-gray)" }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = danger ? "var(--bf-red)" : "var(--bf-accent)"; (e.currentTarget as HTMLElement).style.color = "white"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = danger ? "var(--bf-red)" : "var(--bf-gray)"; }}
    >
      <span>{label}</span><span style={{ opacity: 0.7 }}>{icon}</span>
    </button>
  );

  const handleVoiceChannelClick = async (chId: string, chName: string) => {
    setActiveChannel(chId);
    // Open the Daily-powered VoiceRoom overlay
    setActiveVoiceChannelId(chId);
    // Also join legacy WS voice for sidebar presence indicators
    await voice.join(chId, chName);
  };

  return (
    <>
      <aside className="w-60 flex flex-col flex-shrink-0" style={{ background: "var(--bf-secondary)" }}>

        {/* Server header */}
        <div className="relative flex-shrink-0" ref={dropdownRef}>
          <button onClick={() => setShowDropdown(v => !v)}
            className="flex items-center justify-between px-4 h-12 border-b font-bold text-white w-full hover:bg-[var(--bf-quinary)] transition-colors"
            style={{ borderColor: "var(--bf-quaternary)" }}>
            <span className="truncate">{activeServer.name}</span>
            <ChevronDown size={18} style={{ color: "var(--bf-gray)", transform: showDropdown ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
          </button>

          {showDropdown && (
            <div className="absolute top-full left-2 right-2 z-50 rounded-md py-1.5 shadow-2xl"
              style={{ background: "#18191c", border: "1px solid rgba(255,255,255,0.08)", marginTop: 4 }}>
              {menuItem(<UserPlus size={16} />, "Invite to Server")}
              {menuItem(<Cog size={16} />, "Server Settings")}
              {menuItem(<BarChart2 size={16} />, "Server Insights")}
              <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "4px 8px" }} />
              {menuItem(<PlusCircle size={16} />, "Create Channel", () => { setNewChType("text"); setShowChannelModal(true); })}
              {menuItem(<FolderPlus size={16} />, "Create Category")}
              {menuItem(<CalendarPlus size={16} />, "Create Event")}
              {menuItem(<AppWindow size={16} />, "App Directory")}
              <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "4px 8px" }} />
              {menuItem(<Bell size={16} />, "Notification Settings")}
              {menuItem(<Shield size={16} />, "Privacy Settings")}
              {menuItem(<ScrollText size={16} />, "Audit Log", () => setShowAuditLog(true))}
              <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "4px 8px" }} />
              {menuItem(<ShieldAlert size={16} />, "Security Actions", undefined, true)}
              {menuItem(<LogOut size={16} />, "Leave Server", handleLeave, true)}
            </div>
          )}
        </div>

        {/* Wallet */}
        <div className="mt-2"><WalletPanel serverId={activeServer.id} /></div>

        {/* Channel list */}
        <div className="flex-1 overflow-y-auto px-2 py-2">

          {/* Text channels */}
          <ChannelCategory label="Text Channels" onAdd={() => { setNewChType("text"); setShowChannelModal(true); }} />
          {textChannels.map(ch => (
            <ChannelRow key={ch.id} name={ch.name} type="text"
              active={ch.id === activeChannelId}
              onClick={() => setActiveChannel(ch.id)} />
          ))}

          {/* Voice channels */}
          <ChannelCategory label="Voice Channels" onAdd={() => { setNewChType("voice"); setShowChannelModal(true); }} />
          {voiceChannels.map(ch => {
            const isJoined = voice.joinedChannelId === ch.id;
            const inChannel = voice.participants.filter(p => true); // all participants in this room
            return (
              <div key={ch.id}>
                <VoiceChannelRow
                  name={ch.name}
                  active={ch.id === activeChannelId}
                  joined={isJoined}
                  joining={voice.joining && activeChannelId === ch.id}
                  onClick={() => handleVoiceChannelClick(ch.id, ch.name)}
                />
                {/* Participants listed under channel when joined — Discord style */}
                {isJoined && voice.participants.map(p => (
                  <div key={p.userId} className="flex items-center gap-2 pl-8 pr-2 py-0.5 mb-0.5 rounded"
                    style={{ color: "var(--bf-gray)" }}>
                    <div className="relative flex-shrink-0">
                      <Avatar name={p.userName} size={18} color="#6e86d6" />
                      <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border"
                        style={{ background: "var(--bf-green)", borderColor: "var(--bf-secondary)" }} />
                    </div>
                    <span className="text-xs truncate" style={{ color: "var(--bf-gray)" }}>
                      {p.userName.startsWith("did:") ? p.userName.slice(0, 14) + "…" : p.userName}
                    </span>
                    {voice.muted && p.userId === user.id && (
                      <MicOff size={10} style={{ color: "var(--bf-red)", flexShrink: 0 }} />
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Voice Connected bar — like Discord's bottom-left green bar */}
        {voice.joinedChannelId && (
          <div className="flex-shrink-0 px-2 pt-1.5 pb-1" style={{ background: "var(--bf-quaternary)", borderTop: "1px solid var(--bf-quinary)" }}>
            {/* Status row */}
            <div className="flex items-center justify-between px-1 mb-1.5">
              <div className="flex items-center gap-1.5">
                <Signal size={13} strokeWidth={2.5} style={{ color: "var(--bf-green)" }} />
                <span className="text-xs font-semibold" style={{ color: "var(--bf-green)" }}>Voice Connected</span>
              </div>
              <button onClick={voice.leave} title="Disconnect"
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--bf-quinary)] transition-colors"
                style={{ color: "var(--bf-red)" }}>
                <PhoneOff size={13} strokeWidth={2} />
              </button>
            </div>
            <p className="text-xs px-1 mb-2 truncate" style={{ color: "var(--bf-gray)" }}>
              {voice.joinedChannelName} / {activeServer.name}
            </p>
            {/* Mic / Deafen row */}
            <div className="flex items-center gap-0.5 px-0.5">
              <VoiceIconBtn title={voice.muted ? "Unmute" : "Mute"} active={!voice.muted} onClick={voice.toggleMute}>
                {voice.muted ? <MicOff size={16} /> : <Mic size={16} />}
              </VoiceIconBtn>
              <VoiceIconBtn title={voice.deafened ? "Undeafen" : "Deafen"} active={!voice.deafened} onClick={voice.toggleDeafen}>
                <Headphones size={16} />
              </VoiceIconBtn>
            </div>
          </div>
        )}

        {/* User panel */}
        <div className="flex items-center justify-between px-2 py-2 flex-shrink-0" style={{ background: "var(--bf-quaternary)" }}>
          <div className="flex items-center gap-2 min-w-0">
            <div className="relative flex-shrink-0">
              <Avatar name={user.username} size={32} src={user.avatar} color="#6e86d6" />
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
                style={{ background: "var(--bf-green)", borderColor: "var(--bf-quaternary)" }} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white leading-none truncate">{user.username}</p>
              {user.walletAddress ? (
                <button type="button" title={`Click to copy ${user.walletAddress}`}
                  onClick={() => navigator.clipboard?.writeText(user.walletAddress!)}
                  className="text-xs leading-none mt-0.5 truncate font-mono hover:underline text-left"
                  style={{ color: "var(--bf-gray)" }}>
                  {user.walletAddress.slice(0, 6)}…{user.walletAddress.slice(-4)}
                </button>
              ) : (
                <p className="text-xs leading-none mt-0.5 truncate" style={{ color: "var(--bf-gray)" }}>{user.discriminator}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <IconBtn title={voice.muted ? "Unmute" : "Mute"} onClick={voice.toggleMute} active={!voice.muted}>
              {voice.muted ? <MicOff size={18} /> : <Mic size={18} />}
            </IconBtn>
            <IconBtn title={voice.deafened ? "Undeafen" : "Deafen"} onClick={voice.toggleDeafen} active={!voice.deafened}>
              <Headphones size={18} />
            </IconBtn>
            <IconBtn title="User Settings"><Settings size={18} /></IconBtn>
          </div>
        </div>
      </aside>

      {/* Hidden audio elements for remote peers */}
      {voice.participants.filter(p => p.userId !== user.id && p.userId !== "guest").map(p => (
        <RemoteAudio key={p.userId} userId={p.userId} stream={p.stream} deafened={voice.deafened} />
      ))}

      {/* Create Channel Modal */}
      {showChannelModal && (
        <Modal title={`Create ${newChType === "text" ? "Text" : "Voice"} Channel`}
          onClose={() => setShowChannelModal(false)} onConfirm={handleCreateCh} confirmDisabled={!chName.trim()}>
          <div>
            <ModalLabel>Channel Name</ModalLabel>
            <ModalInput autoFocus value={chName} onChange={e => setChName(e.target.value)}
              placeholder={newChType === "text" ? "new-channel" : "General Voice"}
              onKeyDown={e => { if (e.key === "Enter") handleCreateCh(); }} />
          </div>
          {newChType === "text" && (
            <div>
              <ModalLabel>Topic (optional)</ModalLabel>
              <ModalInput value={chDesc} onChange={e => setChDesc(e.target.value)} placeholder="What is this channel about?" />
            </div>
          )}
        </Modal>
      )}

      {/* Audit Log Modal */}
      {showAuditLog && (
        <Modal title="Audit Log" subtitle={`All agent invocations in ${activeServer.name}`} wide onClose={() => setShowAuditLog(false)} maxHeight="60vh">
          {activeServer.auditLog.length === 0 ? (
            <p className="text-center py-8 text-sm" style={{ color: "var(--bf-gray)" }}>No activity yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {activeServer.auditLog.map(entry => <AuditRow key={entry.id} entry={entry} />)}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

// ── Remote audio element ──────────────────────────────────────────────────────

function RemoteAudio({ userId, stream, deafened }: { userId: string; stream?: MediaStream; deafened: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !stream) return;
    el.srcObject = stream;
    el.muted = deafened;
    el.play().catch(() => {});
  }, [stream, deafened]);
  return <audio ref={ref} autoPlay data-voice-peer={userId} style={{ display: "none" }} />;
}

// ── Voice channel row ─────────────────────────────────────────────────────────

function VoiceChannelRow({ name, active, joined, joining, onClick }: {
  name: string; active: boolean; joined: boolean; joining: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-left text-sm transition-colors"
      style={{ background: active ? "var(--bf-quinary)" : "transparent", color: joined ? "var(--bf-green)" : active ? "white" : "var(--bf-senary)" }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
      <Volume2 size={18} style={{ color: joined ? "var(--bf-green)" : "var(--bf-symbol)", flexShrink: 0 }} />
      <span className="truncate flex-1">{name}</span>
      {joining && <span className="text-xs" style={{ color: "var(--bf-gray)" }}>…</span>}
    </button>
  );
}

// ── Standard channel row ──────────────────────────────────────────────────────

function ChannelRow({ name, type, active, onClick }: { name: string; type: ChannelType; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-left text-sm transition-colors"
      style={{ background: active ? "var(--bf-quinary)" : "transparent", color: active ? "white" : "var(--bf-senary)" }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
      {type === "text"
        ? <Hash size={18} style={{ color: "var(--bf-symbol)", flexShrink: 0 }} />
        : <Volume2 size={18} style={{ color: "var(--bf-symbol)", flexShrink: 0 }} />}
      <span className="truncate flex-1">{name}</span>
    </button>
  );
}

// ── Category header ───────────────────────────────────────────────────────────

function ChannelCategory({ label, onAdd }: { label: string; onAdd: () => void }) {
  return (
    <div className="flex items-center justify-between px-1 py-1.5 mt-4 mb-0.5 group">
      <button className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider hover:text-white transition-colors" style={{ color: "var(--bf-gray)" }}>
        <ChevronDown size={12} />{label}
      </button>
      <button onClick={onAdd} title={`Add ${label}`} className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-white rounded p-0.5" style={{ color: "var(--bf-gray)" }}>
        <Plus size={16} />
      </button>
    </div>
  );
}

// ── Icon buttons ──────────────────────────────────────────────────────────────

function IconBtn({ children, title, onClick, active = true }: { children: React.ReactNode; title: string; onClick?: () => void; active?: boolean }) {
  return (
    <button title={title} onClick={onClick}
      className="w-8 h-8 flex items-center justify-center rounded transition-colors hover:bg-[var(--bf-quinary)]"
      style={{ color: active ? "var(--bf-gray)" : "var(--bf-red)" }}>
      {children}
    </button>
  );
}

function VoiceIconBtn({ children, title, active, onClick }: { children: React.ReactNode; title: string; active: boolean; onClick: () => void }) {
  return (
    <button title={title} onClick={onClick}
      className="flex-1 flex items-center justify-center h-7 rounded transition-colors hover:bg-[var(--bf-quinary)]"
      style={{ color: active ? "var(--bf-gray)" : "var(--bf-red)" }}>
      {children}
    </button>
  );
}

// ── Audit row ─────────────────────────────────────────────────────────────────

function AuditRow({ entry }: { entry: AuditEntry }) {
  const [expanded, setExpanded] = useState(false);
  const time = new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const date = new Date(entry.timestamp).toLocaleDateString();
  return (
    <div className="rounded-lg overflow-hidden" style={{ background: "var(--bf-quaternary)" }}>
      <button onClick={() => setExpanded(v => !v)} className="flex items-center gap-3 w-full px-3 py-2.5 text-left">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: "var(--bf-accent)" }}>
          {entry.agentName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white text-sm font-semibold">{entry.agentName}</span>
            <span className="text-xs px-1.5 py-0.5 rounded font-bold text-white uppercase" style={{ background: "var(--bf-accent)", fontSize: 9 }}>BOT</span>
            <span className="text-xs" style={{ color: "var(--bf-gray)" }}>#{entry.channel}</span>
          </div>
          <p className="text-xs truncate mt-0.5" style={{ color: "var(--bf-gray)" }}>{entry.action}</p>
        </div>
        <div className="text-right flex-shrink-0">
          {entry.cost !== undefined && <p className="text-xs font-medium" style={{ color: "var(--bf-fire)" }}>{entry.cost.toFixed(4)} 0G</p>}
          <p className="text-xs" style={{ color: "var(--bf-symbol)" }}>{time}</p>
          <p className="text-xs" style={{ color: "var(--bf-symbol)" }}>{date}</p>
        </div>
      </button>
      {expanded && entry.teeHash && (
        <div className="px-3 pb-3 pt-0 flex items-center gap-2" style={{ borderTop: "1px solid var(--bf-quinary)" }}>
          <ShieldCheck size={13} strokeWidth={2} style={{ color: "#43b581", flexShrink: 0 }} />
          <code className="text-xs flex-1 truncate" style={{ color: "var(--bf-accent)" }}>{entry.teeHash}</code>
          <span className="text-xs font-semibold" style={{ color: "#43b581" }}>TEE Verified</span>
        </div>
      )}
    </div>
  );
}
