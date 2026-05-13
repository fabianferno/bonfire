"use client";
import React, { createContext, useContext, useState, useCallback } from "react";

export type ChannelType = "text" | "voice";
export type AgentStatus = "online" | "busy" | "idle" | "offline";
export type AcquisitionMode = "owned" | "rented" | "licensed";

export interface Skill {
  id: string;
  name: string;
  description: string;
  command: string;
}

export interface Agent {
  id: string;
  name: string;
  avatar?: string;
  description: string;
  model: string;
  status: AgentStatus;
  isBot: boolean;
  skills: Skill[];
  rateInput: number;   // 0G per 1k tokens
  rateOutput: number;
  acquisition?: AcquisitionMode;
  teeHash?: string;
}

export interface Message {
  id: string;
  author: string;
  authorId: string;
  avatar?: string;
  content: string;
  date: string;
  isBot?: boolean;
  teeHash?: string;
  cost?: number;
}

export interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  description?: string;
  messages: Message[];
  defaultAgentId?: string;
}

export interface Member {
  id: string;
  username: string;
  discriminator: string;
  avatar?: string;
  online?: boolean;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  agentName: string;
  agentId: string;
  action: string;
  channel: string;
  cost?: number;
  teeHash?: string;
}

export interface Server {
  id: string;
  name: string;
  color: string;
  icon?: string;
  description?: string;
  channels: Channel[];
  agents: Agent[];
  members: Member[];
  balance: number;     // in 0G
  spentToday: number;
  auditLog: AuditEntry[];
}

export interface UserProfile {
  id: string;
  username: string;
  discriminator: string;
  avatar?: string;
  walletAddress?: string;
}

interface AppContextValue {
  user: UserProfile;
  servers: Server[];
  activeServerId: string;
  activeChannelId: string;
  setActiveServer: (id: string) => void;
  setActiveChannel: (id: string) => void;
  createServer: (name: string, color: string, description?: string) => void;
  createChannel: (serverId: string, name: string, type: ChannelType, description?: string) => void;
  sendMessage: (serverId: string, channelId: string, content: string) => void;
  updateUser: (profile: Partial<UserProfile>) => void;
  addAgent: (serverId: string, agent: Agent) => void;
  updateAgentStatus: (serverId: string, agentId: string, status: AgentStatus) => void;
  leaveServer: (serverId: string) => void;
  addAuditEntry: (serverId: string, entry: Omit<AuditEntry, "id" | "timestamp">) => void;
  activeServer: Server | undefined;
  activeChannel: Channel | undefined;
}

let _nextId = 1000;
const uid = () => { _nextId += 1; return String(_nextId); };

const STARTER_AGENTS: Agent[] = [
  {
    id: "agent-researcher",
    name: "ResearchBot",
    description: "Searches, summarises, and synthesises information from the web and documents.",
    model: "Qwen3.6-Plus",
    status: "online",
    isBot: true,
    skills: [
      { id: "sk-1", name: "Web Search", description: "Search the web for up-to-date info", command: "/search" },
      { id: "sk-2", name: "Summarise", description: "Summarise any text or URL", command: "/summarise" },
    ],
    rateInput: 0.001,
    rateOutput: 0.002,
    teeHash: "0xabcd1234...ef56",
    acquisition: "licensed",
  },
  {
    id: "agent-coder",
    name: "CodeAssist",
    description: "Reviews, writes, and debugs code across languages.",
    model: "DeepSeek-V3",
    status: "idle",
    isBot: true,
    skills: [
      { id: "sk-3", name: "Code Review", description: "Review a PR or code block", command: "/review" },
      { id: "sk-4", name: "Write Code", description: "Generate code from a spec", command: "/write" },
    ],
    rateInput: 0.001,
    rateOutput: 0.002,
    teeHash: "0xdead9876...ba54",
    acquisition: "rented",
  },
];

const DEFAULT_SERVER: Server = {
  id: "server-1",
  name: "My First BonFire",
  color: "#f97316",
  description: "Welcome to your first agent workspace!",
  balance: 50,
  spentToday: 1.2,
  channels: [
    {
      id: "ch-general",
      name: "general",
      type: "text",
      description: "General chat — talk to your agents here",
      messages: [
        {
          id: "msg-1",
          author: "ResearchBot",
          authorId: "agent-researcher",
          content: "👋 Welcome to your BonFire workspace! I'm ResearchBot. Try `/search` to get started.",
          date: new Date().toLocaleDateString(),
          isBot: true,
          teeHash: "0xabcd1234...ef56",
          cost: 0.001,
        },
      ],
      defaultAgentId: "agent-researcher",
    },
    {
      id: "ch-code",
      name: "code-review",
      type: "text",
      description: "Automated code review with CodeAssist",
      messages: [],
      defaultAgentId: "agent-coder",
    },
    {
      id: "ch-voice",
      name: "Voice Lounge",
      type: "voice",
      description: "",
      messages: [],
    },
  ],
  agents: STARTER_AGENTS,
  members: [
    { id: "me", username: "You", discriminator: "#0001", online: true },
  ],
  auditLog: [
    { id: "al-1", timestamp: new Date(Date.now() - 60000).toISOString(), agentId: "agent-researcher", agentName: "ResearchBot", action: "Responded to /search query", channel: "general", cost: 0.0023, teeHash: "0xabcd1234...ef56" },
    { id: "al-2", timestamp: new Date(Date.now() - 120000).toISOString(), agentId: "agent-coder", agentName: "CodeAssist", action: "Completed /review on 3 files", channel: "code-review", cost: 0.0041, teeHash: "0xdead9876...ba54" },
    { id: "al-3", timestamp: new Date(Date.now() - 300000).toISOString(), agentId: "agent-researcher", agentName: "ResearchBot", action: "Summarised URL via /summarise", channel: "general", cost: 0.0011, teeHash: "0xabcd1234...ef56" },
  ],
};

