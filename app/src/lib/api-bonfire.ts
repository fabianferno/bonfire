import { api } from './api';
import type {
  BackendUser,
  BackendServer,
  BackendChannel,
  BackendMessage,
  BackendAgent,
  BackendMember,
  BackendServerWallet,
  BackendServerFunding,
} from './types';

export const bf = {
  me: () => api<{ user: BackendUser }>('GET', '/v1/auth/me'),

  listServers: () => api<{ servers: BackendServer[] }>('GET', '/v1/servers'),

  getServer: (sid: string) =>
    api<{ server: BackendServer }>('GET', `/v1/servers/${sid}`),

  createServer: (body: { name: string; slug: string; iconUrl?: string | null }) =>
    api<{ server: BackendServer; wallet: BackendServerWallet; funding: BackendServerFunding }>('POST', '/v1/servers', body),

  getServerWallet: (sid: string) =>
    api<{ wallet: BackendServerWallet; balance: string | null; balanceError: string | null; funding: BackendServerFunding }>(
      'GET', `/v1/servers/${sid}/wallet`
    ),

  getChannels: (sid: string) =>
    api<{ channels: BackendChannel[] }>('GET', `/v1/servers/${sid}/channels`),

  createChannel: (
    sid: string,
    body: { name: string; topic?: string; defaultAgentId?: string },
  ) =>
    api<{ channel: BackendChannel }>('POST', `/v1/servers/${sid}/channels`, body),

  patchChannel: (
    cid: string,
    body: Partial<{
      name: string;
      topic: string | null;
      defaultAgentId: string | null;
      cascadeEnabled: boolean;
    }>,
  ) =>
    api<{ channel: BackendChannel }>('PATCH', `/v1/channels/${cid}`, body),

  listMessages: (cid: string, opts: { before?: string; limit?: number } = {}) => {
    const params = new URLSearchParams();
    if (opts.before) params.set('before', opts.before);
    if (opts.limit) params.set('limit', String(opts.limit));
    const qs = params.toString();
    return api<{ messages: BackendMessage[]; nextCursor: string | null }>(
      'GET',
      `/v1/channels/${cid}/messages${qs ? '?' + qs : ''}`,
    );
  },

  postMessage: (cid: string, body: { content: string; replyToId?: string }) =>
    api<{
      userMessage: BackendMessage;
      replies: BackendMessage[];
      streamIds?: string[];
    }>('POST', `/v1/channels/${cid}/messages`, body),

  listMembers: (sid: string, type?: 'user' | 'agent') => {
    const qs = type ? `?type=${type}` : '';
    return api<{ members: BackendMember[] }>(
      'GET',
      `/v1/servers/${sid}/members${qs}`,
    );
  },

  inviteMember: (
    sid: string,
    body: { principalType: 'user' | 'agent'; principalId: string },
  ) => api<{ member: BackendMember }>('POST', `/v1/servers/${sid}/members`, body),

  listAgents: (opts: { q?: string; tag?: string; limit?: number } = {}) => {
    const sp = new URLSearchParams();
    if (opts.q) sp.set('q', opts.q);
    if (opts.tag) sp.set('tag', opts.tag);
    if (opts.limit) sp.set('limit', String(opts.limit));
    const qs = sp.toString();
    return api<{ agents: BackendAgent[] }>('GET', `/v1/agents${qs ? '?' + qs : ''}`, undefined, { auth: false });
  },

  getAgent: (aidOrSlug: string) =>
    api<{ agent: BackendAgent }>('GET', `/v1/agents/${aidOrSlug}`),

  createAgent: (body: {
    name: string;
    slug: string;
    baseUrl: string;
    description: string;
    soul?: string;
    agents?: string;
    bio?: string;
    avatarUrl?: string | null;
    tags?: string[];
    env?: Record<string, string>;
    llm?: {
      provider?: 'openai-compatible' | 'zerog';
      baseUrl?: string;
      model?: string;
      apiKeyEnv?: string;
      temperature?: number;
      maxTokens?: number;
    };
  }) => api<{ agent: BackendAgent; agentKey: string }>('POST', '/v1/agents', body),

  getUser: (username: string) =>
    api<{ user: BackendUser }>('GET', `/v1/users/${username}`),
};
