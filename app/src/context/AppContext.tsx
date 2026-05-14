"use client";
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { bf } from "@/lib/api-bonfire";
import type {
  BackendServer,
  BackendChannel,
  BackendMessage,
  BackendAgent,
  BackendMember,
  BackendServerWallet,
  BackendServerFunding,
} from "@/lib/types";

// ─── Public types (kept stable so existing components compile) ─────────────

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
  emoji?: string;
  description: string;
  model?: string;
  status: AgentStatus;
  isBot: boolean;
  skills: Skill[];
  rateInput?: number;
  rateOutput?: number;
  acquisition?: AcquisitionMode;
  teeHash?: string;
  logs?: AgentLog[];
}

export interface AgentLog {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error" | "tool";
  message: string;
  toolName?: string;
  toolInput?: string;
  toolOutput?: string;
  durationMs?: number;
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
  // cascade metadata (optional — MessageRow ignores these if absent)
  cascadeHop?: number | null;
  cascadeRootId?: string | null;
  replyToId?: string | null;
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
  balance: number;
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
  activeVoiceChannelId: string | null;
  setActiveVoiceChannelId: (id: string | null) => void;
  setActiveServer: (id: string) => void;
  setActiveChannel: (id: string) => void;
  createServer: (name: string, color: string, description?: string) => Promise<{
    server: Server;
    wallet?: BackendServerWallet;
    funding?: BackendServerFunding;
  }>;
  createChannel: (
    serverId: string,
    name: string,
    type: ChannelType,
    description?: string,
  ) => void;
  sendMessage: (serverId: string, channelId: string, content: string) => void;
  updateUser: (profile: Partial<UserProfile>) => void;
  addAgent: (serverId: string, agent: Agent) => void;
  updateAgentStatus: (
    serverId: string,
    agentId: string,
    status: AgentStatus,
  ) => void;
  leaveServer: (serverId: string) => void;
  addAuditEntry: (
    serverId: string,
    entry: Omit<AuditEntry, "id" | "timestamp">,
  ) => void;
  activeServer: Server | undefined;
  activeChannel: Channel | undefined;
  loading: boolean;
  error: string | null;
}

// ─── Example / demo agents ────────────────────────────────────────────────

