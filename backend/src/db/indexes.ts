import type { Db } from 'mongodb';
import { collections } from './types.js';

export async function createIndexes(db: Db): Promise<void> {
  const ci = { locale: 'en', strength: 2 } as const;

  await db.collection(collections.users).createIndexes([
    { key: { email: 1 }, name: 'email_1', unique: true, collation: ci },
    { key: { username: 1 }, name: 'username_1', unique: true, collation: ci },
  ]);

  await db.collection(collections.agents).createIndexes([
    { key: { slug: 1 }, name: 'slug_1', unique: true, collation: ci },
    { key: { visibility: 1, tags: 1 }, name: 'visibility_1_tags_1' },
  ]);

  await db.collection(collections.servers).createIndexes([
    { key: { slug: 1 }, name: 'slug_1', unique: true, collation: ci },
    { key: { ownerId: 1 }, name: 'ownerId_1' },
  ]);

  await db.collection(collections.serverMembers).createIndexes([
    { key: { serverId: 1, principalType: 1, principalId: 1 }, name: 'serverId_1_principalType_1_principalId_1', unique: true },
    { key: { principalId: 1, principalType: 1 }, name: 'principalId_1_principalType_1' },
  ]);

  await db.collection(collections.channels).createIndexes([
    { key: { serverId: 1, name: 1 }, name: 'serverId_1_name_1', unique: true },
    { key: { serverId: 1, position: 1 }, name: 'serverId_1_position_1' },
  ]);

  await db.collection(collections.messages).createIndexes([
    { key: { channelId: 1, createdAt: -1 }, name: 'channelId_1_createdAt_-1' },
    { key: { serverId: 1, createdAt: -1 }, name: 'serverId_1_createdAt_-1' },
    { key: { cascadeRootId: 1, createdAt: 1 }, name: 'cascadeRootId_1_createdAt_1' },
  ]);
}
