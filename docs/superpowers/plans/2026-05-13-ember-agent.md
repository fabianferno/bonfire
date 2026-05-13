# Ember Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `ember-agent`, a standalone Dockerizable AI agent service (one agent = one directory), configurable via filesystem, talking to Telegram + a built-in web chat, with OpenClaw-compatible skills, MCP tools, SQLite vector memory, agentskill.sh `/learn` bootstrap, and an admin HTTP API for future BonFire integration.

**Architecture:** TypeScript Node 20+ service. Boot loads `agent.config.json` (Zod-validated) + `SOUL.md` + `AGENTS.md` + `skills/*/SKILL.md` + `mcp.json`. Per-message agent loop composes a system prompt, calls an OpenAI-compatible LLM via Vercel AI SDK, dispatches tool calls (built-in + MCP + skill-derived), persists turns to SQLite + sqlite-vec. Channel adapters (Telegram via grammY, Web chat via Hono SSE) implement a shared interface. Hono HTTP server exposes admin + web-chat endpoints. Evolution loop calls a `/learn` meta-skill (cloned from agentskill.sh) to discover/install new skills under a security-scanned policy.

**Tech Stack:** TypeScript, Node 20+, pnpm, Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/openai-compatible`), `grammy`, `@modelcontextprotocol/sdk`, `hono` (+ `@hono/node-server`), `better-sqlite3`, `sqlite-vec`, `zod`, `pino`, `dotenv`, `chokidar`, `gray-matter`, `vitest`.

**Build root:** `/Users/fabianferno/Documents/bonfire/agent/`

---

## File Structure

```
agent/
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── vitest.config.ts
├── README.md
├── .env.example
├── .gitignore
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
├── public/
│   └── chat.html                          # Static web chat UI
├── src/
│   ├── index.ts                           # entrypoint
│   ├── config/
│   │   ├── schema.ts                      # Zod schemas
│   │   ├── defaults.ts
│   │   └── loader.ts                      # agent.config.json + SOUL.md + AGENTS.md
│   ├── runtime/
│   │   ├── agent.ts                       # AgentRuntime
│   │   ├── prompt-builder.ts
│   │   ├── llm-client.ts
│   │   └── session.ts
│   ├── memory/
│   │   ├── store.ts                       # SQLite + sqlite-vec
│   │   └── embeddings.ts
│   ├── skills/
│   │   ├── loader.ts
│   │   ├── installer.ts
│   │   ├── scanner.ts
│   │   ├── workshop.ts                    # stub
│   │   └── registry-clients/
│   │       ├── base.ts
│   │       ├── agentskill-sh.ts
│   │       ├── clawhub.ts
│   │       └── skills-sh.ts
│   ├── tools/
│   │   ├── registry.ts
│   │   ├── mcp-client.ts
│   │   └── builtin/
│   │       ├── web-search.ts
│   │       ├── web-fetch.ts
│   │       ├── code-exec.ts
│   │       └── file-ops.ts
│   ├── channels/
│   │   ├── base.ts                        # Channel interface
│   │   ├── telegram.ts                    # grammY adapter
│   │   └── web.ts                         # web-chat adapter (SSE)
│   ├── evolution/
│   │   ├── discover.ts
│   │   ├── score.ts
│   │   └── loop.ts
│   ├── api/
│   │   ├── server.ts                      # Hono app
│   │   └── routes/
│   │       ├── skills.ts
│   │       ├── mcp.ts
│   │       ├── config.ts
│   │       ├── channels.ts
│   │       ├── health.ts
│   │       ├── events.ts                  # SSE/WS
│   │       └── chat.ts                    # /chat web UI + /chat/stream SSE
│   └── util/
│       ├── logger.ts                      # pino
│       └── paths.ts                       # realpath guard
├── examples/
│   └── default-agent/
│       ├── agent.config.json
│       ├── SOUL.md
│       ├── AGENTS.md
│       ├── mcp.json
│       └── skills/.gitkeep
└── test/
    ├── fixtures/test-agent/...
    ├── config-loader.test.ts
    ├── prompt-builder.test.ts
    ├── skills-loader.test.ts
    ├── scanner.test.ts
    ├── memory.test.ts
    ├── runtime.test.ts
    └── channel-telegram.test.ts
