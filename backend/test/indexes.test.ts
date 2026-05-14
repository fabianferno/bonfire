import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startTestDb, stopTestDb, cleanCollections, type TestDb } from './helpers/db.js';
import { createIndexes } from '../src/db/indexes.js';

describe('createIndexes', () => {
  let tdb: TestDb;
  beforeAll(async () => { tdb = await startTestDb(); });
  afterAll(async () => { await stopTestDb(); });
  beforeEach(async () => { await cleanCollections(tdb.db); });

  it('creates expected indexes', async () => {
    await createIndexes(tdb.db);
    const userIdx = await tdb.db.collection('users').indexes();
    const usernames = userIdx.map(i => i.name);
    expect(usernames).toContain('email_1');
    expect(usernames).toContain('username_1');

    const msgIdx = await tdb.db.collection('messages').indexes();
    expect(msgIdx.map(i => i.name)).toContain('channelId_1_createdAt_-1');
  });

  it('is idempotent (safe to run twice)', async () => {
    await createIndexes(tdb.db);
    await expect(createIndexes(tdb.db)).resolves.not.toThrow();
  });

  it('creates the cascade tree index on messages', async () => {
    await createIndexes(tdb.db);
    const msgIdx = await tdb.db.collection('messages').indexes();
    expect(msgIdx.map(i => i.name)).toContain('cascadeRootId_1_createdAt_1');
  });

  it('enforces unique username case-insensitively', async () => {
    await createIndexes(tdb.db);
    const users = tdb.db.collection('users');
    await users.insertOne({ username: 'alice', email: 'a@x.com' } as any);
    await expect(
      users.insertOne({ username: 'ALICE', email: 'b@x.com' } as any)
    ).rejects.toThrow();
  });
});
