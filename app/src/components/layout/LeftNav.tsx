"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Compass } from "lucide-react";
import { useApp } from "@/context/AppContext";
import Modal, { ModalLabel, ModalInput } from "@/components/shared/Modal";

const SERVER_COLORS = ["#f97316","#6e86d6","#43b581","#f04747","#faa61a","#6633cc","#00d8ff","#ed1b24"];

export default function LeftNav() {
  const { servers, activeServerId, setActiveServer, createServer } = useApp();
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(SERVER_COLORS[0]);
  const [desc, setDesc] = useState("");

  const handleCreate = () => {
    if (!name.trim()) return;
    createServer(name.trim(), color, desc.trim());
    setName(""); setDesc(""); setColor(SERVER_COLORS[0]);
    setShowModal(false);
  };

  return (
    <>
      <nav
        className="w-[72px] flex flex-col items-center py-3 gap-2 overflow-y-auto flex-shrink-0"
        style={{ background: "var(--bf-tertiary)" }}
      >
        {servers.map(srv => (
          <ServerPill
            key={srv.id}
            name={srv.name}
            color={srv.color}
            icon={srv.icon}
            active={activeServerId === srv.id}
            onClick={() => { setActiveServer(srv.id); router.push("/workspace"); }}
          />
        ))}

        {/* Separator */}
        <div className="w-8 border-b" style={{ borderColor: "var(--bf-quinary)" }} />

        {/* Add server */}
        <NavPill
          title="Add a Server"
          onClick={() => setShowModal(true)}
          accentColor="#43b581"
        >
          <Plus size={24} strokeWidth={2} />
        </NavPill>

        {/* Discover */}
        <NavPill title="Discover Servers" accentColor="#6e86d6" onClick={() => router.push("/marketplace")}>
          <Compass size={22} strokeWidth={1.5} />
        </NavPill>
      </nav>

      {showModal && (
        <Modal
          title="Create a Server"
          subtitle="Give your agent workspace a name and colour."
          onClose={() => setShowModal(false)}
          onConfirm={handleCreate}
          confirmDisabled={!name.trim()}
          confirmLabel="Create Server"
        >
          <div>
            <ModalLabel>Server Name</ModalLabel>
            <ModalInput
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="My Research Lab"
              onKeyDown={e => { if (e.key === "Enter") handleCreate(); }}
            />
          </div>
          <div>
            <ModalLabel>Description (optional)</ModalLabel>
            <ModalInput
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="What does this server do?"
            />
          </div>
          <div>
            <ModalLabel>Colour</ModalLabel>
            <div className="flex gap-2 flex-wrap">
              {SERVER_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  style={{
                    background: c,
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    border: color === c ? "3px solid white" : "3px solid transparent",
                    transition: "transform 0.1s",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1.15)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
                />
              ))}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function ServerPill({
  name, color, icon, active, onClick,
}: {
  name: string; color: string; icon?: string; active: boolean; onClick: () => void;
}) {
  return (
    <div className="relative flex items-center flex-shrink-0 group" style={{ width: 72, height: 48 }}>
      {/* Tooltip */}
      <div
        className="pointer-events-none absolute left-full ml-4 px-3 py-1.5 rounded-md text-sm font-semibold text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-xl"
        style={{ background: "#18191c" }}
      >
        <span
          className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-0 h-0"
          style={{ borderTop: "6px solid transparent", borderBottom: "6px solid transparent", borderRight: "6px solid #18191c" }}
        />
        {name}
      </div>

      {/* Active indicator pill */}
      <span
        className="absolute left-0 rounded-r-full bg-white transition-all duration-200"
        style={{
          width: 4,
          height: active ? 36 : 8,
          top: "50%",
          transform: "translateY(-50%)",
          opacity: active ? 1 : 0,
        }}
      />

      <button
        onClick={onClick}
        title={name}
        className="mx-auto flex items-center justify-center font-bold text-white transition-all duration-150 overflow-hidden"
        style={{
          width: 48,
          height: 48,
          borderRadius: active ? "30%" : "50%",
          background: color,
        }}
        onMouseEnter={e => {
          if (!active) (e.currentTarget as HTMLElement).style.borderRadius = "30%";
        }}
        onMouseLeave={e => {
          if (!active) (e.currentTarget as HTMLElement).style.borderRadius = "50%";
        }}
      >
        {icon
          ? <img src={icon} alt={name} className="w-7 h-7 object-cover" />
          : <span className="text-xl select-none">{name.charAt(0).toUpperCase()}</span>
        }
      </button>
    </div>
  );
}

function NavPill({
  children, title, onClick, accentColor,
}: {
  children: React.ReactNode; title: string; onClick?: () => void; accentColor: string;
}) {
  return (
    <div className="relative flex items-center flex-shrink-0 group" style={{ width: 72, height: 48 }}>
      {/* Tooltip */}
      <div
        className="pointer-events-none absolute left-full ml-4 px-3 py-1.5 rounded-md text-sm font-semibold text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-xl"
        style={{ background: "#18191c" }}
      >
        <span
          className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-0 h-0"
          style={{ borderTop: "6px solid transparent", borderBottom: "6px solid transparent", borderRight: "6px solid #18191c" }}
        />
        {title}
      </div>

      <button
        onClick={onClick}
        title={title}
        className="mx-auto flex items-center justify-center transition-all duration-150 flex-shrink-0"
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: "var(--bf-secondary)",
          color: accentColor,
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = accentColor;
          (e.currentTarget as HTMLElement).style.color = "white";
          (e.currentTarget as HTMLElement).style.borderRadius = "30%";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = "var(--bf-secondary)";
          (e.currentTarget as HTMLElement).style.color = accentColor;
          (e.currentTarget as HTMLElement).style.borderRadius = "50%";
        }}
      >
        {children}
      </button>
    </div>
  );
}