```

---

## Phase 0: Scaffolding

### Task 0.1: Initialize project

**Files:**
- Create: `agent/package.json`
- Create: `agent/tsconfig.json`
- Create: `agent/.gitignore`
- Create: `agent/.env.example`
- Create: `agent/vitest.config.ts`

- [ ] **Step 1: Create `agent/package.json`**

```json
{
  "name": "ember-agent",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "dev": "tsx watch src/index.ts examples/default-agent",
    "start": "node --import tsx src/index.ts",
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@ai-sdk/openai": "^1.0.0",
    "@ai-sdk/openai-compatible": "^0.1.0",
    "@hono/node-server": "^1.13.0",
    "@modelcontextprotocol/sdk": "^1.0.0",
    "ai": "^4.0.0",
    "better-sqlite3": "^11.3.0",
    "chokidar": "^4.0.0",
    "dotenv": "^16.4.0",
    "gray-matter": "^4.0.3",
    "grammy": "^1.30.0",
    "hono": "^4.6.0",
    "pino": "^9.5.0",
    "pino-pretty": "^11.3.0",
    "sqlite-vec": "^0.1.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@types/node": "^20.16.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `agent/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "forceConsistentCasingInFileNames": true,
    "allowSyntheticDefaultImports": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

- [ ] **Step 3: Create `agent/.gitignore`**

```
node_modules/
dist/
.env
*.log
logs/
memory/
examples/*/memory/
examples/*/logs/
examples/*/.env
test/fixtures/*/memory/
test/fixtures/*/logs/
```

- [ ] **Step 4: Create `agent/.env.example`**

```
# LLM (any OpenAI-compatible endpoint)
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4o-mini

# Embeddings
EMBEDDINGS_BASE_URL=https://api.openai.com/v1
EMBEDDINGS_API_KEY=sk-...
EMBEDDINGS_MODEL=text-embedding-3-small

# Telegram
TELEGRAM_BOT_TOKEN=

# Web tools
TAVILY_API_KEY=

# Server
AGENT_API_PORT=7777
LOG_LEVEL=info
```

- [ ] **Step 5: Create `agent/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { environment: 'node', include: ['test/**/*.test.ts'], testTimeout: 10000 }
});
```

- [ ] **Step 6: Install and verify**

Run from `/Users/fabianferno/Documents/bonfire/agent`:
```
pnpm install
pnpm typecheck
```
Expected: install succeeds; typecheck passes (no source files yet).

- [ ] **Step 7: Commit**

```bash
git add agent/
git commit -m "feat(agent): scaffold project"
```

---

## Phase 1: Config + Zod schema

### Task 1.1: Zod schema for agent.config.json

**Files:**
- Create: `agent/src/config/schema.ts`
- Create: `agent/src/config/defaults.ts`
- Create: `agent/test/config-loader.test.ts`

- [ ] **Step 1: Write failing test** at `agent/test/config-loader.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { AgentConfigSchema } from '../src/config/schema.js';

describe('AgentConfigSchema', () => {
  it('parses a minimal config with defaults', () => {
    const parsed = AgentConfigSchema.parse({
      name: 'Test', id: 'test',
      llm: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' }
    });
    expect(parsed.llm.temperature).toBe(0.7);
    expect(parsed.evolution.mode).toBe('suggest');
    expect(parsed.channels.web.enabled).toBe(true);
  });

  it('rejects bad evolution mode', () => {
    expect(() => AgentConfigSchema.parse({
      name: 'x', id: 'x',
      llm: { baseUrl: 'u', model: 'm' },
      evolution: { mode: 'bogus' }
    } as any)).toThrow();
  });
});
```

- [ ] **Step 2: Run test (FAIL)**

`pnpm test -- config-loader` — fails: module not found.

- [ ] **Step 3: Implement** `agent/src/config/schema.ts`:

```ts
import { z } from 'zod';

export const LlmConfigSchema = z.object({
  baseUrl: z.string().url(),
  model: z.string(),
  apiKeyEnv: z.string().default('LLM_API_KEY'),
  temperature: z.number().default(0.7),
  maxTokens: z.number().default(4096),
});

export const EmbeddingsConfigSchema = z.object({
  baseUrl: z.string().url(),
  model: z.string(),
  apiKeyEnv: z.string().default('EMBEDDINGS_API_KEY'),
}).optional();

export const TelegramConfigSchema = z.object({
  enabled: z.boolean().default(false),
  tokenEnv: z.string().default('TELEGRAM_BOT_TOKEN'),
  dmPolicy: z.enum(['open', 'allowlist', 'pairing', 'disabled']).default('open'),
  allowFrom: z.array(z.string()).default([]),
  groups: z.record(z.object({
    requireMention: z.boolean().default(true),
    allowFrom: z.array(z.string()).default([]),
  })).default({}),
});

export const WebChatConfigSchema = z.object({
  enabled: z.boolean().default(true),
  path: z.string().default('/chat'),
});

export const ChannelsSchema = z.object({
  telegram: TelegramConfigSchema.default({}),
  web: WebChatConfigSchema.default({}),
});

export const EvolutionSchema = z.object({
  mode: z.enum(['off', 'suggest', 'auto-safe', 'auto-all']).default('suggest'),
  intervalHours: z.number().default(24),
  registries: z.array(z.string()).default(['agentskill.sh']),
  interests: z.array(z.string()).default([]),
  controlChannel: z.string().optional(),
});

export const MemorySchema = z.object({
  maxSessions: z.number().default(100),
  compactAfterTokens: z.number().default(8000),
  vectorStorePath: z.string().default('./memory/vectors.db'),
});

export const BuiltinToolsSchema = z.object({
  webSearch: z.object({
    enabled: z.boolean().default(false),
    provider: z.enum(['tavily', 'brave']).default('tavily'),
    apiKeyEnv: z.string().default('TAVILY_API_KEY'),
  }).default({}),
  webFetch: z.object({ enabled: z.boolean().default(true) }).default({}),
  codeExec: z.object({ enabled: z.boolean().default(false), timeoutMs: z.number().default(5000) }).default({}),
  fileOps: z.object({ enabled: z.boolean().default(false), rootDir: z.string().default('./workspace') }).default({}),
});

export const ToolsSchema = z.object({ builtin: BuiltinToolsSchema.default({}) }).default({});

export const McpSchema = z.object({ configFile: z.string().default('./mcp.json') }).default({});

export const LoggingSchema = z.object({
  level: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  logDir: z.string().default('./logs'),
}).default({});

export const AgentConfigSchema = z.object({
  name: z.string(),
  id: z.string().regex(/^[a-z0-9-]+$/),
  llm: LlmConfigSchema,
  embeddings: EmbeddingsConfigSchema,
  channels: ChannelsSchema.default({}),
  mcp: McpSchema,
  evolution: EvolutionSchema.default({}),
  memory: MemorySchema.default({}),
  tools: ToolsSchema,
  logging: LoggingSchema,
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

export const McpJsonSchema = z.object({
  servers: z.record(z.object({
    command: z.string(),
    args: z.array(z.string()).default([]),
    env: z.record(z.string()).default({}),
    enabled: z.boolean().default(true),
  })).default({}),
});
export type McpJson = z.infer<typeof McpJsonSchema>;
```

- [ ] **Step 4: Run test (PASS)** — `pnpm test -- config-loader`. Both tests pass.

- [ ] **Step 5: Commit**

```bash
git add agent/src/config agent/test/config-loader.test.ts
git commit -m "feat(agent): zod config schema"
```

### Task 1.2: Config loader (file + SOUL + AGENTS + env)

**Files:**
- Create: `agent/src/config/loader.ts`
- Modify: `agent/test/config-loader.test.ts`
- Create: `agent/test/fixtures/test-agent/{agent.config.json,SOUL.md,AGENTS.md,mcp.json}`

- [ ] **Step 1: Write failing test (extend)**:

```ts
import { loadAgent } from '../src/config/loader.js';
import path from 'node:path';

it('loads fixture agent', async () => {
  const a = await loadAgent(path.resolve(__dirname, 'fixtures/test-agent'));
  expect(a.config.name).toBe('Tester');
  expect(a.soul).toContain('terse');
  expect(a.agents).toContain('Default');
  expect(a.mcp.servers).toBeDefined();
});
```

- [ ] **Step 2: Create fixture** `agent/test/fixtures/test-agent/agent.config.json`:

```json
{ "name": "Tester", "id": "tester", "llm": { "baseUrl": "https://api.openai.com/v1", "model": "gpt-4o-mini" } }
```

`SOUL.md`:
```
Be terse. No fluff. Opinions allowed.
```

`AGENTS.md`:
```
Default operating rules. Ask before destructive actions.
```

`mcp.json`:
```json
{ "servers": {} }
```

- [ ] **Step 3: Implement** `agent/src/config/loader.ts`:

```ts
import fs from 'node:fs/promises';
import path from 'node:path';
import { AgentConfigSchema, McpJsonSchema, type AgentConfig, type McpJson } from './schema.js';

export interface LoadedAgent {
  dir: string;
  config: AgentConfig;
  soul: string;
  agents: string;
  mcp: McpJson;
}

export async function loadAgent(dir: string): Promise<LoadedAgent> {
  const abs = path.resolve(dir);
  const cfgRaw = await fs.readFile(path.join(abs, 'agent.config.json'), 'utf8');
  const config = AgentConfigSchema.parse(JSON.parse(cfgRaw));
  const soul = await readOpt(path.join(abs, 'SOUL.md'));
  const agents = await readOpt(path.join(abs, 'AGENTS.md'));
  let mcp: McpJson = { servers: {} };
  try {
    const mcpRaw = await fs.readFile(path.join(abs, config.mcp.configFile), 'utf8');
    mcp = McpJsonSchema.parse(JSON.parse(mcpRaw));
  } catch { /* mcp.json optional */ }
  return { dir: abs, config, soul, agents, mcp };
}

async function readOpt(p: string): Promise<string> {
  try { return await fs.readFile(p, 'utf8'); } catch { return ''; }
}
```

- [ ] **Step 4: Run test (PASS)**.
- [ ] **Step 5: Commit** — `feat(agent): config + SOUL/AGENTS loader`.

---

## Phase 2: Logging + paths utilities

### Task 2.1: Logger + path guard

**Files:**
- Create: `agent/src/util/logger.ts`
- Create: `agent/src/util/paths.ts`

- [ ] **Step 1: Implement** `agent/src/util/logger.ts`:

```ts
import pino from 'pino';
const level = (process.env.LOG_LEVEL ?? 'info') as pino.Level;
export const log = pino({
  level,
  transport: process.env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty' },
  redact: { paths: ['*.token', '*.apiKey', '*.botToken', '*.LLM_API_KEY', '*.TELEGRAM_BOT_TOKEN'], remove: true },
});
```

- [ ] **Step 2: Implement** `agent/src/util/paths.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';

/** Ensure `target` is inside `root` after realpath; throws if not. */
export function assertInside(root: string, target: string): string {
  const rRoot = fs.realpathSync(root);
  const rTarget = fs.realpathSync.native(path.resolve(root, target));
  if (!rTarget.startsWith(rRoot + path.sep) && rTarget !== rRoot) {
    throw new Error(`path escapes agent root: ${target}`);
  }
  return rTarget;
}
```

- [ ] **Step 3: Commit** — `feat(agent): logger + path guard`.

---

## Phase 3: LLM client

### Task 3.1: OpenAI-compatible client wrapper

**Files:**
- Create: `agent/src/runtime/llm-client.ts`

- [ ] **Step 1: Implement**:

```ts
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModelV1 } from 'ai';
import type { AgentConfig } from '../config/schema.js';

export function createChatModel(cfg: AgentConfig): LanguageModelV1 {
  const apiKey = process.env[cfg.llm.apiKeyEnv];
  if (!apiKey) throw new Error(`Missing env ${cfg.llm.apiKeyEnv}`);
  const provider = createOpenAICompatible({
    name: 'configured-llm',
    baseURL: cfg.llm.baseUrl,
    apiKey,
  });
  return provider.chatModel(cfg.llm.model);
}

export function createEmbeddingModel(cfg: AgentConfig) {
  if (!cfg.embeddings) return null;
  const apiKey = process.env[cfg.embeddings.apiKeyEnv];
  if (!apiKey) throw new Error(`Missing env ${cfg.embeddings.apiKeyEnv}`);
  const provider = createOpenAICompatible({
    name: 'configured-embeddings',
    baseURL: cfg.embeddings.baseUrl,
    apiKey,
  });
  return provider.textEmbeddingModel(cfg.embeddings.model);
}
```

- [ ] **Step 2: Commit** — `feat(agent): llm client wrapper`.

---

## Phase 4: Memory (SQLite + sqlite-vec)

### Task 4.1: Memory store

**Files:**
- Create: `agent/src/memory/store.ts`
- Create: `agent/src/memory/embeddings.ts`
- Create: `agent/test/memory.test.ts`

- [ ] **Step 1: Write failing test**:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStore } from '../src/memory/store.js';
import fs from 'node:fs';
import path from 'node:path';

const tmp = path.resolve(__dirname, '.tmp-mem.db');

describe('MemoryStore', () => {
  beforeEach(() => { try { fs.unlinkSync(tmp); } catch {} });

  it('persists session messages', () => {
    const m = new MemoryStore(tmp);
    const sid = m.getOrCreateSession('web', 'u1');
    m.appendMessage(sid, 'user', 'hello');
    m.appendMessage(sid, 'assistant', 'hi');
    const msgs = m.recentMessages(sid, 10);
    expect(msgs.length).toBe(2);
    expect(msgs[0].content).toBe('hello');
    m.close();
  });

  it('vector search returns inserted vector', () => {
    const m = new MemoryStore(tmp);
    const sid = m.getOrCreateSession('web', 'u1');
    const vec = new Float32Array(8).fill(0); vec[0] = 1;
    m.indexVector(sid, 'msg-1', 'hello world', vec);
    const hits = m.searchVectors(vec, 5);
    expect(hits.length).toBeGreaterThan(0);
    m.close();
  });
});
```

- [ ] **Step 2: Implement** `agent/src/memory/store.ts`:

```ts
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import path from 'node:path';
import fs from 'node:fs';

export interface Message {
  id: number;
  session_id: number;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  created_at: number;
}

export class MemoryStore {
  private db: Database.Database;
  private vecDim: number;
  constructor(dbPath: string, vecDim = 1536) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    sqliteVec.load(this.db);
    this.vecDim = vecDim;
    this.migrate();
  }
  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel TEXT NOT NULL,
        chat_id TEXT NOT NULL,
        topic TEXT DEFAULT '',
        created_at INTEGER NOT NULL,
        UNIQUE(channel, chat_id, topic)
      );
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY(session_id) REFERENCES sessions(id)
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS vectors USING vec0(
        embedding float[${this.vecDim}]
      );
      CREATE TABLE IF NOT EXISTS vector_meta (
        rowid INTEGER PRIMARY KEY,
        session_id INTEGER NOT NULL,
        ref TEXT NOT NULL,
        snippet TEXT NOT NULL
      );
    `);
  }
  getOrCreateSession(channel: string, chatId: string, topic = ''): number {
    const row = this.db.prepare(`SELECT id FROM sessions WHERE channel=? AND chat_id=? AND topic=?`).get(channel, chatId, topic) as any;
    if (row) return row.id;
    const r = this.db.prepare(`INSERT INTO sessions(channel,chat_id,topic,created_at) VALUES(?,?,?,?)`).run(channel, chatId, topic, Date.now());
    return Number(r.lastInsertRowid);
  }
  appendMessage(sessionId: number, role: Message['role'], content: string): number {
    const r = this.db.prepare(`INSERT INTO messages(session_id,role,content,created_at) VALUES(?,?,?,?)`).run(sessionId, role, content, Date.now());
    return Number(r.lastInsertRowid);
  }
  recentMessages(sessionId: number, limit = 50): Message[] {
    return this.db.prepare(`SELECT * FROM messages WHERE session_id=? ORDER BY id ASC LIMIT ?`).all(sessionId, limit) as Message[];
  }
  indexVector(sessionId: number, ref: string, snippet: string, vec: Float32Array) {
    const r = this.db.prepare(`INSERT INTO vectors(embedding) VALUES(?)`).run(Buffer.from(vec.buffer));
    this.db.prepare(`INSERT INTO vector_meta(rowid,session_id,ref,snippet) VALUES(?,?,?,?)`).run(Number(r.lastInsertRowid), sessionId, ref, snippet);
  }
  searchVectors(vec: Float32Array, k = 5): { snippet: string; ref: string; distance: number }[] {
    return this.db.prepare(`
      SELECT m.snippet, m.ref, v.distance
      FROM vectors v
      JOIN vector_meta m ON m.rowid = v.rowid
      WHERE v.embedding MATCH ? AND k = ?
      ORDER BY v.distance ASC
    `).all(Buffer.from(vec.buffer), k) as any;
  }
  countMessages(sessionId: number): number {
    return (this.db.prepare(`SELECT COUNT(*) as c FROM messages WHERE session_id=?`).get(sessionId) as any).c;
  }
  deleteOldMessages(sessionId: number, keepLast: number) {
    this.db.prepare(`DELETE FROM messages WHERE session_id=? AND id NOT IN (SELECT id FROM messages WHERE session_id=? ORDER BY id DESC LIMIT ?)`).run(sessionId, sessionId, keepLast);
  }
  close() { this.db.close(); }
}
```

