export interface BackendUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  email?: string;
  isService?: boolean;
}

export interface BackendServer {
  id: string;
  name: string;
  slug: string;
  iconUrl: string | null;
  ownerId: string;
  createdAt: string;
}

export interface BackendChannel {
  id: string;
  serverId: string;
  name: string;
  topic: string | null;
  type: 'text';
  defaultAgentId: string | null;
  position: number;
  cascadeEnabled: boolean;
  createdAt: string;
}

export interface BackendMessage {
  id: string;
  channelId: string;
  serverId: string;
  authorType: 'user' | 'agent';
  authorId: string;
  content: string;
  mentions: Array<{ type: 'user' | 'agent'; id: string }>;
  replyToId: string | null;
  parentMessageId: string | null;
  cascadeRootId: string | null;
  cascadeHop: number | null;
  createdAt: string;
  editedAt: string | null;
}

export interface BackendAgent {
  id: string;
  name: string;
  slug: string;
  avatarUrl: string | null;
  description: string;
  bio: string | null;
  tags: string[];
  baseUrl: string;
  visibility: 'public' | 'unlisted';
  createdBy: string;
  createdAt: string;
}

export interface BackendMember {
  id: string;
  serverId: string;
  principalType: 'user' | 'agent';
  principalId: string;
  role: 'owner' | 'admin' | 'member';
  alias: string | null;
  joinedAt: string;
}
