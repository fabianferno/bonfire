import type { Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import { collections } from '../db/types.js';
import type { ChannelDoc, MessageDoc, AgentDoc, ServerMemberDoc, ServerDoc } from '../db/types.js';
import { findAgentByIdOrSlug } from './registry.js';
import { findUserById } from '../users/service.js';
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
  // Discord convention: when the user @-mentions specific agents, only those reply.
  // The channel's default agent stays quiet on targeted messages.
  const userMentionedAnyAgent = ctx.userMessage.mentions.some(m => m.type === 'agent');
  if (!userMentionedAnyAgent && ctx.channel.defaultAgentId) {
    ids.add(ctx.channel.defaultAgentId.toHexString());
  }
  for (const m of ctx.userMessage.mentions) {
    if (m.type === 'agent') ids.add(m.id.toHexString());
  }
  if (ids.size === 0) return [];

  // Resolve to marketplace agents globally — no server-membership filter, so any registered
  // agent can be summoned from any channel in any server.
  const agents: AgentDoc[] = [];
  for (const id of ids) {
    const a = await findAgentByIdOrSlug(ctx.db, id);
    if (a) agents.push(a);
  }
  return agents;
}

export interface StreamingHandle { streamId: string; agent: AgentDoc; }

export async function startStreamingInvocation(
  ctx: InvocationContext,
  agents: AgentDoc[],
  envOverride?: Record<string, string>,
): Promise<StreamingHandle[]> {
  const handles: StreamingHandle[] = [];
  const chatId = chatIdForChannel(ctx.channel._id);
  for (const agent of agents) {
    try {
      const { streamId, upstreamUrl } = await openAgentStream({
        baseUrl: agent.baseUrl, chatId, text: ctx.userMessage.content, tenant: agent.slug, envOverride,
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
        tenant: agent.slug,
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
  /** Server doc for the channel's server — used to derive the 0G wallet envOverride for inference. */
  server?: ServerDoc;
}

/**
 * Builds the envOverride map for a server's 0G wallet private key.
 *
 * Returns undefined when no wallet is present so the caller can omit the field entirely,
 * rather than sending an empty object that the agent would still try to interpret.
 */
function envOverrideFromServer(server?: ServerDoc): Record<string, string> | undefined {
  if (!server?.wallet?.privateKey) return undefined;
  return { DEPLOYER_PRIVATE_KEY: server.wallet.privateKey };
}

interface QueuedInvocation {
  parentMessage: MessageDoc;
  agent: AgentDoc;
  hop: number;
}

export async function runCascade(ctx: CascadeContext): Promise<MessageDoc[]> {
  const config: CascadeConfig = { ...DEFAULT_CASCADE, ...(ctx.config ?? {}) };
  // Derive once so all hops within this cascade use the same server wallet.
  const envOverride = envOverrideFromServer(ctx.server);

  // cascadeEnabled === false → direct-only fallback (no follow-up of agent mentions)
  if (ctx.channel.cascadeEnabled === false) {
    const direct = await computeInvocationSet({
      db: ctx.db, channel: ctx.channel, userMessage: ctx.rootMessage,
    });
    return runInvocationLinked({
      db: ctx.db, channel: ctx.channel, parent: ctx.rootMessage, agents: direct,
      hop: 1, rootId: ctx.rootMessage._id, envOverride,
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
      hop: next.hop, rootId: ctx.rootMessage._id, envOverride,
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

export function channelContextLine(args: {
  channel: ChannelDoc;
  target: AgentDoc;
  peerSlugs: string[];
  speakerLabel: string;
}): string {
  const peers = args.peerSlugs.filter(s => s !== args.target.slug).map(s => '@' + s).join(', ');
  const base = `[${args.speakerLabel} → @${args.target.slug} in #${args.channel.name}`;
  return peers ? `${base} | peers: ${peers}]` : `${base}]`;
}

export interface PrepareInvocationInput {
  parent: MessageDoc;
  target: AgentDoc;
  channel: ChannelDoc;
  peerSlugs: string[];
  speakerLabel: string;
  /** True when the most recent message in the chain came from a human user (not another agent). */
  speakerIsHuman: boolean;
}

export function prepareInvocationText(input: PrepareInvocationInput): string {
  const line = channelContextLine(input);
  const peers = input.peerSlugs.filter(s => s !== input.target.slug).map(s => '@' + s);

  // Only include the FORWARDING RULE when a human is asking. For agent-to-agent turns we
  // include an explicit DO-NOT-FORWARD note (because prior human turns' protocol may be cached
  // in the agent's memory and the model would otherwise keep auto-forwarding).
  let protocol = '';
  if (peers.length > 0 && input.speakerIsHuman) {
    protocol = `\n[CHANNEL PROTOCOL — read first]
You are @${input.target.slug} in channel #${input.channel.name}, replying to ${input.speakerLabel} (a human). Other agents available in this channel: ${peers.join(', ')}.

FORWARDING RULE: If the human's message asks you to tell, ask, call, share with, forward to, or otherwise involve one of the listed peers (named with or without the "@", e.g. "tell critic" or "@critic"), you MUST:
  1. First give your full, substantive answer to the human's request — never reply with only an @-mention.
  2. Then, on a NEW LINE at the END of your reply, write the peer's literal @-handle (e.g., "@critic") and nothing else on that line.
This applies even if your personality says "say nothing else" — invitations are an exception, but your answer must still come first. Only invite peers the human actually named. Do not invite peers unless explicitly asked.
[END PROTOCOL]\n`;
  } else if (peers.length > 0) {
    // Agent-to-agent turn: explicitly suppress forwarding behavior.
    protocol = `\n[AGENT-TO-AGENT — read first]
You are @${input.target.slug} responding to ${input.speakerLabel} (another agent in this channel, not a human).

DO NOT FORWARD: Even if an earlier "FORWARDING RULE" appeared in your memory of this channel, that rule does NOT apply right now. Just respond directly to ${input.speakerLabel}'s message. Do NOT end your reply with any "@<peer>" handle — the cascade should stop here unless this agent explicitly asks you a question you can't answer.
[END]\n`;
  }
  return `${line}${protocol}\n${input.parent.content}`;
}

async function peerSlugsForChannel(db: Db, channel: ChannelDoc): Promise<string[]> {
  const members = await db.collection<ServerMemberDoc>(collections.serverMembers)
    .find({ serverId: channel.serverId, principalType: 'agent' }).toArray();
  const ids = members.map(m => m.principalId);
  if (ids.length === 0) return [];
  const agents = await db.collection<AgentDoc>(collections.agents)
    .find({ _id: { $in: ids } }, { projection: { slug: 1 } }).toArray();
  return agents.map(a => a.slug);
}

async function speakerLabelFor(db: Db, parent: MessageDoc): Promise<string> {
  if (parent.authorType === 'agent') {
    const a = await findAgentByIdOrSlug(db, parent.authorId.toHexString());
    return a ? '@' + a.slug : '@agent';
  }
  const u = await findUserById(db, parent.authorId);
  return u ? '@' + u.username : '@user';
}

async function runInvocationLinked(args: {
  db: Db;
  channel: ChannelDoc;
  parent: MessageDoc;
  agents: AgentDoc[];
  hop: number;
  rootId: ObjectId;
  /** Per-request env overrides forwarded to the agent (e.g. DEPLOYER_PRIVATE_KEY for 0G inference). */
  envOverride?: Record<string, string>;
}): Promise<MessageDoc[]> {
  const out: MessageDoc[] = [];
  const chatId = chatIdForChannel(args.channel._id);
  const peerSlugs = await peerSlugsForChannel(args.db, args.channel);
  const speakerLabel = await speakerLabelFor(args.db, args.parent);
  const speakerIsHuman = args.parent.authorType === 'user';
  for (const agent of args.agents) {
    try {
      const text = prepareInvocationText({
        parent: args.parent,
        target: agent,
        channel: args.channel,
        peerSlugs,
        speakerLabel,
        speakerIsHuman,
      });
      const replyText = await invokeAgent({
        baseUrl: agent.baseUrl,
        chatId,
        text,
        tenant: agent.slug,
        envOverride: args.envOverride,
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
  _channel: ChannelDoc,
  mentions: { type: 'user' | 'agent'; id: ObjectId }[],
  visited: Set<string>,
): Promise<AgentDoc[]> {
  // No server-membership filter — agents are global. Cascades follow @-mentions to any
  // marketplace agent regardless of which server originated the chain.
  const ids = mentions
    .filter(m => m.type === 'agent')
    .map(m => m.id.toHexString())
    .filter(id => !visited.has(id));
  if (ids.length === 0) return [];
  const out: AgentDoc[] = [];
  for (const id of ids) {
    const a = await findAgentByIdOrSlug(db, id);
    if (a) out.push(a);
  }
  return out;
}
