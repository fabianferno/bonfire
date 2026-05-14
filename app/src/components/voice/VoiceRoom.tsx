"use client";

import { useEffect, useRef, useState } from "react";
import { Headphones, Mic, MicOff, PhoneOff } from "lucide-react";
import type { DailyCall } from "@daily-co/daily-js";
import { DailyProvider } from "@daily-co/daily-react";
import { voiceApi, type VoiceSession } from "@/lib/voice";
import VoiceParticipantTile from "./VoiceParticipantTile";
import { useVoiceCall } from "./useVoiceCall";

// ── Props ──────────────────────────────────────────────────────────────────

interface VoiceRoomProps {
  channelId: string;
  channelName: string;
  onClose(): void;
}

// ── Inner component that uses Daily hooks (must be inside DailyProvider) ───

function VoiceRoomInner({
  channelId,
  channelName,
  session,
  onClose,
}: VoiceRoomProps & { session: VoiceSession }) {
  const { joinState, participants, micMuted, toggleMic, leave, error } =
    useVoiceCall({ roomUrl: session.roomUrl, token: session.token });

  const didLeaveRef = useRef(false);

  // ── beforeunload → best-effort beacon ─────────────────────────────────
  useEffect(() => {
    const handler = () => {
      if (didLeaveRef.current) return;
      const url = `${process.env.NEXT_PUBLIC_BONFIRE_BASE_URL ?? "http://localhost:8080"}/v1/channels/${channelId}/voice/leave`;
      navigator.sendBeacon(url, JSON.stringify({ sessionId: session.sessionId }));
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [channelId, session.sessionId]);

  const handleLeave = async () => {
    didLeaveRef.current = true;
    await leave();
    try {
      await voiceApi.leave(channelId, session.sessionId);
    } catch {
      // best-effort
    }
    onClose();
  };

  // ── Auto-close on transport error after brief delay ────────────────────
  useEffect(() => {
    if (joinState !== "error") return;
    const t = setTimeout(async () => {
      try { await voiceApi.leave(channelId, session.sessionId); } catch { /* ignore */ }
      onClose();
    }, 4_000);
    return () => clearTimeout(t);
  }, [joinState, channelId, session.sessionId, onClose]);

  const stateLabel =
    joinState === "joining"
      ? "Connecting…"
      : joinState === "leaving"
      ? "Disconnecting…"
      : joinState === "error"
      ? "Connection error"
      : null;

  const agentName = session.agentSlug ?? "BonFire Bot";

  const cols =
    participants.length <= 2 ? 2 : participants.length <= 4 ? 2 : 3;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "rgba(17,18,20,0.97)" }}
    >
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-6 h-14 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--bf-border)" }}
      >
        <div className="flex items-center gap-3">
          <Headphones size={18} style={{ color: "var(--bf-accent)" }} />
          <span className="text-white font-bold text-sm">{channelName}</span>
          {session.agentSlug && (
            <>
              <span style={{ color: "var(--bf-symbol)" }}>·</span>
              <span className="text-sm" style={{ color: "var(--bf-accent)" }}>
                {agentName}
              </span>
            </>
          )}
        </div>
        {stateLabel && (
          <span className="text-xs px-2 py-1 rounded" style={{ background: "var(--bf-quaternary)", color: joinState === "error" ? "var(--bf-red)" : "var(--bf-gray)" }}>
            {stateLabel}
          </span>
        )}
      </div>

      {/* ── Error toast ─────────────────────────────────────────────────── */}
      {error && (
        <div
          className="mx-6 mt-4 px-4 py-3 rounded-lg text-sm text-center"
          style={{
            background: "rgba(240,71,71,0.15)",
            border: "1px solid var(--bf-red)",
            color: "#f47171",
          }}
        >
          {error} — closing in 4 s…
        </div>
      )}

      {/* ── Participant grid ─────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center overflow-auto px-8 py-6">
        {participants.length === 0 ? (
          <div className="flex flex-col items-center gap-4">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: "var(--bf-quaternary)" }}
            >
              <Headphones size={36} style={{ color: "var(--bf-gray)" }} strokeWidth={1} />
            </div>
            <p className="text-white font-semibold">
              {joinState === "joining" ? "Connecting to voice channel…" : "No participants yet"}
            </p>
          </div>
        ) : (
          <div
            className="w-full max-w-3xl grid gap-4"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            }}
          >
            {participants.map((p) => (
              <VoiceParticipantTile key={p.id} participant={p} />
            ))}
          </div>
        )}
      </div>

      {/* ── Bottom controls ──────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-center gap-4 py-5 flex-shrink-0"
        style={{ borderTop: "1px solid var(--bf-border)" }}
      >
        {/* Mute toggle */}
        <button
          title={micMuted ? "Unmute" : "Mute"}
          onClick={toggleMic}
          className="w-12 h-12 rounded-full flex items-center justify-center transition-colors"
          style={{
            background: micMuted ? "var(--bf-red)" : "var(--bf-quinary)",
            color: "white",
          }}
        >
          {micMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>

        {/* Leave */}
        <button
          title="Leave voice channel"
          onClick={handleLeave}
          className="w-12 h-12 rounded-full flex items-center justify-center transition-opacity hover:opacity-80"
          style={{ background: "var(--bf-red)", color: "white" }}
        >
          <PhoneOff size={20} />
        </button>
      </div>
    </div>
  );
}

