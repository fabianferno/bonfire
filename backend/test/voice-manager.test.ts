/**
 * Unit tests for VoiceManager.
 *
 * Daily client and spawnBot are replaced with test doubles — no real HTTP calls
 * or subprocesses. Mongo is in-memory via mongodb-memory-server.
 *
 * Scenarios:
 *  - First join creates a room, spawns bot, returns user token
 *  - Second join reuses the session (no second spawn)
 *  - Leave decrements participant count
 *  - Last participant leaving kills bot + deletes room + marks ended
 *  - sweep() tears down expired sessions
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { ObjectId } from 'mongodb';
import { startTestDb, stopTestDb, cleanCollections, type TestDb } from './helpers/db.js';
import { createIndexes } from '../src/db/indexes.js';
import { VoiceManager } from '../src/voice/manager.js';
import type { DailyClient, DailyRoom } from '../src/voice/daily-client.js';
import type { ChannelDoc, UserDoc, VoiceSessionDoc } from '../src/db/types.js';
import { collections } from '../src/db/types.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeDailyClient(): DailyClient & {
  rooms: Map<string, DailyRoom>;
  deletedRooms: string[];
  tokens: string[];
} {
  const rooms = new Map<string, DailyRoom>();
  const deletedRooms: string[] = [];
  const tokens: string[] = [];
  let roomSeq = 0;
  let tokenSeq = 0;

  return {
    rooms,
    deletedRooms,
    tokens,
    async createRoom({ expSeconds }) {
      const name = `room-${++roomSeq}`;
      const url = `https://test.daily.co/${name}`;
      const r: DailyRoom = { name, url, expiresAtUnix: Math.floor(Date.now() / 1000) + expSeconds };
      rooms.set(name, r);
      return r;
    },
    async deleteRoom(name) {
      deletedRooms.push(name);
      rooms.delete(name);
    },
    async mintMeetingToken({ roomName, userName }) {
      const tok = `tok-${++tokenSeq}-${roomName}-${userName}`;
      tokens.push(tok);
      return tok;
    },
  };
}

function makeSpawnBot(): {
  spawner: (env: Record<string, string>) => { pid: number; kill: () => void };
  spawnCount: () => number;
  killCount: () => number;
} {
  let spawnCount = 0;
  let killCount = 0;
  let pidSeq = 1000;

  const spawner = (_env: Record<string, string>) => {
    spawnCount++;
    const pid = ++pidSeq;
    return {
      pid,
      kill: () => { killCount++; },
    };
  };

  return {
    spawner,
    spawnCount: () => spawnCount,
    killCount: () => killCount,
  };
}

function makeChannel(db: any, overrides: Partial<ChannelDoc> = {}): ChannelDoc {
  return {
    _id: new ObjectId(),
    serverId: new ObjectId(),
    name: 'voice-general',
    topic: null,
    type: 'voice',
    defaultAgentId: null,
    position: 1,
    createdAt: new Date(),
    ...overrides,
  } as ChannelDoc;
}

function makeUser(overrides: Partial<UserDoc> = {}): UserDoc {
  return {
    _id: new ObjectId(),
    privyDid: `did:privy:test-${Math.random().toString(36).slice(2)}`,
    walletAddress: null,
    email: null,
    passwordHash: null,
    username: `user-${Math.random().toString(36).slice(2, 8)}`,
    displayName: 'Test User',
    avatarUrl: null,
    bio: null,
    isService: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as UserDoc;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('VoiceManager', () => {
  let tdb: TestDb;
  let daily: ReturnType<typeof makeDailyClient>;
  let spawn: ReturnType<typeof makeSpawnBot>;
  let manager: VoiceManager;

  beforeAll(async () => {
    tdb = await startTestDb();
  });
  afterAll(async () => { await stopTestDb(); });

  beforeEach(async () => {
    await cleanCollections(tdb.db);
    await createIndexes(tdb.db);
    daily = makeDailyClient();
    spawn = makeSpawnBot();
    manager = new VoiceManager({
      db: tdb.db,
      daily,
      spawnBot: spawn.spawner,
    });
  });

  it('first join creates a Daily room and spawns the bot exactly once', async () => {
    const channel = makeChannel(tdb.db);
    const user = makeUser();

    const { session, userToken } = await manager.joinChannel({ channel, user });

    expect(session.status).toBe('active');
    expect(session.channelId.equals(channel._id)).toBe(true);
    expect(session.participantIds).toHaveLength(1);
    expect(session.pythonPid).toBeGreaterThan(0);
    expect(userToken).toBeTruthy();
    expect(spawn.spawnCount()).toBe(1);
    expect(daily.rooms.size).toBe(1);
  });

  it('second join reuses the session without spawning a new bot', async () => {
    const channel = makeChannel(tdb.db);
    const user1 = makeUser();
    const user2 = makeUser();

    const r1 = await manager.joinChannel({ channel, user: user1 });
    const r2 = await manager.joinChannel({ channel, user: user2 });

    expect(spawn.spawnCount()).toBe(1);   // bot spawned only once
    // Both joins return the same session _id (reused room)
    expect(r1.session._id.equals(r2.session._id)).toBe(true);
    // Both users should be in the session
    const stored = await tdb.db
      .collection<VoiceSessionDoc>(collections.voiceSessions)
      .findOne({ _id: r1.session._id });
    expect(stored?.participantIds).toHaveLength(2);
  });

  it('leave decrements participant count', async () => {
    const channel = makeChannel(tdb.db);
    const user1 = makeUser();
    const user2 = makeUser();

    const { session } = await manager.joinChannel({ channel, user: user1 });
    await manager.joinChannel({ channel, user: user2 });

    const { ended } = await manager.leaveChannel({ sessionId: session._id, user: user1 });
    expect(ended).toBe(false);

    const stored = await tdb.db
      .collection<VoiceSessionDoc>(collections.voiceSessions)
      .findOne({ _id: session._id });
    expect(stored?.participantIds).toHaveLength(1);
    expect(spawn.killCount()).toBe(0);
  });

  it('last participant leaving kills bot, deletes room, marks session ended', async () => {
    const channel = makeChannel(tdb.db);
    const user = makeUser();

    const { session } = await manager.joinChannel({ channel, user });
    const roomName = session.dailyRoomName;

    const { ended } = await manager.leaveChannel({ sessionId: session._id, user });
    expect(ended).toBe(true);

    const stored = await tdb.db
      .collection<VoiceSessionDoc>(collections.voiceSessions)
      .findOne({ _id: session._id });
    expect(stored?.status).toBe('ended');
    expect(stored?.endedAt).toBeInstanceOf(Date);
    expect(daily.deletedRooms).toContain(roomName);
    expect(spawn.killCount()).toBe(1);
  });

  it('sweep() tears down expired sessions and returns count', async () => {
    const channel = makeChannel(tdb.db);
    const user = makeUser();

    const { session } = await manager.joinChannel({ channel, user });
    const roomName = session.dailyRoomName;

    // Backdate expiresAt to the past
    await tdb.db
      .collection<VoiceSessionDoc>(collections.voiceSessions)
      .updateOne(
        { _id: session._id },
        { $set: { expiresAt: new Date(Date.now() - 1000) } },
      );

    const count = await manager.sweep();
    expect(count).toBe(1);

    const stored = await tdb.db
      .collection<VoiceSessionDoc>(collections.voiceSessions)
      .findOne({ _id: session._id });
    expect(stored?.status).toBe('ended');
    expect(daily.deletedRooms).toContain(roomName);
    expect(spawn.killCount()).toBe(1);
  });

  it('sweep() ignores already-ended sessions', async () => {
    const channel = makeChannel(tdb.db);
    const user = makeUser();

    const { session } = await manager.joinChannel({ channel, user });

    // Mark ended manually
    await tdb.db
      .collection<VoiceSessionDoc>(collections.voiceSessions)
      .updateOne({ _id: session._id }, {
        $set: {
          status: 'ended',
          endedAt: new Date(),
          expiresAt: new Date(Date.now() - 1000),
        },
      });

    const count = await manager.sweep();
    expect(count).toBe(0);
  });

  it('spawn failure rolls back: deletes room and marks session ended', async () => {
    const channel = makeChannel(tdb.db);
    const user = makeUser();

    const failingSpawn = () => { throw new Error('python not found'); };
    const badManager = new VoiceManager({ db: tdb.db, daily, spawnBot: failingSpawn });

    await expect(badManager.joinChannel({ channel, user })).rejects.toThrow('bot spawn failed');

    // Room should have been deleted
    expect(daily.deletedRooms).toHaveLength(1);

    // Session should be marked ended
    const sessions = await tdb.db
      .collection<VoiceSessionDoc>(collections.voiceSessions)
      .find({ channelId: channel._id })
      .toArray();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].status).toBe('ended');
  });

  it('status() returns null when no active session', async () => {
    const channelId = new ObjectId();
    const result = await manager.status(channelId);
    expect(result).toBeNull();
  });

  it('status() returns the active session for a channel', async () => {
    const channel = makeChannel(tdb.db);
    const user = makeUser();
    await manager.joinChannel({ channel, user });

    const result = await manager.status(channel._id);
    expect(result).not.toBeNull();
    expect(result!.channelId.equals(channel._id)).toBe(true);
    expect(result!.status).toBe('active');
  });
});
