import { Hono } from 'hono';
import type { AgentConfig } from '../../config/schema.js';

export function configRoutes(opts: { getConfig: () => AgentConfig; patch: (p: any) => Promise<void> }) {
  const app = new Hono();
  app.get('/config', (c) => c.json(JSON.parse(JSON.stringify(opts.getConfig()))));
  app.patch('/config', async (c) => {
    const body = await c.req.json();
    await opts.patch(body);
    return c.json({ ok: true });
  });
  return app;
}
