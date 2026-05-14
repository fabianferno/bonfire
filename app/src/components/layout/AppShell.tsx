"use client";
import dynamic from "next/dynamic";
import LeftNav from "./LeftNav";
import ServerSidebar from "./ServerSidebar";
import CenterPane from "./CenterPane";
import AgentSidebar from "./AgentSidebar";
import { useApp } from "@/context/AppContext";

// Lazy-load VoiceRoom so Daily.co JS doesn't load until needed
const VoiceRoom = dynamic(
  () => import("@/components/voice/VoiceRoom"),
  { ssr: false },
);

export default function AppShell() {
  const { activeVoiceChannelId, setActiveVoiceChannelId, activeServer } = useApp();

  const voiceChannel = activeServer?.channels.find(
    (c) => c.id === activeVoiceChannelId,
  );

  return (
    <div className="flex h-full w-full overflow-hidden">
      <LeftNav />
      <ServerSidebar />
      <CenterPane />
      <AgentSidebar />

      {/* Daily-powered voice overlay — mounts on top of everything */}
      {activeVoiceChannelId && voiceChannel && (
        <VoiceRoom
          channelId={activeVoiceChannelId}
          channelName={voiceChannel.name}
          onClose={() => setActiveVoiceChannelId(null)}
        />
      )}
    </div>
  );
}