const DEFAULT_USER: UserProfile = {
  id: "me",
  username: "You",
  discriminator: "#0001",
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<UserProfile>(DEFAULT_USER);
  const [servers, setServers] = useState<Server[]>([DEFAULT_SERVER]);
  const [activeServerId, setActiveServerId] = useState(DEFAULT_SERVER.id);
  const [activeChannelId, setActiveChannelId] = useState(DEFAULT_SERVER.channels[0].id);

  const activeServer = servers.find(s => s.id === activeServerId);
  const activeChannel = activeServer?.channels.find(c => c.id === activeChannelId);

  const setActiveServer = useCallback((id: string) => {
    setActiveServerId(id);
    setServers(prev => {
      const srv = prev.find(s => s.id === id);
      if (srv) {
        const first = srv.channels.find(c => c.type === "text") ?? srv.channels[0];
        if (first) setActiveChannelId(first.id);
      }
      return prev;
    });
  }, []);

  const setActiveChannel = useCallback((id: string) => setActiveChannelId(id), []);

  const createServer = useCallback((name: string, color: string, description?: string) => {
    const id = uid();
    const chId = uid();
    const srv: Server = {
      id,
      name,
      color,
      description,
      balance: 0,
      spentToday: 0,
      channels: [
        { id: chId, name: "general", type: "text", description: `Welcome to ${name}!`, messages: [
          { id: uid(), author: "System", authorId: "system", content: `Welcome to ${name}! Fund your server with 0G to invite agents.`, date: new Date().toLocaleDateString(), isBot: true },
        ]},
        { id: uid(), name: "General Voice", type: "voice", description: "", messages: [] },
      ],
      agents: [],
      members: [{ id: "me", username: user.username, discriminator: user.discriminator, avatar: user.avatar, online: true }],
      auditLog: [],
    };
    setServers(prev => [...prev, srv]);
    setActiveServerId(id);
    setActiveChannelId(chId);
  }, [user]);

  const createChannel = useCallback((serverId: string, name: string, type: ChannelType, description?: string) => {
    const id = uid();
    setServers(prev => prev.map(s => s.id !== serverId ? s : {
      ...s,
      channels: [...s.channels, { id, name, type, description: description ?? "", messages: [] }],
    }));
    if (type === "text") setActiveChannelId(id);
  }, []);

  const sendMessage = useCallback((serverId: string, channelId: string, content: string) => {
    if (!content.trim()) return;
    const msg: Message = {
      id: uid(),
      author: user.username,
      authorId: user.id,
      avatar: user.avatar,
      content: content.trim(),
      date: new Date().toLocaleDateString(),
    };
    setServers(prev => prev.map(s => s.id !== serverId ? s : {
      ...s,
      channels: s.channels.map(c => c.id !== channelId ? c : { ...c, messages: [...c.messages, msg] }),
    }));
  }, [user]);

  const updateUser = useCallback((profile: Partial<UserProfile>) => {
    setUserState(prev => ({ ...prev, ...profile }));
  }, []);

  const addAgent = useCallback((serverId: string, agent: Agent) => {
    setServers(prev => prev.map(s => s.id !== serverId ? s : { ...s, agents: [...s.agents, agent] }));
  }, []);

  const updateAgentStatus = useCallback((serverId: string, agentId: string, status: AgentStatus) => {
    setServers(prev => prev.map(s => s.id !== serverId ? s : {
      ...s,
      agents: s.agents.map(a => a.id !== agentId ? a : { ...a, status }),
    }));
  }, []);

  const leaveServer = useCallback((serverId: string) => {
    setServers(prev => {
      const remaining = prev.filter(s => s.id !== serverId);
      if (remaining.length > 0) {
        setActiveServerId(remaining[0].id);
        const first = remaining[0].channels.find(c => c.type === "text") ?? remaining[0].channels[0];
        if (first) setActiveChannelId(first.id);
      }
      return remaining;
    });
  }, []);

  const addAuditEntry = useCallback((serverId: string, entry: Omit<AuditEntry, "id" | "timestamp">) => {
    setServers(prev => prev.map(s => s.id !== serverId ? s : {
      ...s,
      auditLog: [{ ...entry, id: uid(), timestamp: new Date().toISOString() }, ...s.auditLog],
    }));
  }, []);

  return (
    <AppContext.Provider value={{
      user, servers, activeServerId, activeChannelId,
      setActiveServer, setActiveChannel,
      createServer, createChannel, sendMessage,
      updateUser, addAgent, updateAgentStatus,
      leaveServer, addAuditEntry,
      activeServer, activeChannel,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be inside AppProvider");
  return ctx;
}