// ── Outer shell: fetch session, create call object, render provider ────────

export default function VoiceRoom({ channelId, channelName, onClose }: VoiceRoomProps) {
  const [session, setSession] = useState<VoiceSession | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [callObject, setCallObject] = useState<DailyCall | null>(null);
  const didJoinRef = useRef(false);

  // Join API + create Daily call object
  useEffect(() => {
    if (didJoinRef.current) return;
    didJoinRef.current = true;

    let co: DailyCall | null = null;

    (async () => {
      try {
        // Create call object dynamically (must be client-side)
        const Daily = await import("@daily-co/daily-js");
        co = Daily.default.createCallObject();
        setCallObject(co);

        const sess = await voiceApi.join(channelId);
        setSession(sess);
      } catch (err) {
        setFetchError(
          err instanceof Error ? err.message : "Failed to join voice channel.",
        );
        if (co) co.destroy().catch(() => {});
      }
    })();

    return () => {
      // Cleanup on unmount if session not yet established
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── beforeunload beacon when session available ─────────────────────────
  useEffect(() => {
    if (!session) return;
    const handler = () => {
      const url = `${process.env.NEXT_PUBLIC_BONFIRE_BASE_URL ?? "http://localhost:8080"}/v1/channels/${channelId}/voice/leave`;
      navigator.sendBeacon(url, JSON.stringify({ sessionId: session.sessionId }));
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [session, channelId]);

  if (fetchError) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(17,18,20,0.97)" }}>
        <div className="flex flex-col items-center gap-4 max-w-sm text-center">
          <div className="px-4 py-3 rounded-lg text-sm" style={{ background: "rgba(240,71,71,0.15)", border: "1px solid var(--bf-red)", color: "#f47171" }}>
            {fetchError}
          </div>
          <button onClick={onClose} className="px-6 py-2 rounded text-sm text-white" style={{ background: "var(--bf-quinary)" }}>
            Close
          </button>
        </div>
      </div>
    );
  }

  if (!session || !callObject) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(17,18,20,0.97)" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--bf-accent)" }} />
          <p className="text-sm" style={{ color: "var(--bf-gray)" }}>Connecting…</p>
        </div>
      </div>
    );
  }

  return (
    <DailyProvider callObject={callObject}>
      <VoiceRoomInner
        channelId={channelId}
        channelName={channelName}
        session={session}
        onClose={async () => {
          onClose();
          // Destroy call object after modal closes
          setTimeout(() => callObject.destroy().catch(() => {}), 500);
        }}
      />
    </DailyProvider>
  );
}
