import { Hono } from 'hono';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import type { Db } from 'mongodb';
import { requireUser, type AuthBindings } from '../../auth/middleware.js';
import {
  AgentSlugTakenError, createAgent, findAgentByIdOrSlug,
  listPublicAgents, deleteAgent, publicAgent, rotateAgentKey,
} from '../../agents/registry.js';

const SLUG_RE = /^[a-z0-9_-]{1,32}$/;

const CreateAgentBody = z.object({
  name: z.string().min(1).max(64),
  slug: z.string().regex(SLUG_RE),
  baseUrl: z.string().url(),
  description: z.string().min(1).max(200),
  bio: z.string().max(10_000).nullish(),
  avatarUrl: z.string().url().nullish(),
  tags: z.array(z.string().min(1).max(32)).max(16).optional(),
  visibility: z.enum(['public', 'unlisted']).default('public'),
});

export interface AgentRouteDeps { db: Db; jwtSecret: string; }

export function agentRoutes(deps: AgentRouteDeps) {
  const app = new Hono<AuthBindings>();
  const requireAuth = requireUser(deps.db, deps.jwtSecret);

  app.get('/v1/agents', async (c) => {
    const q = c.req.query('q');
    const tag = c.req.query('tag');
    const limit = c.req.query('limit') ? Number(c.req.query('limit')) : undefined;
    const cursor = c.req.query('cursor') ?? undefined;
    const agents = await listPublicAgents(deps.db, { q, tag, limit, cursor });
    return c.json({ agents: agents.map(publicAgent) });
  });

  app.get('/v1/agents/:aid', async (c) => {
    const a = await findAgentByIdOrSlug(deps.db, c.req.param('aid'));
    if (!a) return c.json({ error: 'not_found' }, 404);
    return c.json({ agent: publicAgent(a) });
  });

  app.post('/v1/agents', requireAuth, async (c) => {
    const parsed = CreateAgentBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: 'invalid_body', issues: parsed.error.issues }, 400);
    try {
      const { agent, agentKey } = await createAgent(deps.db, { ...parsed.data, createdBy: c.get('user')._id });
      return c.json({ agent: publicAgent(agent), agentKey }, 201);
    } catch (e) {
      if (e instanceof AgentSlugTakenError) return c.json({ error: 'agent_slug_taken' }, 409);
      throw e;
    }
  });

  app.delete('/v1/agents/:aid', requireAuth, async (c) => {
    const a = await findAgentByIdOrSlug(deps.db, c.req.param('aid'));
    if (!a) return c.json({ error: 'not_found' }, 404);
    if (!a.createdBy.equals(c.get('user')._id)) return c.json({ error: 'forbidden' }, 403);
    await deleteAgent(deps.db, a._id);
    return c.json({ ok: true });
  });

  app.post('/v1/agents/:aid/rotate-key', requireAuth, async (c) => {
    const a = await findAgentByIdOrSlug(deps.db, c.req.param('aid'));
    if (!a) return c.json({ error: 'not_found' }, 404);
    if (!a.createdBy.equals(c.get('user')._id)) return c.json({ error: 'forbidden' }, 403);
    const key = await rotateAgentKey(deps.db, a._id);
    return c.json({ agentKey: key });
  });

  return app;
}
