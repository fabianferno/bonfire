import type { ObjectId } from 'mongodb';

export interface UserDoc {
  _id: ObjectId;
  email: string;
  passwordHash: string;
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
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServerDoc {
  _id: ObjectId;
  name: string;
  slug: string;
  iconUrl: string | null;
  ownerId: ObjectId;
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
  type: 'text';
  defaultAgentId: ObjectId | null;
  position: number;
  createdAt: Date;
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
} as const;
