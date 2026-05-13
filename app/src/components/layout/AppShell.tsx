"use client";
import LeftNav from "./LeftNav";
import ServerSidebar from "./ServerSidebar";
import CenterPane from "./CenterPane";
import AgentSidebar from "./AgentSidebar";

export default function AppShell() {
  return (
    <div className="flex h-full w-full overflow-hidden">
      <LeftNav />
      <ServerSidebar />
      <CenterPane />
      <AgentSidebar />
    </div>
  );
}
