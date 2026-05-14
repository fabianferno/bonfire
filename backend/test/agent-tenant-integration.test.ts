import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { startTestDb, stopTestDb, cleanCollections, type TestDb } from './helpers/db.js';
import { makeApp, jsonReq } from './helpers/app.js';
import { registerAndLogin } from './helpers/auth.js';

interface TenantCall {
  method: 'POST' | 'PATCH';
  slug?: string;
  body: Record<string, unknown>;
}

interface ChatCall {
  body: Record<string, unknown>;
}

/**
 * Builds a Hono fake that implements both the /tenants CRUD and /chat/message + /chat/stream
 * endpoints of the ember-agent. Records all incoming calls for inspection.
 */
function makeAgentWithTenants() {
  const app = new Hono();
  const tenantCalls: TenantCall[] = [];
  const chatCalls: ChatCall[] = [];
  const tenants = new Map<string, Record<string, unknown>>();
  const pending = new Map<string, string>();

  // ── /tenants CRUD ──────────────────────────────────────────────────────────

  app.get('/tenants', (c) => {
    return c.json({ tenants: [...tenants.values()] });
  });

  app.get('/tenants/:slug', (c) => {
    const slug = c.req.param('slug');
    const t = tenants.get(slug);
    if (!t) return c.json({ error: 'not_found' }, 404);
    return c.json({ tenant: t });
  });

  app.post('/tenants', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const slug = (body.slug as string) ?? '';
    tenantCalls.push({ method: 'POST', body });
    if (tenants.has(slug)) {
      return c.json({ error: 'slug_taken' }, 409);
    }
    const t = { ...body };
    tenants.set(slug, t);
    return c.json({ tenant: t }, 201);
  });

  app.patch('/tenants/:slug', async (c) => {
    const slug = c.req.param('slug');
    const body = await c.req.json().catch(() => ({}));
    tenantCalls.push({ method: 'PATCH', slug, body });
    if (!tenants.has(slug)) {
      return c.json({ error: 'not_found' }, 404);
    }
    const updated = { ...tenants.get(slug)!, ...body };
    tenants.set(slug, updated);
    return c.json({ tenant: updated });
  });

  // ── /chat endpoints ────────────────────────────────────────────────────────

  app.post('/chat/message', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    chatCalls.push({ body });
    const tenant = (body.tenant as string) ?? 'default';
    const replyText = `reply-from-${tenant}`;
    const streamId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    pending.set(streamId, replyText);
    return c.json({ streamId });
  });

  app.get('/chat/stream/:id', (c) => {
    const id = c.req.param('id');
    const out = pending.get(id) ?? '';
    pending.delete(id);
    return stream(c, async (s) => {
      s.write(`data: ${JSON.stringify({ chunk: out })}\n\n`);
      s.write(`event: done\ndata: {}\n\n`);
    });
  });

  return { app, tenantCalls, chatCalls, tenants };
}