const EXAMPLE_AGENTS: Agent[] = [
  {
    id: "demo-research",
    name: "ResearchBot",
    emoji: "🔭",
    avatar: "#1a3a5c",
    description: "Deep web research, citation gathering, and summarisation. Ask it anything factual.",
    model: "GLM-5",
    status: "online",
    isBot: true,
    rateInput: 0.001,
    rateOutput: 0.002,
    acquisition: "owned",
    skills: [
      { id: "sk-1", command: "/search", name: "Web Search", description: "Search the live web and return citations" },
      { id: "sk-2", command: "/summarise", name: "Summarise", description: "Condense any URL or text into key points" },
    ],
    logs: [
      { id: "l1", timestamp: new Date(Date.now() - 120000).toISOString(), level: "info", message: "Agent started, model GLM-5 ready" },
      { id: "l2", timestamp: new Date(Date.now() - 90000).toISOString(), level: "tool", message: "Invoked web_search", toolName: "web_search", toolInput: '{"query":"0G network docs"}', toolOutput: '{"results":[{"url":"https://0g.ai","snippet":"0G is a modular AI blockchain..."}]}', durationMs: 420 },
      { id: "l3", timestamp: new Date(Date.now() - 60000).toISOString(), level: "info", message: "Returned 3 citations to user" },
    ],
  },
  {
    id: "demo-code",
    name: "CodeForge",
    emoji: "⚡",
    avatar: "#1a3b1a",
    description: "Write, review, and debug code across 20+ languages. Runs in a sandboxed TEE environment.",
    model: "DeepSeek-V3",
    status: "online",
    isBot: true,
    rateInput: 0.0015,
    rateOutput: 0.003,
    acquisition: "licensed",
    teeHash: "0xd3adb33f8e14ca11ab1e0000deadc0defacecafe",
    skills: [
      { id: "sk-3", command: "/review", name: "Code Review", description: "Review a PR or paste code for issues" },
      { id: "sk-4", command: "/fix", name: "Auto Fix", description: "Automatically patch identified bugs" },
      { id: "sk-5", command: "/test", name: "Generate Tests", description: "Write unit tests for any function" },
    ],
    logs: [
      { id: "l4", timestamp: new Date(Date.now() - 300000).toISOString(), level: "info", message: "TEE attestation verified ✓" },
      { id: "l5", timestamp: new Date(Date.now() - 200000).toISOString(), level: "tool", message: "Invoked code_sandbox", toolName: "code_sandbox", toolInput: '{"lang":"typescript","code":"const x=1"}', toolOutput: '{"stdout":"","exitCode":0}', durationMs: 810 },
      { id: "l6", timestamp: new Date(Date.now() - 100000).toISOString(), level: "warn", message: "Token usage approaching context limit (72%)" },
    ],
  },
  {
    id: "demo-finance",
    name: "FinSight",
    emoji: "📊",
    avatar: "#2a1a3b",
    description: "Real-time crypto prices, on-chain analytics, and DeFi strategy recommendations.",
    model: "Qwen3.6-Plus",
    status: "busy",
    isBot: true,
    rateInput: 0.002,
    rateOutput: 0.004,
    acquisition: "rented",
    skills: [
      { id: "sk-6", command: "/price", name: "Price Lookup", description: "Get live token prices from CoinGecko" },
      { id: "sk-7", command: "/portfolio", name: "Portfolio Analysis", description: "Analyse an on-chain wallet" },
    ],
    logs: [
      { id: "l7", timestamp: new Date(Date.now() - 45000).toISOString(), level: "tool", message: "Invoked price_feed", toolName: "price_feed", toolInput: '{"token":"OG"}', toolOutput: '{"price":0.042,"change24h":"+3.1%"}', durationMs: 230 },
      { id: "l8", timestamp: new Date(Date.now() - 20000).toISOString(), level: "info", message: "Portfolio report delivered to channel" },
    ],
  },
  {
    id: "demo-voice",
    name: "VoxAgent",
    emoji: "🎙️",
    avatar: "#3b1a1a",
    description: "Joins voice channels and participates in conversations using real-time speech synthesis.",
    model: "GLM-5",
    status: "idle",
    isBot: true,
    rateInput: 0.001,
    rateOutput: 0.002,
    acquisition: "owned",
    skills: [
      { id: "sk-8", command: "/speak", name: "Text-to-Speech", description: "Read a message aloud in VC" },
      { id: "sk-9", command: "/transcribe", name: "Transcribe", description: "Convert VC audio to text notes" },
    ],
    logs: [
      { id: "l9", timestamp: new Date(Date.now() - 600000).toISOString(), level: "info", message: "Voice session initialised in General Voice" },
      { id: "l10", timestamp: new Date(Date.now() - 580000).toISOString(), level: "info", message: "TTS engine ready (0G Compute node #7)" },
    ],
  },
  {
    id: "demo-assistant",
    name: "Ember",
    emoji: "🔥",
    avatar: "#3b2a0a",
    description: "Your general-purpose BonFire assistant. Manages servers, answers questions, routes tasks to specialists.",
    model: "GLM-5",
    status: "online",
    isBot: true,
    rateInput: 0.001,
    rateOutput: 0.002,
    acquisition: "owned",
    skills: [
      { id: "sk-10", command: "/help", name: "Help", description: "List all available commands" },
      { id: "sk-11", command: "/route", name: "Route Task", description: "Delegate a task to the best specialist agent" },
    ],
    logs: [
      { id: "l11", timestamp: new Date(Date.now() - 1800000).toISOString(), level: "info", message: "Ember online — watching all channels" },
      { id: "l12", timestamp: new Date(Date.now() - 900000).toISOString(), level: "info", message: "Routed /search task to ResearchBot" },
      { id: "l13", timestamp: new Date(Date.now() - 30000).toISOString(), level: "info", message: "Responded to 12 messages today" },
    ],
  },
];

