import type { ObjectId } from 'mongodb';

export interface UserDoc {
  _id: ObjectId;
  privyDid: string;               // Privy user DID, e.g. "did:privy:xyz...", unique
  walletAddress: string | null;   // embedded wallet address from Privy, 0x...; null until provisioned
  email: string | null;           // optional — some Privy logins are social-only
  passwordHash: string | null;    // deprecated; only legacy users
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  isService: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentDoc {
  _id: ObjectId;
  name: string;
  slug: string;
  avatarUrl: string | null;
  description: string;
  bio: string | null;
  tags: string[];
  baseUrl: string;
  visibility: 'public' | 'unlisted';
  agentKeyHash?: string | null;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
  // INFT fields — optional during migration (legacy agents won't have these)
  tokenId?: string;               // bigint serialized as string (Mongo can't hold full uint256)
  contractAddress?: string;       // 0x...
  ownerWallet?: string;           // 0x... (denormalized from chain; refreshed on indexer events)
  mode?: 'public' | 'permissioned';
  manifestUri?: string;
  bundleUri?: string;
  sealedDEKBaseUri?: string;
  bundleHash?: string;            // hex string
}

/**
 * A single bot that has been invited into an active voice session.
 * Each invite spawns its own Pipecat subprocess.
 */
export interface VoiceBotEntry {
  agentDocId: ObjectId;
  agentSlug: string;
  pid: number;
  invitedByUserId: ObjectId;
  invitedAt: Date;
}

// TTL-cleaned up via the expiresAt Mongo TTL index.
export interface MintReservationDoc {
  _id: ObjectId;
  reservedId: string;             // uuid, returned to client and echoed on /mint/confirm
  userId: ObjectId;               // FK -> users
  slug: string;                   // claimed slug (transient lock)
  manifestUri: string;
  bundleUri: string;
  sealedDEKBaseUri: string;
  bundleHash: string;
  mode: 'public' | 'permissioned';
  status: 'uploaded' | 'minted' | 'expired';
  createdAt: Date;
  expiresAt: Date;                // TTL anchor — Mongo TTL index drops expired rows
}

export interface ServerWalletDoc {
  address: string;
  privateKey: string;
  network: 'og-testnet';
  createdAt: Date;
}

export interface ServerDoc {
  _id: ObjectId;
  name: string;
  slug: string;
  iconUrl: string | null;
  ownerId: ObjectId;
  wallet?: ServerWalletDoc;
  createdAt: Date;
  updatedAt: Date;
}

export type PrincipalType = 'user' | 'agent';
export type MemberRole = 'owner' | 'admin' | 'member';

export interface ServerMemberDoc {
  _id: ObjectId;
  serverId: ObjectId;
  principalType: PrincipalType;
  principalId: ObjectId;
  role: MemberRole;
  alias: string | null;
  joinedAt: Date;
}

export interface ChannelDoc {
  _id: ObjectId;
  serverId: ObjectId;
  name: string;
  topic: string | null;
  type: 'text' | 'voice';
  defaultAgentId: ObjectId | null;
  position: number;
  cascadeEnabled?: boolean;
  createdAt: Date;
}

export interface VoiceSessionDoc {
  _id: ObjectId;
  channelId: ObjectId;
  serverId: ObjectId;
  dailyRoomName: string;       // unique room name
  dailyRoomUrl: string;        // https://<domain>.daily.co/<roomName>
  participantIds: ObjectId[];  // active user IDs (Mongo refs)
  status: 'starting' | 'active' | 'ended';
  startedAt: Date;
  expiresAt: Date;             // startedAt + 10 minutes
  endedAt: Date | null;
  // DEPRECATED — kept for backwards compat with old rows; do not write on new sessions
  pythonPid?: number | null;
  agentSlug?: string | null;
  agentSoul?: string;
  // NEW — each invited bot has its own entry; empty by default
  bots: VoiceBotEntry[];
}

export interface MessageMention { type: PrincipalType; id: ObjectId; }

export interface MessageDoc {
  _id: ObjectId;
  channelId: ObjectId;
  serverId: ObjectId;
  authorType: PrincipalType;
  authorId: ObjectId;
  content: string;
  mentions: MessageMention[];
  replyToId: ObjectId | null;
  parentMessageId?: ObjectId | null;
  cascadeRootId?: ObjectId;
  cascadeHop?: number;
  createdAt: Date;
  editedAt: Date | null;
}

export const collections = {
  users: 'users',
  agents: 'agents',
  servers: 'servers',
  serverMembers: 'serverMembers',
  channels: 'channels',
  messages: 'messages',
  mintReservations: 'mintReservations',
  voiceSessions: 'voiceSessions',
} as const;
