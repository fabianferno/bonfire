import { Hono } from 'hono';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import type { Db } from 'mongodb';
import { requireUser } from '../../auth/middleware.js';
import { requireServerMember, type ServerBindings } from '../../servers/middleware.js';
import type { ChannelDoc } from '../../db/types.js';
import { collections } from '../../db/types.js';
import {
  SlugTakenError, createServer, listServersForUser, publicServer,
  listServerMembers, publicMember,
} from '../../servers/service.js';

const SLUG_RE = /^[a-z0-9_-]{1,32}$/;

const CreateServerBody = z.object({
  name: z.string().min(1).max(64),
  slug: z.string().regex(SLUG_RE),
  iconUrl: z.string().url().nullish(),
});

const PatchServerBody = z.object({
  name: z.string().min(1).max(64).optional(),
  iconUrl: z.string().url().nullable().optional(),
});

export interface ServerRouteDeps { db: Db; jwtSecret: string; }

export function serverRoutes(deps: ServerRouteDeps) {
  const app = new Hono<ServerBindings>();
  const requireAuth = requireUser(deps.db, deps.jwtSecret);

  app.post('/v1/servers', requireAuth, async (c) => {
    const parsed = CreateServerBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: 'invalid_body', issues: parsed.error.issues }, 400);
    try {
      const { server } = await createServer(deps.db, {
        name: parsed.data.name,
        slug: parsed.data.slug,
        iconUrl: parsed.data.iconUrl ?? null,
        ownerId: c.get('user')._id,
      });
      return c.json({ server: publicServer(server) }, 201);
    } catch (e) {
      if (e instanceof SlugTakenError) return c.json({ error: 'slug_taken' }, 409);
      throw e;
    }
  });

  app.get('/v1/servers', requireAuth, async (c) => {
    const servers = await listServersForUser(deps.db, c.get('user')._id);
    return c.json({ servers: servers.map(publicServer) });
  });

  app.get('/v1/servers/:sid', requireAuth, requireServerMember(deps.db), (c) => {
    return c.json({ server: publicServer(c.get('server')) });
  });

  app.patch('/v1/servers/:sid', requireAuth, requireServerMember(deps.db, 'admin'), async (c) => {
    const parsed = PatchServerBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
    const $set: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) $set.name = parsed.data.name;
    if (parsed.data.iconUrl !== undefined) $set.iconUrl = parsed.data.iconUrl;
    const res = await deps.db.collection(collections.servers).findOneAndUpdate(
      { _id: c.get('server')._id }, { $set }, { returnDocument: 'after' }
    );
    if (!res) return c.json({ error: 'not_found' }, 404);
    return c.json({ server: publicServer(res as any) });
  });

  app.delete('/v1/servers/:sid', requireAuth, requireServerMember(deps.db, 'owner'), async (c) => {
    const serverId = c.get('server')._id;
    await deps.db.collection(collections.messages).deleteMany({ serverId });
    await deps.db.collection(collections.channels).deleteMany({ serverId });
    await deps.db.collection(collections.serverMembers).deleteMany({ serverId });
    await deps.db.collection(collections.servers).deleteOne({ _id: serverId });
    return c.json({ ok: true });
  });

  app.get('/v1/servers/:sid/members', requireAuth, requireServerMember(deps.db), async (c) => {
    const typeParam = c.req.query('type');
    const type = typeParam === 'user' || typeParam === 'agent' ? typeParam : undefined;
    const members = await listServerMembers(deps.db, c.get('server')._id, type);
    return c.json({ members: members.map(publicMember) });
  });

  app.get('/v1/servers/:sid/channels', requireAuth, requireServerMember(deps.db), async (c) => {
    const channels = await deps.db.collection<ChannelDoc>(collections.channels)
      .find({ serverId: c.get('server')._id })
      .sort({ position: 1 })
      .toArray();
    return c.json({
      channels: channels.map(ch => ({
        id: ch._id.toHexString(),
        serverId: ch.serverId.toHexString(),
        name: ch.name,
        topic: ch.topic,
        type: ch.type,
        defaultAgentId: ch.defaultAgentId?.toHexString() ?? null,
        position: ch.position,
        createdAt: ch.createdAt.toISOString(),
      })),
    });
  });

  return app;
}
