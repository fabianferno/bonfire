import { Hono } from 'hono';

export function channelRoutes(opts: { patchTelegram: (p: any) => Promise<void> }) {
  const app = new Hono();
  app.post('/channels/telegram', async (c) => {
    const body = await c.req.json();
    await opts.patchTelegram(body);
    return c.json({ ok: true });
  });
  return app;
}