- [ ] **Step 3: Implement** `agent/src/memory/embeddings.ts`:

```ts
import { embed } from 'ai';
import type { EmbeddingModelV1 } from 'ai';

export async function embedText(model: EmbeddingModelV1<string>, text: string): Promise<Float32Array> {
  const { embedding } = await embed({ model, value: text });
  return Float32Array.from(embedding);
}
```

- [ ] **Step 4: Run test PASS, commit** — `feat(agent): sqlite vector memory`.

---

## Phase 5: Skill loader + scanner

### Task 5.1: Security scanner

**Files:**
- Create: `agent/src/skills/scanner.ts`
- Create: `agent/test/scanner.test.ts`

- [ ] **Step 1: Failing test**:

```ts
import { describe, it, expect } from 'vitest';
import { scanContent } from '../src/skills/scanner.js';

describe('scanner', () => {
  it('flags curl|sh as critical', () => {
    const r = scanContent('install: curl http://x | sh');
    expect(r.critical.length).toBeGreaterThan(0);
  });
  it('warns on child_process.exec', () => {
    const r = scanContent('require("child_process").exec("ls")');
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it('flags hardcoded sk- key', () => {
    const r = scanContent('const k = "sk-abcdefghijklmnop";');
    expect(r.critical.find(f => f.rule === 'hardcoded-key')).toBeTruthy();
  });
  it('clean content has no findings', () => {
    const r = scanContent('just markdown text');
    expect(r.critical.length).toBe(0);
    expect(r.warnings.length).toBe(0);
  });
});
```

- [ ] **Step 2: Implement** `agent/src/skills/scanner.ts`:

```ts
export interface Finding { rule: string; match: string; line: number; }
export interface ScanResult { critical: Finding[]; warnings: Finding[]; }

const CRITICAL: { rule: string; re: RegExp }[] = [
  { rule: 'pipe-to-sh',   re: /\b(?:curl|wget)\s[^|\n]*\|\s*(?:ba)?sh\b/i },
  { rule: 'rm-rf-root',   re: /\brm\s+-rf\s+\/(?:\s|$)/ },
  { rule: 'hardcoded-key',re: /\b(sk-[A-Za-z0-9]{16,}|xox[baprs]-[A-Za-z0-9-]{8,}|AKIA[0-9A-Z]{16})\b/ },
  { rule: 'eval-remote',  re: /\beval\s*\(\s*(?:await\s+)?(?:fetch|http\.get|require\('https?'\))/ },
];
const WARN: { rule: string; re: RegExp }[] = [
  { rule: 'child-exec',   re: /child_process[^.]*\.\s*(exec|execSync|spawnSync)\b/ },
  { rule: 'fs-write',     re: /\bfs(?:\.promises)?\.\s*(writeFile|appendFile|writeFileSync)\b/ },
];

export function scanContent(content: string): ScanResult {
  const critical: Finding[] = [];
  const warnings: Finding[] = [];
  const lines = content.split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const r of CRITICAL) { const m = line.match(r.re); if (m) critical.push({ rule: r.rule, match: m[0], line: i + 1 }); }
    for (const r of WARN)     { const m = line.match(r.re); if (m) warnings.push({ rule: r.rule, match: m[0], line: i + 1 }); }
  });
  return { critical, warnings };
}
```

- [ ] **Step 3: PASS, commit** — `feat(agent): security scanner`.

### Task 5.2: Skill loader (frontmatter + agentskill.sh header)

**Files:**
- Create: `agent/src/skills/loader.ts`
- Create: `agent/test/skills-loader.test.ts`
- Create: `agent/test/fixtures/test-agent/skills/sample/SKILL.md`

- [ ] **Step 1: Fixture skill** `test/fixtures/test-agent/skills/sample/SKILL.md`:

```
--- agentskill.sh ---
slug: sample
owner: tester
contentSha: abc123
installed: 2026-05-13T00:00:00Z
source: https://agentskill.sh/tester/sample
---
---
name: sample
description: A sample skill
user-invocable: true
metadata:
  openclaw:
    requires:
      bins: []
      env: []
---
# Sample
Do sample things.
```

- [ ] **Step 2: Failing test**:

```ts
import { describe, it, expect } from 'vitest';
import { loadSkills } from '../src/skills/loader.js';
import path from 'node:path';

describe('loadSkills', () => {
  it('parses SKILL.md with agentskill.sh header', async () => {
    const skills = await loadSkills(path.resolve(__dirname, 'fixtures/test-agent'));
    expect(skills.length).toBe(1);
    expect(skills[0].name).toBe('sample');
    expect(skills[0].source?.slug).toBe('sample');
    expect(skills[0].source?.owner).toBe('tester');
  });
});
```

- [ ] **Step 3: Implement** `agent/src/skills/loader.ts`:

```ts
import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import chokidar from 'chokidar';
import { log } from '../util/logger.js';

export interface SkillRecord {
  name: string;
  description: string;
  dir: string;
  body: string;
  userInvocable: boolean;
  disableModelInvocation: boolean;
  requires: { bins: string[]; env: string[]; anyBins: string[] };
  always: boolean;
  source?: { slug: string; owner: string; contentSha?: string; installed?: string; sourceUrl?: string };
}

const AGS_HEADER_RE = /^---\s*agentskill\.sh\s*---\s*\n([\s\S]*?)\n---\s*\n/;

function stripAgsHeader(raw: string): { source?: SkillRecord['source']; rest: string } {
  const m = raw.match(AGS_HEADER_RE);
  if (!m) return { rest: raw };
  const lines = m[1].split('\n');
  const meta: any = {};
  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx > 0) meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return {
    source: {
      slug: meta.slug, owner: meta.owner, contentSha: meta.contentSha,
      installed: meta.installed, sourceUrl: meta.source,
    },
    rest: raw.slice(m[0].length),
  };
}

export async function loadSkills(agentDir: string): Promise<SkillRecord[]> {
  const skillsDir = path.join(agentDir, 'skills');
  let entries: string[];
  try { entries = await fs.readdir(skillsDir); } catch { return []; }
  const out: SkillRecord[] = [];
  for (const name of entries) {
    const dir = path.join(skillsDir, name);
    const file = path.join(dir, 'SKILL.md');
    try {
      const raw = await fs.readFile(file, 'utf8');
      const { source, rest } = stripAgsHeader(raw);
      const parsed = matter(rest);
      const fm: any = parsed.data ?? {};
      out.push({
        name: fm.name ?? name,
        description: fm.description ?? '',
        dir,
        body: parsed.content,
        userInvocable: fm['user-invocable'] !== false,
        disableModelInvocation: !!fm['disable-model-invocation'],
        requires: {
          bins: fm?.metadata?.openclaw?.requires?.bins ?? [],
          env: fm?.metadata?.openclaw?.requires?.env ?? [],
          anyBins: fm?.metadata?.openclaw?.requires?.anyBins ?? [],
        },
        always: !!fm?.metadata?.openclaw?.always,
        source,
      });
    } catch (e) { log.warn({ err: e, file }, 'failed to load skill'); }
  }
  return out;
}

export function watchSkills(agentDir: string, onChange: () => void): () => void {
  const w = chokidar.watch(path.join(agentDir, 'skills'), { ignoreInitial: true, depth: 3 });
  const fire = () => onChange();
  w.on('add', fire).on('change', fire).on('unlink', fire).on('addDir', fire).on('unlinkDir', fire);
  return () => { w.close(); };
}

export function checkGating(s: SkillRecord): { eligible: boolean; missing: string[] } {
  const missing: string[] = [];
  for (const e of s.requires.env) if (!process.env[e]) missing.push(`env:${e}`);
  return { eligible: missing.length === 0, missing };
}
```

- [ ] **Step 4: PASS, commit** — `feat(agent): skill loader + ags header`.

### Task 5.3: Skill installer (agentskill.sh / git / URL) with scan

**Files:**
- Create: `agent/src/skills/installer.ts`
- Create: `agent/src/skills/registry-clients/{base.ts,agentskill-sh.ts,clawhub.ts,skills-sh.ts}`

- [ ] **Step 1: Implement** `agent/src/skills/registry-clients/base.ts`:

```ts
export interface InstallRequest { slug?: string; url?: string; query?: string; }
export interface InstalledSkill { slug: string; dir: string; }
export interface RegistryClient {
  id: string;
  install(req: InstallRequest, targetDir: string): Promise<InstalledSkill>;
}
```

- [ ] **Step 2: Implement** `agent/src/skills/registry-clients/agentskill-sh.ts`:

