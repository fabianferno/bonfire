import type { Db, ObjectId } from 'mongodb';
import type { MessageMention, ServerMemberDoc, UserDoc, AgentDoc } from '../db/types.js';
import { collections } from '../db/types.js';

const MENTION_RE = /@([a-z0-9_-]{3,32})/gi;
const ci = { locale: 'en', strength: 2 } as const;

export function extractHandles(content: string): string[] {
  const out = new Set<string>();
  for (const m of content.matchAll(MENTION_RE)) out.add(m[1].toLowerCase());
  return [...out];
}

export async function resolveMentions(db: Db, serverId: ObjectId, content: string): Promise<MessageMention[]> {
  const handles = extractHandles(content);
  if (handles.length === 0) return [];

  const memberRows = await db.collection<ServerMemberDoc>(collections.serverMembers)
    .find({ serverId }).toArray();
  const userIds = memberRows.filter(m => m.principalType === 'user').map(m => m.principalId);
  const agentIds = memberRows.filter(m => m.principalType === 'agent').map(m => m.principalId);

  const [users, agents] = await Promise.all([
    userIds.length
      ? db.collection<UserDoc>(collections.users).find(
          { _id: { $in: userIds }, username: { $in: handles } },
          { collation: ci }
        ).toArray()
      : Promise.resolve([] as UserDoc[]),
    agentIds.length
      ? db.collection<AgentDoc>(collections.agents).find(
          { _id: { $in: agentIds }, slug: { $in: handles } },
          { collation: ci }
        ).toArray()
      : Promise.resolve([] as AgentDoc[]),
  ]);

  const out: MessageMention[] = [];
  const seen = new Set<string>();
  for (const u of users) {
    const k = `user:${u._id.toHexString()}`;
    if (seen.has(k)) continue; seen.add(k);
    out.push({ type: 'user', id: u._id });
  }
  for (const a of agents) {
    const k = `agent:${a._id.toHexString()}`;
    if (seen.has(k)) continue; seen.add(k);
    out.push({ type: 'agent', id: a._id });
  }
  return out;
}