// ─── ID helpers ────────────────────────────────────────────────────────────

let _nextId = 9000;
const uid = () => {
  _nextId += 1;
  return String(_nextId);
};

const LS_ACTIVE_SERVER = "bonfire_active_server";

// ─── Mappers ───────────────────────────────────────────────────────────────

function mapServer(s: BackendServer): Omit<Server, "channels" | "agents" | "members"> {
  return {
    id: s.id,
    name: s.name,
    color: "#f97316", // backend has no color — use default fire orange
    icon: s.iconUrl ?? undefined,
    description: undefined,
    balance: 0,
    spentToday: 0,
    auditLog: [],
  };
}

function mapChannel(c: BackendChannel): Channel {
  return {
    id: c.id,
    name: c.name,
    type: "text",
    description: c.topic ?? undefined,
    messages: [],
    defaultAgentId: c.defaultAgentId ?? undefined,
  };
}

function mapAgent(a: BackendAgent): Agent {
  return {
    id: a.id,
    name: a.name,
    avatar: a.avatarUrl ?? undefined,
    description: a.description,
    model: undefined,
    status: "online",
    isBot: true,
    skills: [],
    rateInput: undefined,
    rateOutput: undefined,
    teeHash: undefined,
  };
}

function mapMember(m: BackendMember): Member {
  return {
    id: m.principalId,
    username: m.alias ?? m.principalId,
    discriminator: "#0000",
    online: true,
  };
}

