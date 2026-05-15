import { Hono } from 'hono';
import fs from 'node:fs/promises';
import path from 'node:path';
import { McpJsonSchema } from '../../config/schema.js';

export function mcpRoutes(opts: { agentDir: string; restartMcp: () => Promise<void> }) {
  const app = new Hono();
  const file = path.join(opts.agentDir, 'mcp.json');
  app.get('/mcp/servers', async (c) => {
    let raw: any = { servers: {} };
    try { raw = JSON.parse(await fs.readFile(file, 'utf8')); } catch {}
    return c.json({ servers: raw.servers ?? {} });
  });
  app.post('/mcp/servers', async (c) => {
    const { id, command, args = [], env = {}, enabled = true } = await c.req.json();
    if (!id || !command) return c.json({ ok: false, error: 'id and command required' }, 400);
    let raw: any = { servers: {} };
    try { raw = JSON.parse(await fs.readFile(file, 'utf8')); } catch {}
    raw.servers[id] = { command, args, env, enabled };
    const parsed = McpJsonSchema.parse(raw);
    await fs.writeFile(file, JSON.stringify(parsed, null, 2));
    await opts.restartMcp();
    return c.json({ ok: true });
  });
  app.delete('/mcp/servers/:id', async (c) => {
    const id = c.req.param('id');
    let raw: any = { servers: {} };
    try { raw = JSON.parse(await fs.readFile(file, 'utf8')); } catch {}
    delete raw.servers[id];
    await fs.writeFile(file, JSON.stringify(raw, null, 2));
    await opts.restartMcp();
    return c.json({ ok: true });
  });
  return app;
}