describe('agent-tenant integration', () => {
  let tdb: TestDb;
  let agentServer: ReturnType<typeof serve>;
  let port: number;
  let fake: ReturnType<typeof makeAgentWithTenants>;

  beforeAll(async () => {
    tdb = await startTestDb();
  });

  afterAll(async () => {
    agentServer?.close();
    await stopTestDb();
  });

  beforeEach(async () => {
    await cleanCollections(tdb.db);
    // Re-create a fresh fake for each test so recorded calls don't bleed over.
    agentServer?.close();
    fake = makeAgentWithTenants();
    agentServer = serve({ fetch: fake.app.fetch, port: 0 });
    await new Promise<void>((r) => setTimeout(r, 50));
    port = (agentServer.address() as any).port;
  });

  it('POST /v1/agents with soul+agents calls agent POST /tenants then creates marketplace record', async () => {
    const app = await makeApp(tdb.db);
    const me = await registerAndLogin(app);

    const res = await jsonReq(app, 'POST', '/v1/agents', {
      name: 'Poet',
      slug: 'poet',
      baseUrl: `http://127.0.0.1:${port}`,
      description: 'Writes poetry',
      tags: ['poetry'],
      visibility: 'public',
      soul: 'You are a poet. Write only in verse.',
      agents: 'Operating rules:\n- One poem per response.',
    }, me.token);

    expect(res.status).toBe(201);
    expect(res.body.agent.slug).toBe('poet');

    // Agent's /tenants should have received the POST with soul + agents
    expect(fake.tenantCalls).toHaveLength(1);
    expect(fake.tenantCalls[0].method).toBe('POST');
    expect(fake.tenantCalls[0].body.slug).toBe('poet');
    expect(fake.tenantCalls[0].body.soul).toBe('You are a poet. Write only in verse.');
    expect(fake.tenantCalls[0].body.agents).toBe('Operating rules:\n- One poem per response.');

    // Marketplace record should exist
    const get = await jsonReq(app, 'GET', '/v1/agents/poet');
    expect(get.status).toBe(200);
    expect(get.body.agent.slug).toBe('poet');
    // soul/agents are not persisted in MongoDB
    expect(get.body.agent).not.toHaveProperty('soul');
    expect(get.body.agent).not.toHaveProperty('agents');
  });

  it('POST /v1/agents WITHOUT soul/agents skips the agent /tenants call', async () => {
    const app = await makeApp(tdb.db);
    const me = await registerAndLogin(app);

    const res = await jsonReq(app, 'POST', '/v1/agents', {
      name: 'Helper',
      slug: 'helper',
      baseUrl: `http://127.0.0.1:${port}`,
      description: 'A helpful agent',
      tags: [],
      visibility: 'public',
    }, me.token);

    expect(res.status).toBe(201);
    // No /tenants call should have been made
    expect(fake.tenantCalls).toHaveLength(0);
  });

  it('POST /v1/agents with soul returns 502 when agent server returns non-409 error', async () => {
    const app = await makeApp(tdb.db);
    const me = await registerAndLogin(app);

    // Point at a port that doesn't exist to simulate unreachable agent
    const res = await jsonReq(app, 'POST', '/v1/agents', {
      name: 'Ghost',
      slug: 'ghost',
      baseUrl: 'http://127.0.0.1:19999',
      description: 'Unreachable agent',
      soul: 'You are a ghost.',
    }, me.token);

    expect(res.status).toBe(502);
    expect(res.body.error).toBe('agent_unreachable');

    // Marketplace record should NOT have been created
    const get = await jsonReq(app, 'GET', '/v1/agents/ghost');
    expect(get.status).toBe(404);
  });

  it('POST /v1/agents with soul treats 409 from agent as idempotent (still creates marketplace record)', async () => {
    const app = await makeApp(tdb.db);
    const me = await registerAndLogin(app);

    // Pre-seed the slug on the fake so it returns 409
    fake.tenants.set('duplicate', { slug: 'duplicate', name: 'already exists' });

    const res = await jsonReq(app, 'POST', '/v1/agents', {
      name: 'Duplicate',
      slug: 'duplicate',
      baseUrl: `http://127.0.0.1:${port}`,
      description: 'Already on agent',
      soul: 'Re-register me.',
    }, me.token);

    // Should still succeed (409 on agent is treated as ok)
    expect(res.status).toBe(201);
    expect(res.body.agent.slug).toBe('duplicate');
  });

  it('PATCH /v1/agents/:aid with soul calls agent PATCH /tenants/:slug', async () => {
    const app = await makeApp(tdb.db);
    const me = await registerAndLogin(app);

    // Create the agent first (without soul)
    const create = await jsonReq(app, 'POST', '/v1/agents', {
      name: 'Helper',
      slug: 'helper',
      baseUrl: `http://127.0.0.1:${port}`,
      description: 'A helpful agent',
      tags: [],
      visibility: 'public',
    }, me.token);
    expect(create.status).toBe(201);
    const agentId = create.body.agent.id;

    // Pre-seed the tenant on the fake
    fake.tenants.set('helper', { slug: 'helper', name: 'Helper', soul: 'old soul' });

    // Patch with new soul
    const patch = await jsonReq(app, 'PATCH', `/v1/agents/${agentId}`, {
      soul: 'You are a very helpful assistant.',
      description: 'Updated description',
    }, me.token);

    expect(patch.status).toBe(200);
    expect(patch.body.agent.description).toBe('Updated description');

    // Agent's /tenants/:slug should have been PATCHed
    const patchCall = fake.tenantCalls.find(c => c.method === 'PATCH');
    expect(patchCall).toBeTruthy();
    expect(patchCall!.slug).toBe('helper');
    expect(patchCall!.body.soul).toBe('You are a very helpful assistant.');
    expect(patchCall!.body.description).toBe('Updated description');
  });

  it('PATCH /v1/agents/:aid forbidden for non-owner', async () => {
    const app = await makeApp(tdb.db);
    const alice = await registerAndLogin(app, { username: 'alice-patch' });
    const bob = await registerAndLogin(app, { username: 'bob-patch' });

    const create = await jsonReq(app, 'POST', '/v1/agents', {
      name: 'Alice Agent',
      slug: 'alice-agent',
      baseUrl: `http://127.0.0.1:${port}`,
      description: 'Owned by alice',
      visibility: 'public',
    }, alice.token);
    expect(create.status).toBe(201);

    const patch = await jsonReq(app, 'PATCH', `/v1/agents/${create.body.agent.id}`, {
      description: 'Hijack attempt',
    }, bob.token);

    expect(patch.status).toBe(403);
  });

  it('cascade invocation passes tenant: agent.slug to the agent /chat/message', async () => {
    const app = await makeApp(tdb.db);
    const me = await registerAndLogin(app);

    // Register a server + agent + channel
    const serverRes = await jsonReq(app, 'POST', '/v1/servers', { name: 'S', slug: 's-tenant-test' }, me.token);
    const helperRes = await jsonReq(app, 'POST', '/v1/agents', {
      name: 'Helper',
      slug: 'helper-t',
      baseUrl: `http://127.0.0.1:${port}`,
      description: 'Helper',
      visibility: 'public',
    }, me.token);
    await jsonReq(app, 'POST', `/v1/servers/${serverRes.body.server.id}/members`,
      { principalType: 'agent', principalId: helperRes.body.agent.id }, me.token);
    const chRes = await jsonReq(app, 'POST', `/v1/servers/${serverRes.body.server.id}/channels`,
      { name: 'main', defaultAgentId: helperRes.body.agent.id }, me.token);
    expect(chRes.status).toBe(201);

    // Post a message — triggers cascade -> agent invocation
    const post = await jsonReq(app, 'POST', `/v1/channels/${chRes.body.channel.id}/messages`,
      { content: 'hello agent' }, me.token);
    expect(post.status).toBe(201);

    // The fake agent's /chat/message should have been called with tenant: 'helper-t'
    expect(fake.chatCalls.length).toBeGreaterThanOrEqual(1);
    const call = fake.chatCalls[fake.chatCalls.length - 1];
    expect(call.body.tenant).toBe('helper-t');
  });
});
