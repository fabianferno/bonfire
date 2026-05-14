/**
 * VoiceManager — session lifecycle, subprocess spawn/kill, participant ref counting.
 *
 * One Daily room per active voice channel. Bots are long-lived child processes
 * spawned when the first user joins and killed when the last user leaves (or the
 * sweeper expires a stale session).
 */

import { ObjectId } from 'mongodb';
import type { Db } from 'mongodb';
import type { DailyClient } from './daily-client.js';
import type { OgStorageClient } from '../storage-0g/index.js';
import type { ChannelDoc, UserDoc, VoiceSessionDoc, AgentDoc } from '../db/types.js';
import { collections } from '../db/types.js';
import { decryptAgentBundle } from '../agents/inft-decrypt.js';
import { log } from '../util/logger.js';

export interface VoiceManagerDeps {
  db: Db;
  daily: DailyClient;
  /** Present when INFT integration is enabled. */
  storage?: OgStorageClient;
  platformExecutorPrivkey?: string;
  spawnBot: (env: Record<string, string>) => { pid: number; kill: () => void };
}

export class BotSpawnError extends Error {
  code = 'bot_spawn_failed' as const;
}

export class VoiceManager {
  private readonly db: Db;
  private readonly daily: DailyClient;
  private readonly storage?: OgStorageClient;
  private readonly platformExecutorPrivkey?: string;
  private readonly spawnBot: VoiceManagerDeps['spawnBot'];

  /** In-memory map: sessionId (hex) → kill function */
  private readonly bots = new Map<string, { kill: () => void }>();

  constructor(deps: VoiceManagerDeps) {
    this.db = deps.db;
    this.daily = deps.daily;
    this.storage = deps.storage;
    this.platformExecutorPrivkey = deps.platformExecutorPrivkey;
    this.spawnBot = deps.spawnBot;
  }

  // ── joinChannel ─────────────────────────────────────────────────────────────

  async joinChannel(opts: {
    channel: ChannelDoc;
    user: UserDoc;
  }): Promise<{ session: VoiceSessionDoc; userToken: string }> {
    const { channel, user } = opts;
    const col = this.db.collection<VoiceSessionDoc>(collections.voiceSessions);

    // Get-or-create: find an active session for this channel.
    const existing = await col.findOne({
      channelId: channel._id,
      status: { $in: ['starting', 'active'] },
      expiresAt: { $gt: new Date() },
    });

    if (existing) {
      // Add user to existing session (idempotent on duplicate)
      await col.updateOne(
        { _id: existing._id },
        { $addToSet: { participantIds: user._id } },
      );

      const userToken = await this.daily.mintMeetingToken({
        roomName: existing.dailyRoomName,
        userName: user.username,
        isOwner: false,
        expSeconds: Math.max(
          60,
          Math.floor((existing.expiresAt.getTime() - Date.now()) / 1000),
        ),
      });

      const session = (await col.findOne({ _id: existing._id }))!;
      return { session, userToken };
    }

    // ── Create a new session ────────────────────────────────────────────────

    // Resolve persona — look up the default agent for soul content
    let agentSlug: string | null = null;
    let agentSoul = '';

    if (channel.defaultAgentId) {
      const agent = await this.db
        .collection<AgentDoc>(collections.agents)
        .findOne({ _id: channel.defaultAgentId });

      if (agent) {
        agentSlug = agent.slug;

        if (
          agent.tokenId &&
          this.storage &&
          this.platformExecutorPrivkey
        ) {
          try {
            const bundle = await decryptAgentBundle({
              agent,
              storage: this.storage,
              platformExecutorPrivkey: this.platformExecutorPrivkey,
            });
            agentSoul = bundle.soul ?? '';
          } catch (e) {
            log.warn({ agentSlug, err: e }, 'failed to decrypt agent bundle; using empty soul');
          }
        }
      }
    }

    // Create Daily room — expires in 10 minutes
    const room = await this.daily.createRoom({ expSeconds: 600 });
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

    // Mint a bot token (owner) — used by the Python subprocess
    const botToken = await this.daily.mintMeetingToken({
      roomName: room.name,
      userName: 'ember-bot',
      isOwner: true,
      expSeconds: 600,
    });

    // Insert session doc first so we have a sessionId
    const sessionDoc: VoiceSessionDoc = {
      _id: new ObjectId(),
      channelId: channel._id,
      serverId: channel.serverId,
      dailyRoomName: room.name,
      dailyRoomUrl: room.url,
      agentSlug,
      agentSoul,
      participantIds: [user._id],
      pythonPid: null,
      status: 'starting',
      startedAt: now,
      expiresAt,
      endedAt: null,
    };

    await col.insertOne(sessionDoc);

    // Build env for the Python bot
    const botEnv: Record<string, string> = {
      DAILY_ROOM_URL: room.url,
      DAILY_BOT_TOKEN: botToken,
      AGENT_SOUL: agentSoul,
      AGENT_SLUG: agentSlug ?? '',
      AGENT_NAME: agentSlug ?? 'ember',
      OG_LLM_BASE_URL: process.env.OG_LLM_BASE_URL ?? '',
      OG_LLM_API_KEY: process.env.OG_LLM_API_KEY ?? '',
      OG_LLM_MODEL: process.env.OG_LLM_MODEL ?? '',
      DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY ?? '',
      // TTS via OpenAI (replaces ElevenLabs in v1)
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',
      OPENAI_TTS_VOICE: process.env.OPENAI_TTS_VOICE ?? 'nova',
      OPENAI_TTS_MODEL: process.env.OPENAI_TTS_MODEL ?? 'tts-1',
    };

    // Spawn the bot subprocess
    let spawned: { pid: number; kill: () => void };
    try {
      spawned = this.spawnBot(botEnv);
    } catch (e) {
      log.error({ err: e, channelId: channel._id.toHexString() }, 'bot spawn failed; cleaning up room');
      // Roll back: delete Daily room + mark session ended
      await this.daily.deleteRoom(room.name).catch((err) =>
        log.warn({ err }, 'deleteRoom cleanup failed after spawn error'),
      );
      await col.updateOne(
        { _id: sessionDoc._id },
        { $set: { status: 'ended', endedAt: new Date() } },
      );
      throw new BotSpawnError(`bot spawn failed: ${String(e)}`);
    }

    // Update session with PID and mark active
    this.bots.set(sessionDoc._id.toHexString(), { kill: spawned.kill });
    await col.updateOne(
      { _id: sessionDoc._id },
      { $set: { pythonPid: spawned.pid, status: 'active' } },
    );
    sessionDoc.pythonPid = spawned.pid;
    sessionDoc.status = 'active';

    // Mint user token
    const userToken = await this.daily.mintMeetingToken({
      roomName: room.name,
      userName: user.username,
      isOwner: false,
      expSeconds: 600,
    });

    return { session: sessionDoc, userToken };
  }

