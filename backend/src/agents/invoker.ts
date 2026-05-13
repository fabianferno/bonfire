import type { Db, ObjectId } from 'mongodb';
import { collections } from '../db/types.js';
import type { ChannelDoc, MessageDoc, AgentDoc, ServerMemberDoc } from '../db/types.js';
import { findAgentByIdOrSlug } from './registry.js';
import { invokeAgent, openAgentStream } from './client.js';
import { insertMessage } from '../messages/service.js';
import { log } from '../util/logger.js';
import { registerStream } from '../messages/stream-registry.js';

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
