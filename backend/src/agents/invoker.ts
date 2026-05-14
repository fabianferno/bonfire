import type { Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import { collections } from '../db/types.js';
import type { ChannelDoc, MessageDoc, AgentDoc, ServerMemberDoc } from '../db/types.js';
import { findAgentByIdOrSlug } from './registry.js';
import { invokeAgent, openAgentStream } from './client.js';
import { insertMessage } from '../messages/service.js';
import { log } from '../util/logger.js';
import { registerStream } from '../messages/stream-registry.js';
import { resolveMentions } from '../messages/mentions.js';

export function chatIdForChannel(channelId: ObjectId): string {
  return `bonfire:channel:${channelId.toHexString()}`;
}

export interface InvocationContext {
  db: Db;
  channel: ChannelDoc;
  userMessage: MessageDoc;
}

export async function computeInvocationSet(ctx: InvocationContext): Promise<AgentDoc[]> {
  const ids = new Set<string>();
  if (ctx.channel.defaultAgentId) ids.add(ctx.channel.defaultAgentId.toHexString());
  for (const m of ctx.userMessage.mentions) {
    if (m.type === 'agent') ids.add(m.id.toHexString());
  }
  if (ids.size === 0) return [];

  const idList = [...ids];
  const members = await ctx.db.collection<ServerMemberDoc>(collections.serverMembers)
    .find({ serverId: ctx.channel.serverId, principalType: 'agent' })
    .toArray();
  const memberIds = new Set(members.map(m => m.principalId.toHexString()));
  const allowed = idList.filter(id => memberIds.has(id));

  const agents: AgentDoc[] = [];
  for (const id of allowed) {
    const a = await findAgentByIdOrSlug(ctx.db, id);
    if (a) agents.push(a);
  }
  return agents;
}

export interface StreamingHandle { streamId: string; agent: AgentDoc; }

export async function startStreamingInvocation(ctx: InvocationContext, agents: AgentDoc[]): Promise<StreamingHandle[]> {
  const handles: StreamingHandle[] = [];
  const chatId = chatIdForChannel(ctx.channel._id);
  for (const agent of agents) {
    try {
      const { streamId, upstreamUrl } = await openAgentStream({
        baseUrl: agent.baseUrl, chatId, text: ctx.userMessage.content,
      });
      registerStream({
        streamId,
        channel: ctx.channel,
        agent,
        userMessage: ctx.userMessage,
        upstreamUrl,
        createdAt: Date.now(),
        onClose: async (finalText) => {
          await insertMessage(ctx.db, {
            channelId: ctx.channel._id,
            serverId: ctx.channel.serverId,
            authorType: 'agent',
            authorId: agent._id,
            content: finalText,
            mentions: [],
          });
        },
      });
      handles.push({ streamId, agent });
    } catch (e) {
      log.warn({ agent: agent.slug, err: e }, 'open stream failed');
    }
  }
  return handles;
}

export async function runInvocation(ctx: InvocationContext, agents: AgentDoc[]): Promise<MessageDoc[]> {
  const out: MessageDoc[] = [];
  const chatId = chatIdForChannel(ctx.channel._id);
  for (const agent of agents) {
    try {
      const replyText = await invokeAgent({
        baseUrl: agent.baseUrl,
        chatId,
        text: ctx.userMessage.content,
      });
      const persisted = await insertMessage(ctx.db, {
        channelId: ctx.channel._id,
        serverId: ctx.channel.serverId,
        authorType: 'agent',
        authorId: agent._id,
        content: replyText,
        mentions: [],
      });
      out.push(persisted);
    } catch (e) {
      log.warn({ agent: agent.slug, err: e }, 'agent invocation failed');
      const failureMsg = await insertMessage(ctx.db, {
        channelId: ctx.channel._id,
        serverId: ctx.channel.serverId,
        authorType: 'agent',
        authorId: agent._id,
        content: '_(agent unreachable)_',
        mentions: [],
      });
      out.push(failureMsg);
    }
  }
  return out;
}

export interface CascadeConfig {
  maxHops: number;
  maxInvocationsPerRoot: number;
}

export const DEFAULT_CASCADE: CascadeConfig = { maxHops: 5, maxInvocationsPerRoot: 20 };

export interface CascadeContext {
  db: Db;
  channel: ChannelDoc;
  rootMessage: MessageDoc;
  config?: Partial<CascadeConfig>;
}

interface QueuedInvocation {
  parentMessage: MessageDoc;
  agent: AgentDoc;
  hop: number;
}

export async function runCascade(ctx: CascadeContext): Promise<MessageDoc[]> {
  const config: CascadeConfig = { ...DEFAULT_CASCADE, ...(ctx.config ?? {}) };

  // cascadeEnabled === false → direct-only fallback (no follow-up of agent mentions)
  if (ctx.channel.cascadeEnabled === false) {
    const direct = await computeInvocationSet({
      db: ctx.db, channel: ctx.channel, userMessage: ctx.rootMessage,
    });
    return runInvocationLinked({
      db: ctx.db, channel: ctx.channel, parent: ctx.rootMessage, agents: direct,
      hop: 1, rootId: ctx.rootMessage._id,
    });
  }

  const out: MessageDoc[] = [];
  const visited = new Set<string>();
  let totalInvocations = 0;

  const initialAgents = await computeInvocationSet({
    db: ctx.db, channel: ctx.channel, userMessage: ctx.rootMessage,
  });

  const queue: QueuedInvocation[] = initialAgents.map(agent => ({
    parentMessage: ctx.rootMessage,
    agent,
    hop: 1,
  }));

  while (queue.length > 0) {
    if (totalInvocations >= config.maxInvocationsPerRoot) break;
    const next = queue.shift()!;
    const agentIdHex = next.agent._id.toHexString();
    if (visited.has(agentIdHex)) continue;
    if (next.hop > config.maxHops) continue;
    visited.add(agentIdHex);

    const replies = await runInvocationLinked({
      db: ctx.db, channel: ctx.channel, parent: next.parentMessage, agents: [next.agent],
      hop: next.hop, rootId: ctx.rootMessage._id,
    });
    totalInvocations++;
    out.push(...replies);

    // Follow @mentions in the just-persisted reply, unless this hop is the last allowed.
    if (next.hop >= config.maxHops) continue;
    for (const reply of replies) {
      const newMentions = await resolveMentions(ctx.db, ctx.channel.serverId, reply.content);
      const followups = await mentionsToAgents(ctx.db, ctx.channel, newMentions, visited);
      for (const a of followups) {
        queue.push({ parentMessage: reply, agent: a, hop: next.hop + 1 });
      }
    }
  }

  return out;
}

async function runInvocationLinked(args: {
  db: Db;
  channel: ChannelDoc;
  parent: MessageDoc;
  agents: AgentDoc[];
  hop: number;
  rootId: ObjectId;
}): Promise<MessageDoc[]> {
  const out: MessageDoc[] = [];
  const chatId = chatIdForChannel(args.channel._id);
  for (const agent of args.agents) {
    try {
      const replyText = await invokeAgent({
        baseUrl: agent.baseUrl,
        chatId,
        text: args.parent.content,
      });
      const persisted = await insertMessage(args.db, {
        channelId: args.channel._id,
        serverId: args.channel.serverId,
        authorType: 'agent',
        authorId: agent._id,
        content: replyText,
        mentions: [],
      });
      // Backfill cascade metadata. insertMessage doesn't accept these fields yet.
      await args.db.collection(collections.messages).updateOne(
        { _id: persisted._id },
        { $set: { parentMessageId: args.parent._id, cascadeRootId: args.rootId, cascadeHop: args.hop } }
      );
      const updated = await args.db.collection<MessageDoc>(collections.messages).findOne({ _id: persisted._id });
      if (updated) out.push(updated);
    } catch (e) {
      log.warn({ agent: agent.slug, err: e }, 'agent invocation failed');
      const failureMsg = await insertMessage(args.db, {
        channelId: args.channel._id,
        serverId: args.channel.serverId,
        authorType: 'agent',
        authorId: agent._id,
        content: '_(agent unreachable)_',
        mentions: [],
      });
      await args.db.collection(collections.messages).updateOne(
        { _id: failureMsg._id },
        { $set: { parentMessageId: args.parent._id, cascadeRootId: args.rootId, cascadeHop: args.hop } }
      );
      const updated = await args.db.collection<MessageDoc>(collections.messages).findOne({ _id: failureMsg._id });
      if (updated) out.push(updated);
    }
  }
  return out;
}

async function mentionsToAgents(
  db: Db,
  channel: ChannelDoc,
  mentions: { type: 'user' | 'agent'; id: ObjectId }[],
  visited: Set<string>,
): Promise<AgentDoc[]> {
  const ids = mentions
    .filter(m => m.type === 'agent')
    .map(m => m.id.toHexString())
    .filter(id => !visited.has(id));
  if (ids.length === 0) return [];
  const members = await db.collection<ServerMemberDoc>(collections.serverMembers)
    .find({ serverId: channel.serverId, principalType: 'agent' }).toArray();
  const memberIds = new Set(members.map(m => m.principalId.toHexString()));
  const allowed = ids.filter(id => memberIds.has(id));
  const out: AgentDoc[] = [];
  for (const id of allowed) {
    const a = await findAgentByIdOrSlug(db, id);
    if (a) out.push(a);
  }
  return out;
}