  // ── leaveChannel ─────────────────────────────────────────────────────────────

  async leaveChannel(opts: {
    sessionId: ObjectId;
    user: UserDoc;
  }): Promise<{ ended: boolean }> {
    const { sessionId, user } = opts;
    const col = this.db.collection<VoiceSessionDoc>(collections.voiceSessions);

    await col.updateOne(
      { _id: sessionId },
      { $pull: { participantIds: user._id } },
    );

    const session = await col.findOne({ _id: sessionId });
    if (!session || session.status === 'ended') return { ended: true };

    if (session.participantIds.length === 0) {
      await this._teardown(session);
      return { ended: true };
    }

    return { ended: false };
  }

  // ── status ───────────────────────────────────────────────────────────────────

  async status(channelId: ObjectId): Promise<VoiceSessionDoc | null> {
    return this.db.collection<VoiceSessionDoc>(collections.voiceSessions).findOne({
      channelId,
      status: { $in: ['starting', 'active'] },
      expiresAt: { $gt: new Date() },
    });
  }

  // ── sweep ────────────────────────────────────────────────────────────────────

  async sweep(): Promise<number> {
    const col = this.db.collection<VoiceSessionDoc>(collections.voiceSessions);
    const stale = await col
      .find({
        status: { $in: ['starting', 'active'] },
        expiresAt: { $lte: new Date() },
      })
      .toArray();

    let count = 0;
    for (const session of stale) {
      try {
        await this._teardown(session);
        count++;
      } catch (e) {
        log.warn({ err: e, sessionId: session._id.toHexString() }, 'sweep teardown failed');
      }
    }

    if (count > 0) log.info({ count }, 'voice sweeper expired sessions');
    return count;
  }

  // ── shutdown ─────────────────────────────────────────────────────────────────

  async shutdown(): Promise<void> {
    log.info({ count: this.bots.size }, 'voice manager shutdown: killing all bots');
    for (const [, bot] of this.bots) {
      try { bot.kill(); } catch { /* ignore */ }
    }
    this.bots.clear();
  }

  // ── private teardown ─────────────────────────────────────────────────────────

  private async _teardown(session: VoiceSessionDoc): Promise<void> {
    const col = this.db.collection<VoiceSessionDoc>(collections.voiceSessions);
    const sid = session._id.toHexString();

    // Kill bot subprocess
    const bot = this.bots.get(sid);
    if (bot) {
      bot.kill();
      this.bots.delete(sid);
    }

    // Delete Daily room
    await this.daily.deleteRoom(session.dailyRoomName).catch((e) =>
      log.warn({ err: e, room: session.dailyRoomName }, 'deleteRoom failed during teardown'),
    );

    // Mark ended
    await col.updateOne(
      { _id: session._id },
      { $set: { status: 'ended', endedAt: new Date() } },
    );
  }
}