```ts
import { spawn } from 'node:child_process';
import path from 'node:path';
import type { RegistryClient, InstallRequest, InstalledSkill } from './base.js';

export class AgentSkillShClient implements RegistryClient {
  id = 'agentskill.sh';
  async install(req: InstallRequest, targetDir: string): Promise<InstalledSkill> {
    const slug = req.slug ?? req.query;
    if (!slug) throw new Error('slug or query required');
    await new Promise<void>((resolve, reject) => {
      const p = spawn('npx', ['-y', '@agentskill.sh/cli@latest', 'install', slug, '--target', targetDir], { stdio: 'inherit' });
      p.on('exit', (c) => c === 0 ? resolve() : reject(new Error(`agentskill.sh install exit ${c}`)));
      p.on('error', reject);
    });
    const installedSlug = slug.includes('/') ? slug.split('/').pop()! : slug;
    return { slug: installedSlug, dir: path.join(targetDir, installedSlug) };
  }
}
```

- [ ] **Step 3: Implement** `agent/src/skills/registry-clients/clawhub.ts`:

```ts
import { spawn } from 'node:child_process';
import path from 'node:path';
import type { RegistryClient, InstallRequest, InstalledSkill } from './base.js';

export class ClawHubClient implements RegistryClient {
  id = 'clawhub';
  async install(req: InstallRequest, targetDir: string): Promise<InstalledSkill> {
    const slug = req.slug; if (!slug) throw new Error('slug required');
    await new Promise<void>((resolve, reject) => {
      const p = spawn('openclaw', ['skills', 'install', slug, '--target', targetDir], { stdio: 'inherit' });
      p.on('exit', (c) => c === 0 ? resolve() : reject(new Error(`openclaw exit ${c}`)));
      p.on('error', reject);
    });
    return { slug, dir: path.join(targetDir, slug) };
  }
}
```

- [ ] **Step 4: Implement** `agent/src/skills/registry-clients/skills-sh.ts` (URL/git fallback):

```ts
import { spawn } from 'node:child_process';
import path from 'node:path';
import type { RegistryClient, InstallRequest, InstalledSkill } from './base.js';

export class GitUrlClient implements RegistryClient {
  id = 'url';
  async install(req: InstallRequest, targetDir: string): Promise<InstalledSkill> {
    const url = req.url; if (!url) throw new Error('url required');
    const slug = (url.split('/').pop() ?? 'skill').replace(/\.git$/, '');
    const dir = path.join(targetDir, slug);
    await new Promise<void>((resolve, reject) => {
      const p = spawn('git', ['clone', '--depth', '1', url, dir], { stdio: 'inherit' });
      p.on('exit', (c) => c === 0 ? resolve() : reject(new Error(`git clone exit ${c}`)));
      p.on('error', reject);
    });
    return { slug, dir };
  }
}
```

- [ ] **Step 5: Implement** `agent/src/skills/installer.ts`:

```ts
import fs from 'node:fs/promises';
import path from 'node:path';
import { scanContent } from './scanner.js';
import { AgentSkillShClient } from './registry-clients/agentskill-sh.js';
import { ClawHubClient } from './registry-clients/clawhub.js';
import { GitUrlClient } from './registry-clients/skills-sh.js';
import type { InstallRequest } from './registry-clients/base.js';
import { log } from '../util/logger.js';

export type EvolutionMode = 'off' | 'suggest' | 'auto-safe' | 'auto-all';

const clients = {
  'agentskill.sh': new AgentSkillShClient(),
  'clawhub': new ClawHubClient(),
  'url': new GitUrlClient(),
};

export interface InstallResult {
  ok: boolean;
  slug?: string;
  dir?: string;
  securityScore?: number;
  reason?: string;
  findings?: { critical: any[]; warnings: any[] };
}

export async function installSkill(
  agentDir: string,
  source: keyof typeof clients,
  req: InstallRequest,
  mode: EvolutionMode = 'suggest'
): Promise<InstallResult> {
  const targetDir = path.join(agentDir, 'skills');
  await fs.mkdir(targetDir, { recursive: true });
  const client = clients[source];
  if (!client) return { ok: false, reason: `unknown source: ${source}` };

  const installed = await client.install(req, targetDir);
  const skillMdPath = path.join(installed.dir, 'SKILL.md');
  let content = '';
  try { content = await fs.readFile(skillMdPath, 'utf8'); }
  catch { await fs.rm(installed.dir, { recursive: true, force: true }); return { ok: false, reason: 'no SKILL.md found' }; }

  const findings = scanContent(content);
  if (findings.critical.length > 0) {
    await fs.rm(installed.dir, { recursive: true, force: true });
    log.warn({ findings: findings.critical }, 'skill blocked by scanner');
    return { ok: false, reason: 'scanner: critical findings', findings };
  }
  if (mode === 'auto-safe') {
    const requiresBins = /requires:\s*\n[\s\S]*?bins:\s*\[[^\]\n]+\]/.test(content);
    if (requiresBins) {
      await fs.rm(installed.dir, { recursive: true, force: true });
      return { ok: false, reason: 'auto-safe: skill requires bins', findings };
    }
  }
  return { ok: true, slug: installed.slug, dir: installed.dir, findings };
}

export async function removeSkill(agentDir: string, slug: string): Promise<boolean> {
  const dir = path.join(agentDir, 'skills', slug);
  try { await fs.rm(dir, { recursive: true, force: true }); return true; } catch { return false; }
}
```

- [ ] **Step 6: Commit** — `feat(agent): skill installer + registry clients`.

---

## Phase 6: Tools (built-in + MCP) + registry

### Task 6.1: Built-in tools

**Files:**
- Create: `agent/src/tools/builtin/{web-search.ts,web-fetch.ts,code-exec.ts,file-ops.ts}`

- [ ] **Step 1: Implement** `agent/src/tools/builtin/web-fetch.ts`:

```ts
import { tool } from 'ai';
import { z } from 'zod';

export const webFetchTool = tool({
  description: 'Fetch a URL and return text (first 100KB).',
  parameters: z.object({ url: z.string().url() }),
  execute: async ({ url }) => {
    const res = await fetch(url, { redirect: 'follow' });
    const text = await res.text();
    return { status: res.status, text: text.slice(0, 100_000) };
  },
});
```

- [ ] **Step 2: Implement** `agent/src/tools/builtin/web-search.ts`:

```ts
import { tool } from 'ai';
import { z } from 'zod';

export function makeWebSearchTool(provider: 'tavily' | 'brave', apiKey: string) {
  return tool({
    description: 'Search the web and return top results.',
    parameters: z.object({ query: z.string(), topK: z.number().default(5) }),
    execute: async ({ query, topK }) => {
      if (provider === 'tavily') {
        const r = await fetch('https://api.tavily.com/search', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ api_key: apiKey, query, max_results: topK }),
        });
        return await r.json();
      }
      const r = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${topK}`, {
        headers: { 'X-Subscription-Token': apiKey, accept: 'application/json' },
      });
      return await r.json();
    },
  });
}
```

- [ ] **Step 3: Implement** `agent/src/tools/builtin/code-exec.ts`:

```ts
import { tool } from 'ai';
import { z } from 'zod';
import { spawn } from 'node:child_process';

