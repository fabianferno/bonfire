/**
 * Integration tests for voice HTTP routes.
 *
 * Uses an in-memory Mongo + fake VoiceManager to exercise the HTTP layer.
 *
 * Scenarios:
 *  - 200 on join (voice channel)
 *  - 200 on leave
 *  - 200 on status (active + inactive)
 *  - 409 on join when channel.type !== 'voice'
 *  - 503 when VoiceManager throws BotSpawnError
 *  - 401 without auth token
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { ObjectId } from 'mongodb';
import { Hono } from 'hono';
import { startTestDb, stopTestDb, cleanCollections, type TestDb } from './helpers/db.js';
import { makeApp, jsonReq, TEST_JWT_SECRET } from './helpers/app.js';
import { registerAndLogin } from './helpers/auth.js';
import { createIndexes } from '../src/db/indexes.js';
import { voiceRoutes } from '../src/api/routes/voice.js';
import { VoiceManager, BotSpawnError } from '../src/voice/manager.js';
import type { ChannelDoc, VoiceSessionDoc } from '../src/db/types.js';
import { collections } from '../src/db/types.js';

// ── Fake VoiceManager ────────────────────────────────────────────────────────

function makeFakeVoiceManager(db: any) {
  // Track calls for assertions
  const calls: { method: string; args: any[] }[] = [];

  const sessionStore = new Map<string, VoiceSessionDoc>();

  const manager = {
    async joinChannel({ channel, user }: any) {
      calls.push({ method: 'joinChannel', args: [channel, user] });
      const session: VoiceSessionDoc = {
        _id: new ObjectId(),
        channelId: channel._id,
        serverId: channel.serverId,
        dailyRoomName: 'test-room',
        dailyRoomUrl: 'https://test.daily.co/test-room',
        agentSlug: null,
        agentSoul: '',
        participantIds: [user._id],
        pythonPid: 1234,
        status: 'active',
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 600_000),
        endedAt: null,
      };
      sessionStore.set(session._id.toHexString(), session);
      return { session, userToken: 'test-user-token' };
    },
    async leaveChannel({ sessionId, user }: any) {
      calls.push({ method: 'leaveChannel', args: [sessionId, user] });
      return { ended: true };
    },
    async status(channelId: ObjectId) {
      calls.push({ method: 'status', args: [channelId] });
      return null;
    },
    async sweep() { return 0; },
    async shutdown() {},
    _calls: calls,
  } as unknown as VoiceManager & { _calls: typeof calls };

  return manager;
}

function makeFailingVoiceManager() {
  return {
    async joinChannel() {
      throw new BotSpawnError('python exploded');
    },
    async leaveChannel() { return { ended: false }; },
    async status() { return null; },
    async sweep() { return 0; },
    async shutdown() {},
  } as unknown as VoiceManager;
}

// ── App builder with voice routes ────────────────────────────────────────────

async function makeVoiceApp(db: any, voiceManager: VoiceManager) {
  await createIndexes(db);
  const baseApp = makeApp(db);
  // Build a fresh app that includes voice routes
  const { buildApp } = await import('../src/api/server.js');
  return buildApp({
    db,
    jwtSecret: TEST_JWT_SECRET,
    jwtExpiresIn: '1h',
    voiceManager,
  });
}

// ── Seed helpers ─────────────────────────────────────────────────────────────

async function seedChannel(db: any, overrides: Partial<ChannelDoc> = {}): Promise<ChannelDoc> {
  const serverId = new ObjectId();
  const doc: ChannelDoc = {
    _id: new ObjectId(),
    serverId,
    name: 'voice-general',
    topic: null,
    type: 'voice',
    defaultAgentId: null,
    position: 1,
    createdAt: new Date(),
    ...overrides,
  } as ChannelDoc;
  await db.collection(collections.channels).insertOne(doc);
  return doc;
}

async function addUserToServer(db: any, userId: ObjectId, serverId: ObjectId) {
  await db.collection(collections.serverMembers).insertOne({
    _id: new ObjectId(),
    serverId,
    principalType: 'user',
    principalId: userId,
    role: 'member',
    alias: null,
    joinedAt: new Date(),
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('voice routes', () => {
  let tdb: TestDb;
  let baseApp: Awaited<ReturnType<typeof makeApp>>;

  beforeAll(async () => { tdb = await startTestDb(); });
  afterAll(async () => {
    // Drain any fire-and-forget Mongo ops kicked off by route handlers
    // (e.g. session-mutation logging that fires after the HTTP response).
    await new Promise((r) => setTimeout(r, 200));
    await stopTestDb();
  });

  beforeEach(async () => {
    await cleanCollections(tdb.db);
    baseApp = await makeApp(tdb.db);
  });

  // ── POST /join — happy path ────────────────────────────────────────────────

  it('POST /join returns 200 with roomUrl, token, sessionId for voice channel', async () => {
    const fakeManager = makeFakeVoiceManager(tdb.db);
    const app = await makeVoiceApp(tdb.db, fakeManager);

    const { token, user } = await registerAndLogin(app);
    const channel = await seedChannel(tdb.db, { type: 'voice' });
    await addUserToServer(tdb.db, new ObjectId(user.id), channel.serverId);

    const r = await jsonReq(app, 'POST', `/v1/channels/${channel._id.toHexString()}/voice/join`, {}, token);
    expect(r.status).toBe(200);
    expect(r.body.roomUrl).toMatch(/^https:\/\//);
    expect(r.body.token).toBeTruthy();
    expect(r.body.sessionId).toMatch(/^[a-f0-9]{24}$/);
    expect(r.body.expiresAt).toBeTruthy();
  });

  // ── POST /join — non-voice channel → 409 ─────────────────────────────────

  it('POST /join returns 409 when channel type is not voice', async () => {
    const fakeManager = makeFakeVoiceManager(tdb.db);
    const app = await makeVoiceApp(tdb.db, fakeManager);

    const { token, user } = await registerAndLogin(app);
    // Seed a text channel
    const channel = await seedChannel(tdb.db, { type: 'text' } as any);
    await addUserToServer(tdb.db, new ObjectId(user.id), channel.serverId);

    const r = await jsonReq(app, 'POST', `/v1/channels/${channel._id.toHexString()}/voice/join`, {}, token);
    expect(r.status).toBe(409);
    expect(r.body.error).toBe('channel_not_voice');
  });

  // ── POST /join — BotSpawnError → 503 ─────────────────────────────────────

  it('POST /join returns 503 when bot spawn fails', async () => {
    const app = await makeVoiceApp(tdb.db, makeFailingVoiceManager());

    const { token, user } = await registerAndLogin(app);
    const channel = await seedChannel(tdb.db, { type: 'voice' });
    await addUserToServer(tdb.db, new ObjectId(user.id), channel.serverId);

    const r = await jsonReq(app, 'POST', `/v1/channels/${channel._id.toHexString()}/voice/join`, {}, token);
    expect(r.status).toBe(503);
    expect(r.body.error).toBe('bot_spawn_failed');
  });

  // ── POST /join — no auth → 401 ────────────────────────────────────────────

  it('POST /join without token returns 401', async () => {
    const fakeManager = makeFakeVoiceManager(tdb.db);
    const app = await makeVoiceApp(tdb.db, fakeManager);
    const channel = await seedChannel(tdb.db);

    const r = await jsonReq(app, 'POST', `/v1/channels/${channel._id.toHexString()}/voice/join`, {});
    // 401 or 503 (if Privy not configured in test); either means auth rejected
    expect([401, 503]).toContain(r.status);
  });

  // ── POST /leave — happy path ──────────────────────────────────────────────

  it('POST /leave returns 200 with ok + ended', async () => {
    const fakeManager = makeFakeVoiceManager(tdb.db);
    const app = await makeVoiceApp(tdb.db, fakeManager);

    const { token, user } = await registerAndLogin(app);
    const channel = await seedChannel(tdb.db, { type: 'voice' });
    await addUserToServer(tdb.db, new ObjectId(user.id), channel.serverId);

    // First join to get a sessionId
    const joinRes = await jsonReq(app, 'POST', `/v1/channels/${channel._id.toHexString()}/voice/join`, {}, token);
    const sessionId = joinRes.body.sessionId;

    const r = await jsonReq(app, 'POST', `/v1/channels/${channel._id.toHexString()}/voice/leave`,
      { sessionId }, token);
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(typeof r.body.ended).toBe('boolean');
  });

  // ── POST /leave — missing sessionId → 400 ────────────────────────────────

  it('POST /leave with missing sessionId returns 400', async () => {
    const fakeManager = makeFakeVoiceManager(tdb.db);
    const app = await makeVoiceApp(tdb.db, fakeManager);

    const { token, user } = await registerAndLogin(app);
    const channel = await seedChannel(tdb.db, { type: 'voice' });
    await addUserToServer(tdb.db, new ObjectId(user.id), channel.serverId);

    const r = await jsonReq(app, 'POST', `/v1/channels/${channel._id.toHexString()}/voice/leave`, {}, token);
    expect(r.status).toBe(400);
  });

  // ── GET /status — no session ──────────────────────────────────────────────

  it('GET /status returns active: false when no session', async () => {
    const fakeManager = makeFakeVoiceManager(tdb.db);
    const app = await makeVoiceApp(tdb.db, fakeManager);

    const { token, user } = await registerAndLogin(app);
    const channel = await seedChannel(tdb.db, { type: 'voice' });
    await addUserToServer(tdb.db, new ObjectId(user.id), channel.serverId);

    const r = await jsonReq(app, 'GET', `/v1/channels/${channel._id.toHexString()}/voice/status`, undefined, token);
    expect(r.status).toBe(200);
    expect(r.body.active).toBe(false);
  });

  // ── GET /status — active session ─────────────────────────────────────────

  it('GET /status returns active: true with session details when session exists', async () => {
    // Make manager.status return an active session
    const channelId = new ObjectId();
    const sessionId = new ObjectId();
    const mockSession: VoiceSessionDoc = {
      _id: sessionId,
      channelId,
      serverId: new ObjectId(),
      dailyRoomName: 'active-room',
      dailyRoomUrl: 'https://test.daily.co/active-room',
      agentSlug: null,
      agentSoul: '',
      participantIds: [new ObjectId()],
      pythonPid: 9999,
      status: 'active',
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 300_000),
      endedAt: null,
    };

    const activeManager = {
      async joinChannel() { return { session: mockSession, userToken: 'tok' }; },
      async leaveChannel() { return { ended: false }; },
      async status(_cid: ObjectId) { return mockSession; },
      async sweep() { return 0; },
      async shutdown() {},
    } as unknown as VoiceManager;

    const app = await makeVoiceApp(tdb.db, activeManager);

    const { token, user } = await registerAndLogin(app);
    const channel = await seedChannel(tdb.db, { _id: channelId, type: 'voice' } as any);
    await addUserToServer(tdb.db, new ObjectId(user.id), channel.serverId);

    const r = await jsonReq(app, 'GET', `/v1/channels/${channelId.toHexString()}/voice/status`, undefined, token);
    expect(r.status).toBe(200);
    expect(r.body.active).toBe(true);
    expect(r.body.sessionId).toBe(sessionId.toHexString());
    expect(r.body.participantCount).toBe(1);
  });
});
