import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { serveStatic } from '@hono/node-server/serve-static';
import path from 'node:path';
import fs from 'node:fs';
import type { WebChatAdapter } from '../../channels/web.js';

export function chatRoutes(web: WebChatAdapter, publicDir: string) {
  const app = new Hono();

  app.get('/chat', (c) => {
    const html = fs.readFileSync(path.join(publicDir, 'chat.html'), 'utf8');
    return c.html(html);
  });

  app.post('/chat/message', async (c) => {
    const { userId = 'anonymous', text } = await c.req.json();
    if (!text) return c.json({ error: 'text required' }, 400);
    const streamId = await web.enqueue(userId, text);
    return c.json({ streamId });
  });

  app.get('/chat/stream/:id', (c) => {
    const id = c.req.param('id');
    return stream(c, async (s) => {
      let unsub = () => {};
      await new Promise<void>((resolve) => {
        unsub = web.subscribe(id, (chunk) => { s.write(`data: ${JSON.stringify({ chunk })}\n\n`); });
        c.req.raw.signal.addEventListener('abort', () => { unsub(); resolve(); });
      });
    });
  });

  app.use('/chat-assets/*', serveStatic({ root: publicDir }));
  return app;
}