export function makeCodeExecTool(timeoutMs: number) {
  return tool({
    description: 'Execute a short shell command in a sandboxed subprocess. Returns stdout/stderr.',
    parameters: z.object({ cmd: z.string(), shell: z.boolean().default(false) }),
    execute: async ({ cmd, shell }) => {
      return await new Promise<{ stdout: string; stderr: string; code: number }>((resolve) => {
        const p = spawn(cmd, [], { shell, timeout: timeoutMs });
        let stdout = '', stderr = '';
        p.stdout?.on('data', (b) => stdout += b.toString());
        p.stderr?.on('data', (b) => stderr += b.toString());
        p.on('close', (code) => resolve({ stdout: stdout.slice(0, 20_000), stderr: stderr.slice(0, 20_000), code: code ?? -1 }));
      });
    },
  });
}
```

- [ ] **Step 4: Implement** `agent/src/tools/builtin/file-ops.ts`:

```ts
import { tool } from 'ai';
import { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';

export function makeFileOpsTools(rootDir: string) {
  const root = path.resolve(rootDir);
  const safe = (p: string) => {
    const abs = path.resolve(root, p);
    if (!abs.startsWith(root + path.sep) && abs !== root) throw new Error('path escape');
    return abs;
  };
  return {
    fs_read: tool({
      description: 'Read a UTF-8 file from the sandbox.',
      parameters: z.object({ path: z.string() }),
      execute: async ({ path: p }) => ({ content: await fs.readFile(safe(p), 'utf8') }),
    }),
    fs_write: tool({
      description: 'Write a UTF-8 file in the sandbox.',
      parameters: z.object({ path: z.string(), content: z.string() }),
      execute: async ({ path: p, content }) => {
        const abs = safe(p);
        await fs.mkdir(path.dirname(abs), { recursive: true });
        await fs.writeFile(abs, content, 'utf8');
        return { ok: true };
      },
    }),
    fs_list: tool({
      description: 'List sandbox files.',
      parameters: z.object({ dir: z.string().default('.') }),
      execute: async ({ dir }) => ({ entries: await fs.readdir(safe(dir)) }),
    }),
  };
}
```

- [ ] **Step 5: Commit** — `feat(agent): built-in tools`.

### Task 6.2: MCP client

**Files:**
- Create: `agent/src/tools/mcp-client.ts`

- [ ] **Step 1: Implement**:

```ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { tool, type Tool } from 'ai';
import { z } from 'zod';
import { log } from '../util/logger.js';
import type { McpJson } from '../config/schema.js';

export interface McpHandle { id: string; client: Client; tools: Record<string, Tool>; close(): Promise<void>; }

export async function startMcpServers(mcp: McpJson): Promise<McpHandle[]> {
  const handles: McpHandle[] = [];
  for (const [id, cfg] of Object.entries(mcp.servers)) {
    if (!cfg.enabled) continue;
    try {
      const transport = new StdioClientTransport({ command: cfg.command, args: cfg.args, env: { ...process.env, ...cfg.env } as any });
      const client = new Client({ name: 'ember-agent', version: '0.1.0' }, { capabilities: {} });
      await client.connect(transport);
      const list = await client.listTools();
      const tools: Record<string, Tool> = {};
      for (const t of list.tools) {
        tools[`mcp_${id}_${t.name}`] = tool({
          description: t.description ?? `${id}.${t.name}`,
          parameters: z.any(),
          execute: async (args: any) => {
            const res = await client.callTool({ name: t.name, arguments: args });
            return res;
          },
        });
      }
      handles.push({ id, client, tools, close: async () => { await client.close(); } });
      log.info({ id, count: list.tools.length }, 'mcp server connected');
    } catch (e) { log.warn({ err: e, id }, 'mcp server failed'); }
  }
  return handles;
}
```

- [ ] **Step 2: Commit** — `feat(agent): mcp client`.

### Task 6.3: Tool registry

**Files:**
- Create: `agent/src/tools/registry.ts`

- [ ] **Step 1: Implement**:

```ts
import type { Tool } from 'ai';
import type { AgentConfig } from '../config/schema.js';
import { webFetchTool } from './builtin/web-fetch.js';
import { makeWebSearchTool } from './builtin/web-search.js';
import { makeCodeExecTool } from './builtin/code-exec.js';
import { makeFileOpsTools } from './builtin/file-ops.js';
import type { McpHandle } from './mcp-client.js';

export function buildToolRegistry(cfg: AgentConfig, mcpHandles: McpHandle[]): Record<string, Tool> {
  const tools: Record<string, Tool> = {};
  const b = cfg.tools.builtin;
  if (b.webFetch.enabled) tools.web_fetch = webFetchTool;
  if (b.webSearch.enabled) {
    const k = process.env[b.webSearch.apiKeyEnv];
    if (k) tools.web_search = makeWebSearchTool(b.webSearch.provider, k);
  }
  if (b.codeExec.enabled) tools.code_exec = makeCodeExecTool(b.codeExec.timeoutMs);
  if (b.fileOps.enabled) Object.assign(tools, makeFileOpsTools(b.fileOps.rootDir));
  for (const h of mcpHandles) Object.assign(tools, h.tools);
  return tools;
}
```

- [ ] **Step 2: Commit** — `feat(agent): tool registry`.

---

## Phase 7: Prompt builder + session

### Task 7.1: Prompt builder

**Files:**
- Create: `agent/src/runtime/prompt-builder.ts`
- Create: `agent/test/prompt-builder.test.ts`

- [ ] **Step 1: Failing test**:

```ts
import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '../src/runtime/prompt-builder.js';

describe('buildSystemPrompt', () => {
  it('composes SOUL, AGENTS, skills XML, memory', () => {
    const s = buildSystemPrompt({
      agentName: 'Ember',
      soul: 'Be terse.',
      agents: 'Ask before destructive ops.',
      skills: [{ name: 'sample', description: 'sample skill', location: '/skills/sample' } as any],
      memorySnippets: ['previous: hello'],
    });
    expect(s).toContain('You are Ember');
    expect(s).toContain('<soul>');
    expect(s).toContain('Be terse.');
    expect(s).toContain('<operating_rules>');
    expect(s).toContain('Ask before destructive ops.');
    expect(s).toContain('<available_skills>');
    expect(s).toContain('sample');
    expect(s).toContain('<memory_context>');
    expect(s).toContain('previous: hello');
  });
});
```

- [ ] **Step 2: Implement** `agent/src/runtime/prompt-builder.ts`:

```ts
import type { SkillRecord } from '../skills/loader.js';

export interface BuildArgs {
  agentName: string;
  soul: string;
  agents: string;
  skills: SkillRecord[];
  memorySnippets: string[];
}

export function buildSystemPrompt(a: BuildArgs): string {
  const skillsXml = a.skills.map(s =>
    `<skill>\n  <name>${escapeXml(s.name)}</name>\n  <description>${escapeXml(s.description)}</description>\n  <location>${escapeXml((s as any).dir ?? (s as any).location ?? '')}</location>\n</skill>`
  ).join('\n');

  return `You are ${a.agentName}.

<soul>
${a.soul.trim()}
</soul>

<operating_rules>
${a.agents.trim()}
</operating_rules>

<available_skills>
${skillsXml}
</available_skills>

<memory_context>
${a.memorySnippets.join('\n')}
</memory_context>`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' } as any)[c]);
}
```

- [ ] **Step 3: PASS, commit** — `feat(agent): prompt builder`.

### Task 7.2: Session manager

**Files:**
- Create: `agent/src/runtime/session.ts`

- [ ] **Step 1: Implement**:

```ts
import type { MemoryStore } from '../memory/store.js';
import type { CoreMessage } from 'ai';

export interface SessionKey { channel: string; chatId: string; topic?: string; }

export class SessionManager {
  constructor(private store: MemoryStore, private compactAfter: number) {}

  load(key: SessionKey): { sessionId: number; history: CoreMessage[] } {
    const sid = this.store.getOrCreateSession(key.channel, key.chatId, key.topic ?? '');
    const msgs = this.store.recentMessages(sid, 200);
    const history: CoreMessage[] = msgs.map(m => ({ role: m.role as any, content: m.content }));
    return { sessionId: sid, history };
  }

  append(sessionId: number, role: 'user' | 'assistant' | 'tool' | 'system', content: string) {
    this.store.appendMessage(sessionId, role, content);
  }

  maybeCompact(sessionId: number, tokenEstimate: number) {
    if (tokenEstimate < this.compactAfter) return;
    const total = this.store.countMessages(sessionId);
    if (total > 40) this.store.deleteOldMessages(sessionId, 20);
  }
}
```

- [ ] **Step 2: Commit** — `feat(agent): session manager`.

---

## Phase 8: Channels

### Task 8.1: Channel interface

**Files:**
- Create: `agent/src/channels/base.ts`

- [ ] **Step 1: Implement**:

```ts
export interface InboundMessage {
  channel: string;
  chatId: string;
  userId: string;
  text: string;
  raw?: unknown;
  reply: (text: string, opts?: { stream?: boolean }) => Promise<void>;
  editLast?: (text: string) => Promise<void>;
}

export interface ChannelAdapter {
  id: string;
  start(onMessage: (m: InboundMessage) => Promise<void>): Promise<void>;
  stop(): Promise<void>;
}
```

- [ ] **Step 2: Commit** — `feat(agent): channel interface`.

### Task 8.2: Web chat adapter (Hono SSE + static HTML)

**Files:**
- Create: `agent/src/channels/web.ts`
- Create: `agent/public/chat.html`
- Create: `agent/src/api/routes/chat.ts`

- [ ] **Step 1: Implement** `agent/src/channels/web.ts`:

```ts
import type { ChannelAdapter, InboundMessage } from './base.js';
import { log } from '../util/logger.js';
import { EventEmitter } from 'node:events';

export interface WebChatBus {
  enqueue(userId: string, text: string): Promise<string>;
  subscribe(streamId: string, write: (chunk: string) => void): () => void;
  finalize(streamId: string): void;
}

export class WebChatAdapter implements ChannelAdapter, WebChatBus {
  id = 'web';
  private handler?: (m: InboundMessage) => Promise<void>;
  private streams = new Map<string, { write: (chunk: string) => void; emitter: EventEmitter }>();

  async start(onMessage: (m: InboundMessage) => Promise<void>) { this.handler = onMessage; }
  async stop() { this.streams.clear(); }

  async enqueue(userId: string, text: string): Promise<string> {
    if (!this.handler) throw new Error('web adapter not started');
    const streamId = `${userId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    const emitter = new EventEmitter();
    this.streams.set(streamId, { write: () => {}, emitter });
    queueMicrotask(async () => {
      const buf: string[] = [];
      await this.handler!({
        channel: 'web',
        chatId: userId,
        userId,
        text,
        reply: async (t) => { buf.push(t); const s = this.streams.get(streamId); s?.write(t); s?.emitter.emit('done'); },
        editLast: async (t) => { const s = this.streams.get(streamId); s?.write(`\x00REPLACE\x00${t}`); },
      });
    });
    return streamId;
  }

  subscribe(streamId: string, write: (chunk: string) => void): () => void {
    const s = this.streams.get(streamId);
    if (!s) { write('error: no such stream'); return () => {}; }
    s.write = write;
    const done = () => { this.streams.delete(streamId); };
    s.emitter.once('done', done);
    return () => { this.streams.delete(streamId); };
  }
  finalize(streamId: string) { this.streams.delete(streamId); }
}
```

- [ ] **Step 2: Implement** `agent/src/api/routes/chat.ts`:

```ts
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
      const unsub = web.subscribe(id, (chunk) => { s.write(`data: ${JSON.stringify({ chunk })}\n\n`); });
      c.req.raw.signal.addEventListener('abort', () => { unsub(); });
      await new Promise<void>(() => {}); // keep open until client aborts
    });
  });

  app.use('/chat-assets/*', serveStatic({ root: publicDir }));
  return app;
}
```

- [ ] **Step 3: Implement** `agent/public/chat.html`:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Ember Chat</title>
<style>
  :root { color-scheme: dark; }
  body { font-family: ui-sans-serif, system-ui; max-width: 720px; margin: 0 auto; padding: 1rem; background:#0b0b0f; color:#eee; }
  #log { border: 1px solid #2a2a35; padding: 1rem; height: 70vh; overflow-y: auto; border-radius: 8px; background:#13131a; }
  .msg { margin: .5rem 0; padding: .5rem .75rem; border-radius: 6px; white-space: pre-wrap; }
  .user { background:#1d2a44; }
  .assistant { background:#1b2a1d; }
  form { display:flex; gap:.5rem; margin-top:.75rem; }
  input { flex:1; padding:.6rem; border-radius:6px; border:1px solid #2a2a35; background:#0e0e15; color:#eee; }
  button { padding:.6rem 1rem; border-radius:6px; border:0; background:#5b8def; color:#fff; cursor:pointer; }
</style>
</head>
<body>
<h2>Ember Chat</h2>
<div id="log"></div>
<form id="f"><input id="t" autocomplete="off" placeholder="Say something…" /><button>Send</button></form>
<script>
  const log = document.getElementById('log');
  const userId = localStorage.getItem('uid') || (Math.random().toString(36).slice(2));
  localStorage.setItem('uid', userId);
  function append(cls, text) {
    const d = document.createElement('div'); d.className = 'msg ' + cls; d.textContent = text;
    log.appendChild(d); log.scrollTop = log.scrollHeight; return d;
  }
  document.getElementById('f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('t');
    const text = input.value.trim(); if (!text) return;
    input.value = '';
    append('user', text);
    const assistantEl = append('assistant', '…');
    const r = await fetch('/chat/message', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ userId, text })});
    const { streamId } = await r.json();
    const es = new EventSource('/chat/stream/' + streamId);
    let acc = '';
    es.onmessage = (ev) => {
      try {
        const { chunk } = JSON.parse(ev.data);
        if (chunk.startsWith(' REPLACE ')) { acc = chunk.slice(9); } else { acc += chunk; }
        assistantEl.textContent = acc;
      } catch {}
    };
    es.onerror = () => es.close();
  });
</script>
</body>
</html>
```

- [ ] **Step 4: Commit** — `feat(agent): web chat adapter + HTML UI`.

### Task 8.3: Telegram adapter

**Files:**
- Create: `agent/src/channels/telegram.ts`

- [ ] **Step 1: Implement**:

```ts
import { Bot, type Context } from 'grammy';
import type { ChannelAdapter, InboundMessage } from './base.js';
import type { AgentConfig } from '../config/schema.js';
import { log } from '../util/logger.js';

export class TelegramAdapter implements ChannelAdapter {
  id = 'telegram';
  private bot?: Bot;
  constructor(private cfg: AgentConfig) {}

  async start(onMessage: (m: InboundMessage) => Promise<void>) {
    const tg = this.cfg.channels.telegram;
    if (!tg.enabled) return;
    const token = process.env[tg.tokenEnv];
    if (!token) { log.warn('Telegram enabled but token env empty; skipping'); return; }
    this.bot = new Bot(token);

    this.bot.command('help', (ctx) => ctx.reply('Commands: /help /status /skills /reset /soul'));
    this.bot.command('status', (ctx) => ctx.reply('Ember online.'));
    this.bot.command('reset', (ctx) => ctx.reply('Session reset (not yet wired).'));

    this.bot.on('message:text', async (ctx) => {
      const m = ctx.message; if (!m) return;
      const chat = ctx.chat; if (!chat) return;
      const userId = String(ctx.from?.id ?? 'unknown');
      const chatId = String(chat.id);

      if (chat.type === 'private') {
        if (tg.dmPolicy === 'disabled') return;
        if (tg.dmPolicy === 'allowlist' && !tg.allowFrom.includes(userId)) return;
      } else {
        const g = tg.groups[chatId];
        if (g?.requireMention !== false) {
          const me = await ctx.api.getMe();
          if (!m.text.includes('@' + me.username)) return;
        }
        if (g?.allowFrom?.length && !g.allowFrom.includes(userId)) return;
      }

      let preview = await ctx.reply('…');
      await onMessage({
        channel: 'telegram',
        chatId, userId,
        text: m.text,
        raw: ctx,
        reply: async (text) => {
          try { await ctx.api.editMessageText(chat.id, preview.message_id, text, { parse_mode: 'HTML' }); }
          catch { await ctx.api.editMessageText(chat.id, preview.message_id, text); }
        },
        editLast: async (text) => {
          try { await ctx.api.editMessageText(chat.id, preview.message_id, text); } catch {}
        },
      });
    });

    this.bot.start({ onStart: (info) => log.info({ username: info.username }, 'telegram bot started') });
  }

  async stop() { await this.bot?.stop(); }
}
```

- [ ] **Step 2: Commit** — `feat(agent): telegram adapter`.

---

## Phase 9: Agent runtime

### Task 9.1: AgentRuntime

**Files:**
- Create: `agent/src/runtime/agent.ts`
- Create: `agent/test/runtime.test.ts`

- [ ] **Step 1: Implement** `agent/src/runtime/agent.ts`:

```ts
import { generateText, type CoreMessage, type LanguageModelV1, type Tool } from 'ai';
import { buildSystemPrompt } from './prompt-builder.js';
import type { LoadedAgent } from '../config/loader.js';
import type { SkillRecord } from '../skills/loader.js';
import type { MemoryStore } from '../memory/store.js';
import { SessionManager } from './session.js';
import { log } from '../util/logger.js';
import type { InboundMessage } from '../channels/base.js';
import type { EmbeddingModelV1 } from 'ai';
import { embedText } from '../memory/embeddings.js';

export interface RuntimeDeps {
  loaded: LoadedAgent;
  model: LanguageModelV1;
  embedModel: EmbeddingModelV1<string> | null;
  store: MemoryStore;
  getSkills: () => SkillRecord[];
  getTools: () => Record<string, Tool>;
}

export class AgentRuntime {
  private sessions: SessionManager;
  constructor(private d: RuntimeDeps) {
    this.sessions = new SessionManager(d.store, d.loaded.config.memory.compactAfterTokens);
  }

  async handle(msg: InboundMessage): Promise<void> {
    const { sessionId, history } = this.sessions.load({ channel: msg.channel, chatId: msg.chatId });
    let memorySnippets: string[] = [];
    if (this.d.embedModel) {
      try {
        const v = await embedText(this.d.embedModel, msg.text);
        memorySnippets = this.d.store.searchVectors(v, 5).map(h => h.snippet);
      } catch (e) { log.warn({ err: e }, 'embed/search failed'); }
    }
    const system = buildSystemPrompt({
      agentName: this.d.loaded.config.name,
      soul: this.d.loaded.soul,
      agents: this.d.loaded.agents,
      skills: this.d.getSkills(),
      memorySnippets,
    });
    const messages: CoreMessage[] = [...history, { role: 'user', content: msg.text }];
    this.sessions.append(sessionId, 'user', msg.text);

    try {
      const result = await generateText({
        model: this.d.model,
        system,
        messages,
        tools: this.d.getTools(),
        maxSteps: 8,
        temperature: this.d.loaded.config.llm.temperature,
        maxTokens: this.d.loaded.config.llm.maxTokens,
      });
      const final = result.text || '(no response)';
      this.sessions.append(sessionId, 'assistant', final);
      await msg.reply(final);

      if (this.d.embedModel) {
        try {
          const v = await embedText(this.d.embedModel, msg.text + '\n' + final);
          this.d.store.indexVector(sessionId, `m:${Date.now()}`, msg.text.slice(0, 500), v);
        } catch (e) { log.warn({ err: e }, 'embed/index failed'); }
      }
      this.sessions.maybeCompact(sessionId, result.usage?.totalTokens ?? 0);
    } catch (e: any) {
      log.error({ err: e }, 'agent loop failed');
      await msg.reply(`error: ${e.message ?? String(e)}`);
    }
  }
}
```

- [ ] **Step 2: Failing test (mock model)** `agent/test/runtime.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { AgentRuntime } from '../src/runtime/agent.js';
import { MemoryStore } from '../src/memory/store.js';
import path from 'node:path';
import fs from 'node:fs';

const tmpDb = path.resolve(__dirname, '.tmp-rt.db');

const fakeModel: any = {
  specificationVersion: 'v1', provider: 'mock', modelId: 'mock', defaultObjectGenerationMode: undefined,
  async doGenerate() { return { text: 'pong', finishReason: 'stop', usage: { promptTokens: 1, completionTokens: 1 }, rawCall: { rawPrompt: null, rawSettings: {} } }; },
};

describe('AgentRuntime', () => {
  it('handles a message end-to-end with mock model', async () => {
    try { fs.unlinkSync(tmpDb); } catch {}
    const store = new MemoryStore(tmpDb);
    const rt = new AgentRuntime({
      loaded: { dir: '/tmp', config: { name: 'Mock', id: 'mock', llm: { baseUrl: 'x', model: 'm', apiKeyEnv: 'X', temperature: 0.7, maxTokens: 100 }, channels: { telegram: { enabled: false, tokenEnv: 'X', dmPolicy: 'open', allowFrom: [], groups: {} }, web: { enabled: true, path: '/chat' } }, mcp: { configFile: 'mcp.json' }, evolution: { mode: 'off', intervalHours: 24, registries: [], interests: [] }, memory: { maxSessions: 100, compactAfterTokens: 8000, vectorStorePath: 'x' }, tools: { builtin: { webSearch: { enabled: false, provider: 'tavily', apiKeyEnv: 'X' }, webFetch: { enabled: false }, codeExec: { enabled: false, timeoutMs: 1000 }, fileOps: { enabled: false, rootDir: '.' } } }, logging: { level: 'info', logDir: '.' } } as any, soul: 'terse', agents: 'rules', mcp: { servers: {} } },
      model: fakeModel,
      embedModel: null,
      store,
      getSkills: () => [],
      getTools: () => ({}),
    });
    let out = '';
    await rt.handle({ channel: 'test', chatId: 'c', userId: 'u', text: 'ping', reply: async (t) => { out = t; } } as any);
    expect(out).toBe('pong');
    store.close();
  });
});
```

- [ ] **Step 3: PASS, commit** — `feat(agent): runtime + integration test`.

---

## Phase 10: Admin HTTP API + chat routes

### Task 10.1: API server

**Files:**
- Create: `agent/src/api/server.ts`
- Create: `agent/src/api/routes/{health.ts,skills.ts,mcp.ts,config.ts,channels.ts,events.ts}`

- [ ] **Step 1: Implement** `agent/src/api/routes/health.ts`:

```ts
import { Hono } from 'hono';
export function healthRoutes() {
  const app = new Hono();
  app.get('/health', (c) => c.json({ ok: true, uptime: process.uptime() }));
  return app;
}
```

- [ ] **Step 2: Implement** `agent/src/api/routes/skills.ts`:

```ts
import { Hono } from 'hono';
import { installSkill, removeSkill } from '../../skills/installer.js';
import type { SkillRecord } from '../../skills/loader.js';

export function skillsRoutes(opts: {
  agentDir: string;
  evolutionMode: () => 'off' | 'suggest' | 'auto-safe' | 'auto-all';
  listSkills: () => SkillRecord[];
  reload: () => Promise<void>;
}) {
  const app = new Hono();
  app.get('/skills', (c) => c.json({ skills: opts.listSkills().map(s => ({ name: s.name, description: s.description, source: s.source })) }));
  app.post('/skills/install', async (c) => {
    const body = await c.req.json();
    const source = (body.source ?? 'agentskill.sh') as any;
    const res = await installSkill(opts.agentDir, source, body, opts.evolutionMode());
    if (res.ok) await opts.reload();
    return c.json(res, res.ok ? 200 : 400);
  });
  app.delete('/skills/:name', async (c) => {
    const name = c.req.param('name');
    const ok = await removeSkill(opts.agentDir, name);
    if (ok) await opts.reload();
    return c.json({ ok });
  });
  app.get('/skills/discover', (c) => c.json({ candidates: [] }));
  return app;
}
```

- [ ] **Step 3: Implement** `agent/src/api/routes/mcp.ts`:

```ts
import { Hono } from 'hono';
import fs from 'node:fs/promises';
import path from 'node:path';
import { McpJsonSchema } from '../../config/schema.js';

export function mcpRoutes(opts: { agentDir: string; restartMcp: () => Promise<void> }) {
  const app = new Hono();
  const file = path.join(opts.agentDir, 'mcp.json');
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
```

- [ ] **Step 4: Implement** `agent/src/api/routes/config.ts`:

```ts
import { Hono } from 'hono';
import type { AgentConfig } from '../../config/schema.js';

export function configRoutes(opts: { getConfig: () => AgentConfig; patch: (p: any) => Promise<void> }) {
  const app = new Hono();
  app.get('/config', (c) => {
    const cfg = JSON.parse(JSON.stringify(opts.getConfig()));
    // redact env var names (not values), just expose the shape
    return c.json(cfg);
  });
  app.patch('/config', async (c) => {
    const body = await c.req.json();
    await opts.patch(body);
    return c.json({ ok: true });
  });
  return app;
}
```

- [ ] **Step 5: Implement** `agent/src/api/routes/channels.ts`:

```ts
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
```

- [ ] **Step 6: Implement** `agent/src/api/routes/events.ts`:

```ts
import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import type { EventEmitter } from 'node:events';

export function eventsRoutes(bus: EventEmitter) {
  const app = new Hono();
  app.get('/events', (c) => stream(c, async (s) => {
    const handler = (ev: any) => s.write(`data: ${JSON.stringify(ev)}\n\n`);
    bus.on('event', handler);
    c.req.raw.signal.addEventListener('abort', () => bus.off('event', handler));
    await new Promise<void>(() => {});
  }));
  return app;
}
```

- [ ] **Step 7: Implement** `agent/src/api/server.ts`:

```ts
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { healthRoutes } from './routes/health.js';
import { skillsRoutes } from './routes/skills.js';
import { mcpRoutes } from './routes/mcp.js';
import { configRoutes } from './routes/config.js';
import { channelRoutes } from './routes/channels.js';
import { eventsRoutes } from './routes/events.js';
import { chatRoutes } from './routes/chat.js';
import type { EventEmitter } from 'node:events';
import type { WebChatAdapter } from '../channels/web.js';

export interface ApiDeps {
  agentDir: string;
  publicDir: string;
  bus: EventEmitter;
  web: WebChatAdapter;
  evolutionMode: () => any;
  listSkills: () => any;
  reload: () => Promise<void>;
  restartMcp: () => Promise<void>;
  getConfig: () => any;
  patchConfig: (p: any) => Promise<void>;
  patchTelegram: (p: any) => Promise<void>;
}

export function startApi(port: number, d: ApiDeps) {
  const app = new Hono();
  app.route('/', healthRoutes());
  app.route('/', skillsRoutes(d));
  app.route('/', mcpRoutes({ agentDir: d.agentDir, restartMcp: d.restartMcp }));
  app.route('/', configRoutes({ getConfig: d.getConfig, patch: d.patchConfig }));
  app.route('/', channelRoutes({ patchTelegram: d.patchTelegram }));
  app.route('/', eventsRoutes(d.bus));
  app.route('/', chatRoutes(d.web, d.publicDir));
  return serve({ fetch: app.fetch, port });
}
```

- [ ] **Step 8: Commit** — `feat(agent): admin api + chat routes`.

---

## Phase 11: Evolution loop

### Task 11.1: Discover/score/loop

**Files:**
- Create: `agent/src/evolution/{discover.ts,score.ts,loop.ts}`

- [ ] **Step 1: Implement** `agent/src/evolution/discover.ts`:

```ts
export interface DiscoveredSkill { slug: string; owner: string; description: string; securityScore?: number; }

export async function discover(interests: string[]): Promise<DiscoveredSkill[]> {
  const out: DiscoveredSkill[] = [];
  for (const tag of interests) {
    try {
      const r = await fetch(`https://agentskill.sh/api/search?q=${encodeURIComponent(tag)}`);
      if (!r.ok) continue;
      const data: any = await r.json();
      for (const it of data.results ?? []) {
        out.push({ slug: it.slug, owner: it.owner, description: it.description, securityScore: it.securityScore });
      }
    } catch { /* registry endpoints may change; documented in code */ }
  }
  return out;
}
```

- [ ] **Step 2: Implement** `agent/src/evolution/score.ts`:

```ts
import { generateText, type LanguageModelV1 } from 'ai';
import type { DiscoveredSkill } from './discover.js';

export async function scoreCandidates(model: LanguageModelV1, recentWork: string, items: DiscoveredSkill[]): Promise<{ skill: DiscoveredSkill; score: number; reason: string }[]> {
  const out: { skill: DiscoveredSkill; score: number; reason: string }[] = [];
  for (const s of items.slice(0, 20)) {
    const { text } = await generateText({
      model,
      system: 'Score how useful a skill would be on a 0-10 integer scale. Reply as JSON {"score": N, "reason": "..."}.',
      prompt: `Recent work summary:\n${recentWork}\n\nCandidate: ${s.owner}/${s.slug}\n${s.description}`,
      maxTokens: 200,
    });
    try {
      const j = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{}');
      out.push({ skill: s, score: Number(j.score) || 0, reason: String(j.reason || '') });
    } catch { out.push({ skill: s, score: 0, reason: 'parse failed' }); }
  }
  return out.sort((a, b) => b.score - a.score);
}
```

- [ ] **Step 3: Implement** `agent/src/evolution/loop.ts`:

```ts
import type { LanguageModelV1 } from 'ai';
import { discover } from './discover.js';
import { scoreCandidates } from './score.js';
import { installSkill } from '../skills/installer.js';
import type { AgentConfig } from '../config/schema.js';
import { log } from '../util/logger.js';

export function startEvolutionLoop(opts: {
  cfg: AgentConfig;
  agentDir: string;
  model: LanguageModelV1;
  installedSlugs: () => string[];
  recentWorkSummary: () => string;
  notifySuggest: (items: { slug: string; owner: string; description: string; score: number; securityScore?: number }[]) => Promise<void>;
  reload: () => Promise<void>;
}): () => void {
  if (opts.cfg.evolution.mode === 'off') return () => {};
  const intervalMs = opts.cfg.evolution.intervalHours * 60 * 60 * 1000;
  const tick = async () => {
    try {
      const found = await discover(opts.cfg.evolution.interests);
      const installed = new Set(opts.installedSlugs());
      const fresh = found.filter(f => !installed.has(`${f.owner}/${f.slug}`) && !installed.has(f.slug));
      if (fresh.length === 0) return;
      const scored = await scoreCandidates(opts.model, opts.recentWorkSummary(), fresh);
      const top = scored.slice(0, 3);
      if (opts.cfg.evolution.mode === 'suggest') {
        await opts.notifySuggest(top.map(t => ({ slug: t.skill.slug, owner: t.skill.owner, description: t.skill.description, score: t.score, securityScore: t.skill.securityScore })));
        return;
      }
      for (const t of top) {
        if (opts.cfg.evolution.mode === 'auto-safe' && (t.skill.securityScore ?? 0) < 80) continue;
        if (opts.cfg.evolution.mode === 'auto-all' && (t.skill.securityScore ?? 0) < 50) continue;
        const r = await installSkill(opts.agentDir, 'agentskill.sh', { slug: `${t.skill.owner}/${t.skill.slug}` }, opts.cfg.evolution.mode);
        log.info({ slug: t.skill.slug, result: r }, 'evolution install');
      }
      await opts.reload();
    } catch (e) { log.warn({ err: e }, 'evolution tick failed'); }
  };
  const handle = setInterval(tick, intervalMs);
  setTimeout(tick, 30_000).unref();
  return () => clearInterval(handle);
}
```

- [ ] **Step 4: Commit** — `feat(agent): evolution loop`.

---

## Phase 12: /learn bootstrap

### Task 12.1: Bootstrap /learn on first run

**Files:**
- Modify: `agent/src/index.ts` (boot sequence will invoke)
- Create: `agent/src/skills/bootstrap.ts`

- [ ] **Step 1: Implement** `agent/src/skills/bootstrap.ts`:

```ts
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { log } from '../util/logger.js';

const REPO = 'https://github.com/agentskill-sh/ags.git';
const RAW_SKILL_URL = 'https://raw.githubusercontent.com/agentskill-sh/ags/main/SKILL.md';

export async function ensureLearnSkill(agentDir: string): Promise<void> {
  const dir = path.join(agentDir, 'skills', 'learn');
  try { await fs.access(path.join(dir, 'SKILL.md')); return; } catch {}
  await fs.mkdir(path.join(agentDir, 'skills'), { recursive: true });
  try {
    await new Promise<void>((resolve, reject) => {
      const p = spawn('git', ['clone', '--depth', '1', REPO, dir], { stdio: 'inherit' });
      p.on('exit', (c) => c === 0 ? resolve() : reject(new Error(`git clone exit ${c}`)));
      p.on('error', reject);
    });
    log.info('Installed /learn skill from agentskill.sh — agent can now search and install skills autonomously.');
  } catch (e) {
    log.warn({ err: e }, 'git clone failed; falling back to HTTPS SKILL.md fetch');
    try {
      const r = await fetch(RAW_SKILL_URL);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, 'SKILL.md'), await r.text());
      log.info('Installed /learn SKILL.md via HTTPS.');
    } catch (e2) { log.error({ err: e2 }, '/learn bootstrap failed; continuing without it'); }
  }
}
```

- [ ] **Step 2: Commit** — `feat(agent): /learn bootstrap`.

---

## Phase 13: Entrypoint wiring

### Task 13.1: index.ts boot sequence

**Files:**
- Create: `agent/src/index.ts`

- [ ] **Step 1: Implement**:

```ts
import 'dotenv/config';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { loadAgent } from './config/loader.js';
import { createChatModel, createEmbeddingModel } from './runtime/llm-client.js';
import { MemoryStore } from './memory/store.js';
import { loadSkills, watchSkills, type SkillRecord } from './skills/loader.js';
import { startMcpServers, type McpHandle } from './tools/mcp-client.js';
import { buildToolRegistry } from './tools/registry.js';
import { AgentRuntime } from './runtime/agent.js';
import { WebChatAdapter } from './channels/web.js';
import { TelegramAdapter } from './channels/telegram.js';
import { startApi } from './api/server.js';
import { ensureLearnSkill } from './skills/bootstrap.js';
import { startEvolutionLoop } from './evolution/loop.js';
import { log } from './util/logger.js';

async function main() {
  const agentDirArg = process.argv[2] ?? process.env.AGENT_DIR ?? './examples/default-agent';
  const agentDir = path.resolve(agentDirArg);
  log.info({ agentDir }, 'boot');

  const loaded = await loadAgent(agentDir);

  await ensureLearnSkill(agentDir);

  let skills = await loadSkills(agentDir);
  const reloadSkills = async () => { skills = await loadSkills(agentDir); log.info({ count: skills.length }, 'skills reloaded'); };
  const stopWatcher = watchSkills(agentDir, () => { reloadSkills(); });

  let mcpHandles: McpHandle[] = await startMcpServers(loaded.mcp);
  const restartMcp = async () => {
    for (const h of mcpHandles) await h.close();
    mcpHandles = await startMcpServers(loaded.mcp);
  };

  const model = createChatModel(loaded.config);
  const embedModel = createEmbeddingModel(loaded.config);

  const store = new MemoryStore(path.resolve(agentDir, loaded.config.memory.vectorStorePath));
  const bus = new EventEmitter();

  const runtime = new AgentRuntime({
    loaded, model, embedModel, store,
    getSkills: () => skills,
    getTools: () => buildToolRegistry(loaded.config, mcpHandles),
  });

  const web = new WebChatAdapter();
  await web.start((m) => runtime.handle(m));

  const telegram = new TelegramAdapter(loaded.config);
  telegram.start((m) => runtime.handle(m)).catch((e) => log.error({ err: e }, 'telegram start failed'));

  const port = Number(process.env.AGENT_API_PORT ?? 7777);
  const publicDir = path.resolve(new URL('../public', import.meta.url).pathname);

  const stopEvolution = startEvolutionLoop({
    cfg: loaded.config,
    agentDir,
    model,
    installedSlugs: () => skills.map(s => s.source ? `${s.source.owner}/${s.source.slug}` : s.name),
    recentWorkSummary: () => `Agent ${loaded.config.name} with skills: ${skills.map(s => s.name).join(', ')}`,
    notifySuggest: async (items) => { log.info({ items }, 'evolution suggestions'); bus.emit('event', { type: 'evolution.suggest', items }); },
    reload: reloadSkills,
  });

  const server = startApi(port, {
    agentDir,
    publicDir,
    bus,
    web,
    evolutionMode: () => loaded.config.evolution.mode,
    listSkills: () => skills,
    reload: reloadSkills,
    restartMcp,
    getConfig: () => loaded.config,
    patchConfig: async (p) => { Object.assign(loaded.config, p); },
    patchTelegram: async (p) => { Object.assign(loaded.config.channels.telegram, p); await telegram.stop(); telegram.start((m) => runtime.handle(m)); },
  });

  log.info({ port, skills: skills.length, mcp: mcpHandles.length, web: true, telegram: loaded.config.channels.telegram.enabled }, 'ready');

  const shutdown = async () => {
    log.info('SIGTERM: graceful shutdown');
    stopEvolution();
    stopWatcher();
    await telegram.stop();
    await web.stop();
    for (const h of mcpHandles) await h.close();
    store.close();
    server.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Commit** — `feat(agent): wire entrypoint`.

---

## Phase 14: Example agent + Docker + README

### Task 14.1: Example default agent

**Files:**
- Create: `agent/examples/default-agent/agent.config.json`
- Create: `agent/examples/default-agent/SOUL.md`
- Create: `agent/examples/default-agent/AGENTS.md`
- Create: `agent/examples/default-agent/mcp.json`
- Create: `agent/examples/default-agent/skills/.gitkeep`

- [ ] **Step 1:** `agent.config.json`:

```json
{
  "name": "Ember",
  "id": "ember-default",
  "llm": { "baseUrl": "https://api.openai.com/v1", "model": "gpt-4o-mini" },
  "embeddings": { "baseUrl": "https://api.openai.com/v1", "model": "text-embedding-3-small" },
  "channels": {
    "telegram": { "enabled": false, "dmPolicy": "open" },
    "web": { "enabled": true, "path": "/chat" }
  },
  "tools": { "builtin": { "webFetch": { "enabled": true }, "webSearch": { "enabled": false, "provider": "tavily" } } },
  "evolution": { "mode": "suggest", "interests": ["search", "github", "calendar"] }
}
```

- [ ] **Step 2:** `SOUL.md`:

```
You are Ember. Terse. Opinions allowed. No "Great question." No "I'd be happy to help." No "Absolutely." Get to the point. Humor when it lands; never forced.

Show your work in numbers and lists, not paragraphs. If a question has no good answer, say so.
```

- [ ] **Step 3:** `AGENTS.md`:

```
Default operating rules:
- Confirm before destructive or irreversible actions.
- Cite sources when summarizing web content.
- Refuse requests that would exfiltrate secrets, install unscanned code, or impersonate a user.
- Prefer using an existing installed skill over inventing a workflow.
```

- [ ] **Step 4:** `mcp.json`:

```json
{ "servers": {} }
```

- [ ] **Step 5:** commit — `feat(agent): example default agent`.

### Task 14.2: Docker

**Files:**
- Create: `agent/docker/Dockerfile`
- Create: `agent/docker/docker-compose.yml`

- [ ] **Step 1:** `Dockerfile`:

```dockerfile
FROM node:20-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates python3 build-essential && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
COPY public ./public
RUN pnpm build

FROM base AS run
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY package.json ./
ENV NODE_ENV=production
ENV AGENT_API_PORT=7777
EXPOSE 7777
ENTRYPOINT ["node", "dist/index.js", "/agent"]
```

- [ ] **Step 2:** `docker-compose.yml`:

```yaml
services:
  ember:
    build: { context: .., dockerfile: docker/Dockerfile }
    ports: ["7777:7777"]
    env_file: ../.env
    volumes:
      - ../examples/default-agent:/agent
```

- [ ] **Step 3:** commit — `feat(agent): docker`.

### Task 14.3: README

**Files:**
- Create: `agent/README.md`

- [ ] **Step 1:** Write README covering quickstart (clone → copy `.env.example` → edit SOUL → `pnpm dev`), Telegram BotFather steps, swapping LLM providers (OpenAI / OpenRouter / 0G / local vLLM by env vars), web chat at `http://localhost:7777/chat`, adding/removing skills (API + filesystem), adding MCP servers, security warning about `evolution.mode = auto-all`, and SOUL.md vs AGENTS.md distinction.

- [ ] **Step 2:** commit — `docs(agent): readme`.

---

## Phase 15: Tests for Telegram + final pass

### Task 15.1: Telegram adapter test

**Files:**
- Create: `agent/test/channel-telegram.test.ts`

- [ ] **Step 1:** Use grammy's `Bot.testMode` or mock `ctx.api` to verify allowFrom DM enforcement and editMessageText streaming. Keep test focused on policy gating, not network.

```ts
import { describe, it, expect, vi } from 'vitest';
import { TelegramAdapter } from '../src/channels/telegram.js';

describe('TelegramAdapter', () => {
  it('does not start when disabled', async () => {
    const cfg: any = { channels: { telegram: { enabled: false, tokenEnv: 'NONE', dmPolicy: 'open', allowFrom: [], groups: {} } } };
    const a = new TelegramAdapter(cfg);
    await a.start(async () => {});
    expect(true).toBe(true);
  });

  it('does not start when token env is missing', async () => {
    delete process.env.TG_TEST_NOPE;
    const cfg: any = { channels: { telegram: { enabled: true, tokenEnv: 'TG_TEST_NOPE', dmPolicy: 'open', allowFrom: [], groups: {} } } };
    const a = new TelegramAdapter(cfg);
    await a.start(async () => {});
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2:** Run `pnpm test` — all suites pass.
- [ ] **Step 3:** commit — `test(agent): telegram adapter`.

### Task 15.2: Full smoke

- [ ] **Step 1:** `pnpm typecheck && pnpm test`.
- [ ] **Step 2:** `pnpm dev` (set LLM_API_KEY first); browse to `http://localhost:7777/chat`; send "ping"; confirm a response renders.
- [ ] **Step 3:** Final commit if anything was tweaked: `chore(agent): smoke-test fixes`.

---

## Self-Review Notes

- **Spec coverage:** config schema (1.1), config loader (1.2), SOUL/AGENTS load (1.2), LLM client (3.1), memory + sqlite-vec (4.1), security scanner (5.1), skill loader + ags header (5.2), skill installer with three registries (5.3), built-in tools incl. file-ops sandbox (6.1), MCP child processes (6.2), tool registry (6.3), prompt builder XML format (7.1), session + compaction (7.2), channel interface (8.1), Telegram adapter w/ dmPolicy + group mention + edit-message streaming (8.3), web chat adapter + HTML page (8.2), agent loop with maxSteps tool calling (9.1), admin API: skills/mcp/config/channels/health/events (10.1), web chat routes in same API (10.1), evolution discover+score+loop with mode gating (11.1), /learn bootstrap (12.1), wiring + SIGTERM (13.1), example default-agent fixture (14.1), Docker (14.2), README (14.3), tests sprinkled across config/scanner/memory/prompt-builder/runtime/telegram.
- **Out of scope per spec:** voice/LiveKit, web UI beyond the simple chat page (BonFire owns), auth on admin API, multi-agent in-process, Honcho/QMD/LanceDB, WhatsApp/Discord (interface present, no impl).
- **Risks called out in README:** evolution.mode=auto-all supply chain risk; unbounded memory mitigated via compaction; per-agent Telegram rate limits; MCP child resource use.
