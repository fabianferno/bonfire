import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { healthRoutes } from './routes/health.js';
import { skillsRoutes } from './routes/skills.js';
import { mcpRoutes } from './routes/mcp.js';
import { configRoutes } from './routes/config.js';
import { channelRoutes } from './routes/channels.js';
import { eventsRoutes } from './routes/events.js';
import { chatRoutes } from './routes/chat.js';
import { tenantsRoutes } from './routes/tenants.js';
import type { EventEmitter } from 'node:events';
import type { WebChatAdapter } from '../channels/web.js';
import type { AgentConfig } from '../config/schema.js';
import type { SkillRecord } from '../skills/loader.js';
import type { TenantRegistry } from '../tenants/registry.js';

export interface ApiDeps {
  agentDir: string;
  publicDir: string;
  bus: EventEmitter;
  web: WebChatAdapter;
  evolutionMode: () => 'off' | 'suggest' | 'auto-safe' | 'auto-all';
  listSkills: () => SkillRecord[];
  reload: () => Promise<void>;
  restartMcp: () => Promise<void>;
  getConfig: () => AgentConfig;
  patchConfig: (p: Partial<AgentConfig>) => Promise<void>;
  patchTelegram: (p: any) => Promise<void>;
  tenantRegistry: TenantRegistry;
}

export function startApi(port: number, d: ApiDeps) {
  const app = new Hono();
  app.route('/', healthRoutes());
  app.route('/', skillsRoutes({ agentDir: d.agentDir, evolutionMode: d.evolutionMode, listSkills: d.listSkills, reload: d.reload }));
  app.route('/', mcpRoutes({ agentDir: d.agentDir, restartMcp: d.restartMcp }));
  app.route('/', configRoutes({ getConfig: d.getConfig, patch: d.patchConfig }));
  app.route('/', channelRoutes({ patchTelegram: d.patchTelegram }));
  app.route('/', eventsRoutes(d.bus));
  app.route('/', chatRoutes(d.web, d.publicDir));
  app.route('/', tenantsRoutes(d.tenantRegistry));
  return serve({ fetch: app.fetch, port });
}
