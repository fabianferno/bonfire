import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startTestDb, stopTestDb, cleanCollections, type TestDb } from './helpers/db.js';
import { makeApp, jsonReq } from './helpers/app.js';
import { registerAndLogin } from './helpers/auth.js';

describe('agent routes', () => {
  let tdb: TestDb;
  let app: Awaited<ReturnType<typeof makeApp>>;
  beforeAll(async () => { tdb = await startTestDb(); });
  afterAll(async () => { await stopTestDb(); });
  beforeEach(async () => { await cleanCollections(tdb.db); app = await makeApp(tdb.db); });

  it('registers a public agent and lists it', async () => {
    const me = await registerAndLogin(app);
    const create = await jsonReq(app, 'POST', '/v1/agents', {
      name: 'Researcher', slug: 'researcher', description: 'finds papers',
      baseUrl: 'http://ember:7777', tags: ['research'], visibility: 'public',
    }, me.token);
    expect(create.status).toBe(201);
    const list = await jsonReq(app, 'GET', '/v1/agents');
    expect(list.body.agents.length).toBe(1);
    expect(list.body.agents[0].slug).toBe('researcher');
  });

  it('does not list unlisted agents in /v1/agents', async () => {
    const me = await registerAndLogin(app);
    await jsonReq(app, 'POST', '/v1/agents', {
      name: 'Private', slug: 'private', description: 'x',
      baseUrl: 'http://x:7777', tags: [], visibility: 'unlisted',
    }, me.token);
    const list = await jsonReq(app, 'GET', '/v1/agents');
    expect(list.body.agents.length).toBe(0);
  });

  it('GET /v1/agents/:slug returns unlisted by direct lookup', async () => {
    const me = await registerAndLogin(app);
    await jsonReq(app, 'POST', '/v1/agents', {
      name: 'Private', slug: 'private', description: 'x',
      baseUrl: 'http://x:7777', tags: [], visibility: 'unlisted',
    }, me.token);
    const r = await jsonReq(app, 'GET', '/v1/agents/private');
    expect(r.status).toBe(200);
    expect(r.body.agent.slug).toBe('private');
  });

  it('non-owner cannot delete', async () => {
    const alice = await registerAndLogin(app, { username: 'alice' });
    const bob = await registerAndLogin(app, { username: 'bob' });
    const c = await jsonReq(app, 'POST', '/v1/agents', {
      name: 'A', slug: 'a', description: 'x', baseUrl: 'http://x:7777', tags: [], visibility: 'public',
    }, alice.token);
    const r = await jsonReq(app, 'DELETE', `/v1/agents/${c.body.agent.id}`, undefined, bob.token);
    expect(r.status).toBe(403);
  });

  it('filters by tag', async () => {
    const me = await registerAndLogin(app);
    await jsonReq(app, 'POST', '/v1/agents', {
      name: 'R', slug: 'r', description: 'x', baseUrl: 'http://x:7777', tags: ['research'], visibility: 'public',
    }, me.token);
    await jsonReq(app, 'POST', '/v1/agents', {
      name: 'C', slug: 'c', description: 'x', baseUrl: 'http://x:7777', tags: ['code'], visibility: 'public',
    }, me.token);
    const r = await jsonReq(app, 'GET', '/v1/agents?tag=research');
    expect(r.body.agents.map((a: any) => a.slug)).toEqual(['r']);
  });
});
