import { Hono } from 'hono';
import type { Db } from 'mongodb';
import { authRoutes } from './routes/auth.js';

export interface AppDeps { db: Db; jwtSecret: string; jwtExpiresIn: string; }

export function buildApp(deps: AppDeps) {
  const app = new Hono();
  app.get('/health', (c) => c.json({ ok: true }));
  app.route('/', authRoutes(deps));
  return app;
}
