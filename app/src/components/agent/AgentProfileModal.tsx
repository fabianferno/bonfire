"use client";
import { ShieldCheck, Zap } from "lucide-react";
import type { Agent } from "@/context/AppContext";
import Modal from "@/components/shared/Modal";
import Avatar from "@/components/shared/Avatar";
import PresenceDot from "./PresenceDot";

interface Props {
  agent: Agent;
  onClose: () => void;
}

export default function AgentProfileModal({ agent, onClose }: Props) {
  return (
    <Modal title="" onClose={onClose} wide>
      <div className="flex items-center gap-4">
        <Avatar
          name={agent.name}
          size={56}
          color={agent.avatar?.startsWith("#") ? agent.avatar : "#6e86d6"}
          src={agent.avatar?.startsWith("#") ? undefined : agent.avatar}
        />
        <div>
          <div className="flex items-center gap-2">
            <span className="text-white text-lg font-bold">{agent.name}</span>
            <span className="text-xs px-1.5 py-0.5 rounded text-white font-bold uppercase" style={{ background: "var(--bf-accent)", fontSize: 10 }}>BOT</span>
            <PresenceDot status={agent.status} />
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--bf-gray)" }}>{agent.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded p-3" style={{ background: "var(--bf-quaternary)" }}>
          <p className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--bf-gray)" }}>Model</p>
          <p className="text-white font-medium">{agent.model}</p>
        </div>
        <div className="rounded p-3" style={{ background: "var(--bf-quaternary)" }}>
          <p className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--bf-gray)" }}>Rate</p>
          <p className="text-white font-medium">{agent.rateInput} / {agent.rateOutput} 0G / 1k tokens</p>
        </div>
      </div>

      {agent.teeHash && (
        <div className="rounded p-3 text-sm" style={{ background: "var(--bf-quaternary)" }}>
          <p className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--bf-gray)" }}>TEE Attestation</p>
          <div className="flex items-center gap-2">
            <code className="text-xs flex-1 truncate" style={{ color: "var(--bf-accent)" }}>{agent.teeHash}</code>
            <button
              className="flex items-center gap-1 text-xs px-2 py-1 rounded font-semibold text-white"
              style={{ background: "var(--bf-green)" }}
              onClick={() => alert(`TEE Attestation report:\n\n${agent.teeHash}\n\nVerified on 0G Compute Network`)}
            >
              <ShieldCheck size={12} strokeWidth={2} />
              Verify
            </button>
          </div>
        </div>
      )}

      {agent.skills.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--bf-gray)" }}>Skills</p>
          <div className="grid grid-cols-2 gap-2">
            {agent.skills.map(skill => (
              <div key={skill.id} className="rounded p-3" style={{ background: "var(--bf-quaternary)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <Zap size={12} strokeWidth={2} style={{ color: "var(--bf-accent)", flexShrink: 0 }} />
                  <code className="text-xs" style={{ color: "var(--bf-accent)" }}>{skill.command}</code>
                </div>
                <p className="text-white text-sm font-medium">{skill.name}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--bf-gray)" }}>{skill.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