function mapMessage(
  m: BackendMessage,
  agentMap: Map<string, Agent>,
  userMap: Map<string, UserProfile>,
  selfId: string,
): Message {
  const isBot = m.authorType === "agent";
  let author = m.authorId;
  let avatar: string | undefined;

  if (isBot) {
    const agent = agentMap.get(m.authorId);
    author = agent?.name ?? m.authorId;
    avatar = agent?.avatar;
  } else {
    if (m.authorId === selfId) {
      author = userMap.get(selfId)?.username ?? "You";
    } else {
      author = userMap.get(m.authorId)?.username ?? m.authorId;
    }
  }

  return {
    id: m.id,
    author,
    authorId: m.authorId,
    avatar,
    content: m.content,
    date: new Date(m.createdAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    isBot,
    cascadeHop: m.cascadeHop,
    cascadeRootId: m.cascadeRootId,
    replyToId: m.replyToId,
  };
}

// ─── Context ───────────────────────────────────────────────────────────────

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user: authUser, status: authStatus } = useAuth();

  // Derive UserProfile directly from authUser — no separate state needed
  const user: UserProfile = authUser
    ? {
        id: authUser.id,
        username: authUser.displayName || authUser.username,
        discriminator: "#0001",
        avatar: authUser.avatarUrl ?? undefined,
        walletAddress: authUser.walletAddress ?? undefined,
      }
    : { id: "", username: "You", discriminator: "#0001" };

  const [servers, setServers] = useState<Server[]>([]);
  const [activeServerId, setActiveServerId] = useState("");
  const [activeChannelId, setActiveChannelId] = useState("");
  const [activeVoiceChannelId, setActiveVoiceChannelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Agent / user caches for message mapping
  const agentMapRef = useRef<Map<string, Agent>>(new Map());
  const userMapRef = useRef<Map<string, UserProfile>>(new Map());

  // Polling cleanup
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeChannelIdRef = useRef(activeChannelId);

  // Keep ref in sync via effect (not during render)
  useEffect(() => {
    activeChannelIdRef.current = activeChannelId;
  }, [activeChannelId]);

  // Keep user map cache in sync
  useEffect(() => {
    if (authUser) {
      userMapRef.current.set(authUser.id, user);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

  // ── Merge messages helper ──────────────────────────────────────────────
  const mergeMessages = useCallback(
    (existing: Message[], incoming: Message[]): Message[] => {
      const byId = new Map<string, Message>();
      for (const m of existing) byId.set(m.id, m);
      for (const m of incoming) byId.set(m.id, m);
      return Array.from(byId.values()).sort((a, b) => {
        // date strings from mapMessage are locale times — use id lexicographic order
        // as a stable tiebreak; backend returns newest-first so we need oldest-first
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      });
    },
    [],
  );

  // ── Fetch messages for a channel and merge into state ─────────────────
  const fetchAndMergeMessages = useCallback(
    async (channelId: string, selfId: string) => {
      try {
        const { messages: raw } = await bf.listMessages(channelId, {
          limit: 50,
        });
        const mapped = raw.map((m) =>
          mapMessage(m, agentMapRef.current, userMapRef.current, selfId),
        );
        setServers((prev) =>
          prev.map((s) => ({
            ...s,
            channels: s.channels.map((c) => {
              if (c.id !== channelId) return c;
              return { ...c, messages: mergeMessages(c.messages, mapped) };
            }),
          })),
        );
      } catch {
        // Silently ignore poll errors
      }
    },
    [mergeMessages],
  );

  // ── Start / stop polling ───────────────────────────────────────────────
  const startPolling = useCallback(
    (channelId: string, selfId: string) => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = setInterval(() => {
        // Only poll if channel hasn't changed
        if (activeChannelIdRef.current === channelId) {
          fetchAndMergeMessages(channelId, selfId);
        }
      }, 3000);
    },
    [fetchAndMergeMessages],
  );

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // ── Load servers on auth ───────────────────────────────────────────────
  useEffect(() => {
    if (authStatus !== "authenticated" || !authUser) return;

    let cancelled = false;

    async function loadServers() {
      setLoading(true);
      setError(null);
      try {
        const { servers: raw } = await bf.listServers();
        if (cancelled) return;

        const mapped: Server[] = raw.map((s) => ({
          ...mapServer(s),
          channels: [],
          agents: [],
          members: [],
        }));
        setServers(mapped);

        // Pick active server
        const stored = typeof window !== "undefined"
          ? localStorage.getItem(LS_ACTIVE_SERVER)
          : null;
        const initialId =
          stored && mapped.find((s) => s.id === stored)
            ? stored
            : mapped[0]?.id ?? "";
        if (!cancelled) setActiveServerId(initialId);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load servers");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadServers();
    return () => { cancelled = true; };
  }, [authStatus, authUser]);

  // ── Load channels + members when active server changes ────────────────
  useEffect(() => {
    if (!activeServerId || !authUser) return;

    let cancelled = false;

    async function loadServerData() {
      try {
        const [{ channels: rawCh }, { members: rawMembers }] = await Promise.all([
          bf.getChannels(activeServerId),
          bf.listMembers(activeServerId),
        ]);
        if (cancelled) return;

        const textChannels = rawCh
          .filter((c) => c.type === "text")
          .map(mapChannel);

        // Voice channels live purely on the client (backend has no voice type).
        // Persist them per-server in localStorage so they survive reloads.
        const voiceKey = `bonfire_voice_${activeServerId}`;
        let voiceChannels: Channel[] = [];
        try {
          const stored = typeof window !== "undefined" ? localStorage.getItem(voiceKey) : null;
          voiceChannels = stored ? JSON.parse(stored) : [];
        } catch { /* ignore */ }
        // Always ensure at least one default voice channel
        if (voiceChannels.length === 0) {
          voiceChannels = [{ id: `voice-${activeServerId}`, name: "General Voice", type: "voice", description: "", messages: [] }];
          try { if (typeof window !== "undefined") localStorage.setItem(voiceKey, JSON.stringify(voiceChannels)); } catch { /* ignore */ }
        }

        // Separate agent vs user members
        const agentMembers = rawMembers.filter((m) => m.principalType === "agent");
        const userMembers = rawMembers.filter((m) => m.principalType === "user");

        // Fetch agent details for all agent members in parallel
        const agentDetails = await Promise.allSettled(
          agentMembers.map((m) => bf.getAgent(m.principalId)),
        );

        let agents: Agent[] = agentDetails
          .filter(
            (r): r is PromiseFulfilledResult<{ agent: BackendAgent }> =>
              r.status === "fulfilled",
          )
          .map((r) => mapAgent(r.value.agent));

        // Seed example agents when the server has none from the backend
        if (agents.length === 0) {
          agents = EXAMPLE_AGENTS;
        }

        // Populate agent map cache
        for (const a of agents) agentMapRef.current.set(a.id, a);

        const members: Member[] = userMembers.map(mapMember);

        if (cancelled) return;

        setServers((prev) =>
          prev.map((s) => {
            if (s.id !== activeServerId) return s;
            return { ...s, channels: [...textChannels, ...voiceChannels], agents, members };
          }),
        );

        // Set first text channel as active
        const firstCh = textChannels[0];
        if (firstCh) {
          setActiveChannelId(firstCh.id);
        }
      } catch {
        // Non-fatal — server data load errors are soft
      }
    }

    loadServerData();
    return () => { cancelled = true; };
  }, [activeServerId, authUser]);

  // ── Fetch messages + start polling when active channel changes ────────
  useEffect(() => {
    if (!activeChannelId || !authUser) return;

    stopPolling();
    fetchAndMergeMessages(activeChannelId, authUser.id);
    startPolling(activeChannelId, authUser.id);

    return () => stopPolling();
  }, [activeChannelId, authUser, fetchAndMergeMessages, startPolling, stopPolling]);

  // ── Persist active server ──────────────────────────────────────────────
  useEffect(() => {
    if (activeServerId && typeof window !== "undefined") {
      localStorage.setItem(LS_ACTIVE_SERVER, activeServerId);
    }
  }, [activeServerId]);

  // ── Actions ───────────────────────────────────────────────────────────

  const setActiveServer = useCallback((id: string) => {
    setActiveServerId(id);
    // Channel will be reset in the "active server changes" effect
  }, []);

  const setActiveChannel = useCallback((id: string) => {
    setActiveChannelId(id);
  }, []);

  const setVoiceChannelId = useCallback((id: string | null) => {
    setActiveVoiceChannelId(id);
  }, []);

  const createServer = useCallback(
    async (name: string, _color: string, _description?: string): Promise<{
      server: Server;
      wallet?: BackendServerWallet;
      funding?: BackendServerFunding;
    }> => {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 32) || `server-${Date.now()}`;
      try {
        const result = await bf.createServer({ name, slug });
        const newServer: Server = {
          ...mapServer(result.server),
          color: _color,
          description: _description,
          channels: [],
          agents: [],
          members: [],
        };
        setServers((prev) => [...prev, newServer]);
        setActiveServerId(result.server.id);
        setActiveChannelId("");
        return { server: newServer, wallet: result.wallet, funding: result.funding };
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create server");
        throw err;
      }
    },
    [],
  );

  const createChannel = useCallback(
    async (
      serverId: string,
      name: string,
      type: ChannelType,
      description?: string,
    ) => {
      // Voice channels live client-side only — persist in localStorage
      if (type === "voice") {
        const id = uid();
        const newVoiceCh: Channel = { id, name, type: "voice", description: description ?? "", messages: [] };
        setServers((prev) =>
          prev.map((s) => {
            if (s.id !== serverId) return s;
            const updated = { ...s, channels: [...s.channels, newVoiceCh] };
            // Persist all voice channels for this server
            const voiceKey = `bonfire_voice_${serverId}`;
            const voices = updated.channels.filter(c => c.type === "voice");
            try { if (typeof window !== "undefined") localStorage.setItem(voiceKey, JSON.stringify(voices)); } catch { /* ignore */ }
            return updated;
          }),
        );
        setActiveChannelId(id);
        return;
      }
      try {
        const { channel: raw } = await bf.createChannel(serverId, {
          name,
          topic: description,
        });
        const ch = mapChannel(raw);
        setServers((prev) =>
          prev.map((s) =>
            s.id !== serverId ? s : { ...s, channels: [...s.channels, ch] },
          ),
        );
        setActiveChannelId(ch.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create channel");
      }
    },
    [],
  );

  const sendMessage = useCallback(
    async (serverId: string, channelId: string, content: string) => {
      if (!content.trim() || !authUser) return;
      try {
        const { userMessage, replies } = await bf.postMessage(channelId, {
          content: content.trim(),
        });
        const allMessages = [userMessage, ...replies];
        const mapped = allMessages.map((m) =>
          mapMessage(m, agentMapRef.current, userMapRef.current, authUser.id),
        );
        setServers((prev) =>
          prev.map((s) => {
            if (s.id !== serverId) return s;
            return {
              ...s,
              channels: s.channels.map((c) => {
                if (c.id !== channelId) return c;
                return {
                  ...c,
                  messages: mergeMessages(c.messages, mapped),
                };
              }),
            };
          }),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send message");
      }
    },
    [authUser, mergeMessages],
  );

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const updateUser = useCallback((_profile: Partial<UserProfile>) => {
    // User is derived from authUser — no local state to update
  }, []);

  const addAgent = useCallback(
    async (serverId: string, agent: Agent) => {
      try {
        await bf.inviteMember(serverId, {
          principalType: "agent",
          principalId: agent.id,
        });
        // Re-fetch agent list for that server
        const { members: rawMembers } = await bf.listMembers(
          serverId,
          "agent",
        );
        const agentDetails = await Promise.allSettled(
          rawMembers.map((m) => bf.getAgent(m.principalId)),
        );
        const agents: Agent[] = agentDetails
          .filter(
            (r): r is PromiseFulfilledResult<{ agent: BackendAgent }> =>
              r.status === "fulfilled",
          )
          .map((r) => mapAgent(r.value.agent));
        for (const a of agents) agentMapRef.current.set(a.id, a);
        setServers((prev) =>
          prev.map((s) => (s.id !== serverId ? s : { ...s, agents })),
        );
      } catch (err) {
        // Re-throw so callers (e.g. InviteToServerModal) can handle HTTP status codes
        throw err;
      }
    },
    [],
  );

  const updateAgentStatus = useCallback(
    (_serverId: string, _agentId: string, _status: AgentStatus) => {
      // No backend support — no-op
    },
    [],
  );

  const leaveServer = useCallback(
    (serverId: string) => {
      setServers((prev) => {
        const remaining = prev.filter((s) => s.id !== serverId);
        if (remaining.length > 0) {
          setActiveServerId(remaining[0].id);
          const first = remaining[0].channels.find((c) => c.type === "text") ??
            remaining[0].channels[0];
          if (first) setActiveChannelId(first.id);
          else setActiveChannelId("");
        } else {
          setActiveServerId("");
          setActiveChannelId("");
        }
        return remaining;
      });
    },
    [],
  );

  const addAuditEntry = useCallback(
    (_serverId: string, _entry: Omit<AuditEntry, "id" | "timestamp">) => {
      // No backend support — no-op
    },
    [],
  );

  const activeServer = servers.find((s) => s.id === activeServerId);
  const activeChannel = activeServer?.channels.find(
    (c) => c.id === activeChannelId,
  );

  return (
    <AppContext.Provider
      value={{
        user,
        servers,
        activeServerId,
        activeChannelId,
        activeVoiceChannelId,
        setActiveVoiceChannelId: setVoiceChannelId,
        setActiveServer,
        setActiveChannel,
        createServer,
        createChannel,
        sendMessage,
        updateUser,
        addAgent,
        updateAgentStatus,
        leaveServer,
        addAuditEntry,
        activeServer,
        activeChannel,
        loading,
        error,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be inside AppProvider");
  return ctx;
}
