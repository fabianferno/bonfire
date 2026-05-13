import type { Db, ObjectId } from 'mongodb';
import { ObjectId as OID } from 'mongodb';
import type { ChannelDoc } from '../db/types.js';
import { collections } from '../db/types.js';

export class ChannelNameTakenError extends Error { code = 'channel_name_taken' as const; }

export interface CreateChannelInput {
  serverId: ObjectId;
  name: string;
  topic?: string | null;
  defaultAgentId?: ObjectId | null;
  position?: number;
}

export async function createChannel(db: Db, input: CreateChannelInput): Promise<ChannelDoc> {
  const doc: ChannelDoc = {
    _id: new OID(),
    serverId: input.serverId,
    name: input.name.toLowerCase(),
    topic: input.topic ?? null,
    type: 'text',
    defaultAgentId: input.defaultAgentId ?? null,
    position: input.position ?? Date.now(),
    createdAt: new Date(),
  };
  try {
    await db.collection<ChannelDoc>(collections.channels).insertOne(doc);
  } catch (e: any) {
    if (e?.code === 11000) throw new ChannelNameTakenError();
    throw e;
  }
  return doc;
}

export async function findChannelById(db: Db, channelId: ObjectId): Promise<ChannelDoc | null> {
  return await db.collection<ChannelDoc>(collections.channels).findOne({ _id: channelId });
}

export function publicChannel(ch: ChannelDoc) {
  return {
    id: ch._id.toHexString(),
    serverId: ch.serverId.toHexString(),
    name: ch.name,
    topic: ch.topic,
    type: ch.type,
    defaultAgentId: ch.defaultAgentId?.toHexString() ?? null,
    position: ch.position,
    createdAt: ch.createdAt.toISOString(),
  };
}
