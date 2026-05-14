import { Hono } from 'hono';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import type { Db } from 'mongodb';
import { requireUser, type AuthBindings } from '../../auth/middleware.js';
import {
  AgentSlugTakenError, createAgent, findAgentByIdOrSlug,
  listPublicAgents, deleteAgent, publicAgent, rotateAgentKey,
} from '../../agents/registry.js';
import { collections } from '../../db/types.js';

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
  soul: z.string().max(10_000).optional(),
  agents: z.string().max(10_000).optional(),
});

const PatchAgentBody = z.object({
  name: z.string().min(1).max(64).optional(),
  description: z.string().min(1).max(200).optional(),
  bio: z.string().max(10_000).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  tags: z.array(z.string().min(1).max(32)).max(16).optional(),
  visibility: z.enum(['public', 'unlisted']).optional(),
  baseUrl: z.string().url().optional(),
  soul: z.string().max(10_000).optional(),
  agents: z.string().max(10_000).optional(),
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

    // If soul/agents provided, create the tenant on the agent first.
    if (parsed.data.soul || parsed.data.agents) {
      try {
        const tenantRes = await fetch(`${parsed.data.baseUrl}/tenants`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            slug: parsed.data.slug.toLowerCase(),
            name: parsed.data.name,
            description: parsed.data.description,
            soul: parsed.data.soul ?? '',
            agents: parsed.data.agents ?? '',
            tags: parsed.data.tags ?? [],
            avatarUrl: parsed.data.avatarUrl ?? null,
          }),
        });
        if (!tenantRes.ok && tenantRes.status !== 409) {
          // 409 = slug already exists on agent (idempotent; treat as ok)
          const body = await tenantRes.text();
          return c.json({ error: 'agent_tenant_create_failed', status: tenantRes.status, body }, 502);
        }
      } catch (e: any) {
        return c.json({ error: 'agent_unreachable', message: e?.message ?? String(e) }, 502);
      }
    }

    try {
      const { agent, agentKey } = await createAgent(deps.db, { ...parsed.data, createdBy: c.get('user')._id });
      return c.json({ agent: publicAgent(agent), agentKey }, 201);
    } catch (e) {
      if (e instanceof AgentSlugTakenError) return c.json({ error: 'agent_slug_taken' }, 409);
      throw e;
    }
  });

  app.patch('/v1/agents/:aid', requireAuth, async (c) => {
    const a = await findAgentByIdOrSlug(deps.db, c.req.param('aid'));
    if (!a) return c.json({ error: 'not_found' }, 404);
    if (!a.createdBy.equals(c.get('user')._id)) return c.json({ error: 'forbidden' }, 403);

    const parsed = PatchAgentBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: 'invalid_body', issues: parsed.error.issues }, 400);

    // If soul/agents or persona-relevant fields provided, proxy to agent's PATCH /tenants/:slug
    if (
      parsed.data.soul !== undefined || parsed.data.agents !== undefined ||
      parsed.data.description !== undefined || parsed.data.name !== undefined
    ) {
      const baseUrl = parsed.data.baseUrl ?? a.baseUrl;
      const tenantPatch: Record<string, unknown> = {};
      if (parsed.data.name !== undefined) tenantPatch.name = parsed.data.name;
      if (parsed.data.description !== undefined) tenantPatch.description = parsed.data.description;
      if (parsed.data.soul !== undefined) tenantPatch.soul = parsed.data.soul;
      if (parsed.data.agents !== undefined) tenantPatch.agents = parsed.data.agents;
      if (parsed.data.avatarUrl !== undefined) tenantPatch.avatarUrl = parsed.data.avatarUrl;
      if (parsed.data.tags !== undefined) tenantPatch.tags = parsed.data.tags;
      try {
        const tenantRes = await fetch(`${baseUrl}/tenants/${a.slug}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(tenantPatch),
        });
        if (!tenantRes.ok && tenantRes.status !== 404) {
          // 404 means the tenant doesn't exist on the agent yet — that's fine
          const body = await tenantRes.text();
          return c.json({ error: 'agent_tenant_patch_failed', status: tenantRes.status, body }, 502);
        }
      } catch (e: any) {
        return c.json({ error: 'agent_unreachable', message: e?.message ?? String(e) }, 502);
      }
    }

    // Update marketplace fields
    const $set: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) $set.name = parsed.data.name;
    if (parsed.data.description !== undefined) $set.description = parsed.data.description;
    if (parsed.data.bio !== undefined) $set.bio = parsed.data.bio;
    if (parsed.data.avatarUrl !== undefined) $set.avatarUrl = parsed.data.avatarUrl;
    if (parsed.data.tags !== undefined) $set.tags = parsed.data.tags;
    if (parsed.data.visibility !== undefined) $set.visibility = parsed.data.visibility;
    if (parsed.data.baseUrl !== undefined) $set.baseUrl = parsed.data.baseUrl;
    const updated = await deps.db.collection(collections.agents).findOneAndUpdate(
      { _id: a._id }, { $set }, { returnDocument: 'after' }
    );
    return c.json({ agent: publicAgent(updated as any) });
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
