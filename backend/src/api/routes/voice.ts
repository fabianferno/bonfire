/**
 * Voice channel HTTP routes.
 *
 *  POST  /v1/channels/:cid/voice/join
 *  POST  /v1/channels/:cid/voice/leave
 *  GET   /v1/channels/:cid/voice/status
 */

import { Hono } from 'hono';
import { ObjectId } from 'mongodb';
import type { Db } from 'mongodb';
import { z } from 'zod';
import { requireUser } from '../../auth/middleware.js';
import type { AuthBindings } from '../../auth/middleware.js';
import { findChannelById } from '../../channels/service.js';
import type { VoiceManager } from '../../voice/manager.js';
import { BotSpawnError } from '../../voice/manager.js';
import { log } from '../../util/logger.js';

export interface VoiceRouteDeps {
  db: Db;
  jwtSecret: string;
  voiceManager: VoiceManager;
}

const LeaveBody = z.object({
  sessionId: z.string().regex(/^[a-f0-9]{24}$/),
});

export function voiceRoutes(deps: VoiceRouteDeps) {
  const app = new Hono<AuthBindings>();
  const requireAuth = requireUser(deps.db, deps.jwtSecret);

  // ── POST /v1/channels/:cid/voice/join ───────────────────────────────────────

  app.post('/v1/channels/:cid/voice/join', requireAuth, async (c) => {
    const cid = c.req.param('cid');
    if (!cid || !ObjectId.isValid(cid)) {
      return c.json({ error: 'invalid_channel_id' }, 400);
    }

    const channel = await findChannelById(deps.db, new ObjectId(cid));
    if (!channel) return c.json({ error: 'channel_not_found' }, 404);

    if (channel.type !== 'voice') {
      return c.json({ error: 'channel_not_voice' }, 409);
    }

    const user = c.get('user');

    try {
      const { session, userToken } = await deps.voiceManager.joinChannel({ channel, user });
      return c.json({
        roomUrl: session.dailyRoomUrl,
        token: userToken,
        sessionId: session._id.toHexString(),
        agentSlug: session.agentSlug,
        expiresAt: session.expiresAt.toISOString(),
      });
    } catch (e) {
      if (e instanceof BotSpawnError) {
        log.warn({ err: e, cid }, 'bot spawn failed on join');
        return c.json({ error: 'bot_spawn_failed' }, 503);
      }
      throw e;
    }
  });

  // ── POST /v1/channels/:cid/voice/leave ──────────────────────────────────────

  app.post('/v1/channels/:cid/voice/leave', requireAuth, async (c) => {
    const cid = c.req.param('cid');
    if (!cid || !ObjectId.isValid(cid)) {
      return c.json({ error: 'invalid_channel_id' }, 400);
    }

    const parsed = LeaveBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      return c.json({ error: 'invalid_body', issues: parsed.error.issues }, 400);
    }

    const user = c.get('user');
    const sessionId = new ObjectId(parsed.data.sessionId);

    const { ended } = await deps.voiceManager.leaveChannel({ sessionId, user });
    return c.json({ ok: true, ended });
  });

  // ── GET /v1/channels/:cid/voice/status ──────────────────────────────────────

  app.get('/v1/channels/:cid/voice/status', requireAuth, async (c) => {
    const cid = c.req.param('cid');
    if (!cid || !ObjectId.isValid(cid)) {
      return c.json({ error: 'invalid_channel_id' }, 400);
    }

    const session = await deps.voiceManager.status(new ObjectId(cid));
    if (!session) {
      return c.json({ active: false });
    }

    return c.json({
      active: true,
      sessionId: session._id.toHexString(),
      participantCount: session.participantIds.length,
      expiresAt: session.expiresAt.toISOString(),
    });
  });

  return app;
}
