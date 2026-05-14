import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Db } from 'mongodb';
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { serverRoutes } from './routes/servers.js';
import { agentRoutes } from './routes/agents.js';
import { channelRoutes } from './routes/channels.js';
import { messageRoutes } from './routes/messages.js';
import { internalRoutes } from './routes/internal.js';
import { cascadeRoutes } from './routes/cascade.js';
import type { InftDeps } from '../agents/invoker.js';

export interface AppDeps {
  db: Db;
  jwtSecret: string;
  jwtExpiresIn: string;
  cascadeConfig?: { maxHops?: number; maxInvocationsPerRoot?: number };
  /** Allowed CORS origins. Defaults to localhost dev origins. */
  corsOrigins?: string[];
  /** Present when chain integration is configured (INFT_CONTRACT_ADDRESS + PLATFORM_EXECUTOR_PRIVATE_KEY). */
  inftDeps?: InftDeps;
}

export function buildApp(deps: AppDeps) {
  const app = new Hono();
  const allowed = deps.corsOrigins ?? ['http://localhost:3000', 'http://127.0.0.1:3000'];
  app.use(
    '*',
    cors({
      origin: (origin) => (origin && allowed.includes(origin) ? origin : allowed[0]),
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['content-type', 'authorization', 'x-bonfire-agent-key'],
      credentials: false,
      maxAge: 600,
    })
  );
  app.get('/health', (c) => c.json({ ok: true }));
  app.route('/', authRoutes(deps));
  app.route('/', userRoutes(deps));
  app.route('/', serverRoutes(deps));
  app.route('/', agentRoutes(deps));
  app.route('/', channelRoutes(deps));
  app.route('/', messageRoutes({ db: deps.db, jwtSecret: deps.jwtSecret, cascadeConfig: deps.cascadeConfig, inftDeps: deps.inftDeps }));
  app.route('/', internalRoutes({ db: deps.db }));
  app.route('/', cascadeRoutes(deps));
  return app;
}
