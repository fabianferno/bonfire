import { Hono } from 'hono';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import type { Db } from 'mongodb';
import { requireUser } from '../../auth/middleware.js';
import { requireChannelAccess, type ChannelBindings } from '../../channels/middleware.js';
import { resolveMentions } from '../../messages/mentions.js';
import {
  insertMessage, listChannelMessages, findMessageById, deleteMessage, publicMessage,
} from '../../messages/service.js';
import { computeInvocationSet, runInvocation } from '../../agents/invoker.js';
import { findMembership } from '../../servers/service.js';

const PostMessageBody = z.object({
  content: z.string().min(1).max(4000),
  replyToId: z.string().regex(/^[a-f0-9]{24}$/).nullish(),
  stream: z.boolean().optional(),
});

export interface MessageRouteDeps { db: Db; jwtSecret: string; }

export function messageRoutes(deps: MessageRouteDeps) {
  const app = new Hono<ChannelBindings>();
  const requireAuth = requireUser(deps.db, deps.jwtSecret);

  app.post('/v1/channels/:cid/messages', requireAuth, requireChannelAccess(deps.db), async (c) => {
    const parsed = PostMessageBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: 'invalid_body', issues: parsed.error.issues }, 400);

    const channel = c.get('channel');
    const user = c.get('user');
    const mentions = await resolveMentions(deps.db, channel.serverId, parsed.data.content);

    const userMessage = await insertMessage(deps.db, {
      channelId: channel._id,
      serverId: channel.serverId,
      authorType: 'user',
      authorId: user._id,
      content: parsed.data.content,
      mentions,
      replyToId: parsed.data.replyToId ? new ObjectId(parsed.data.replyToId) : null,
    });

    const agents = await computeInvocationSet({ db: deps.db, channel, userMessage });
    const replies = await runInvocation({ db: deps.db, channel, userMessage }, agents);

    return c.json({
      userMessage: publicMessage(userMessage),
      replies: replies.map(publicMessage),
    }, 201);
  });

  app.get('/v1/channels/:cid/messages', requireAuth, requireChannelAccess(deps.db), async (c) => {
    const limit = c.req.query('limit') ? Number(c.req.query('limit')) : undefined;
    const beforeStr = c.req.query('before');
    const before = beforeStr && ObjectId.isValid(beforeStr) ? new ObjectId(beforeStr) : null;
    const { messages, nextCursor } = await listChannelMessages(deps.db, c.get('channel')._id, { limit, before });
    return c.json({ messages: messages.map(publicMessage), nextCursor });
  });

  app.delete('/v1/messages/:mid', requireAuth, async (c) => {
    const mid = c.req.param('mid');
    if (!ObjectId.isValid(mid)) return c.json({ error: 'invalid_message_id' }, 400);
    const msg = await findMessageById(deps.db, new ObjectId(mid));
    if (!msg) return c.json({ error: 'not_found' }, 404);

    const user = c.get('user');
    const isAuthor = msg.authorType === 'user' && msg.authorId.equals(user._id);
    if (!isAuthor) {
      const m = await findMembership(deps.db, msg.serverId, 'user', user._id);
      if (!m || (m.role !== 'owner' && m.role !== 'admin')) {
        return c.json({ error: 'forbidden' }, 403);
      }
    }
    await deleteMessage(deps.db, msg._id);
    return c.json({ ok: true });
  });

  return app;
}
