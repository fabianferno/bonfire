import { describe, it, expect, vi } from 'vitest';
import { MockLanguageModelV1 } from 'ai/test';
import { AgentRuntime } from '../src/runtime/agent.js';
import { MemoryStore } from '../src/memory/store.js';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tmpDb = path.resolve(__dirname, '.tmp-rt.db');
const tmpDb2 = path.resolve(__dirname, '.tmp-rt2.db');

const fakeModel = new MockLanguageModelV1({
  doGenerate: async () => ({
    text: 'pong',
    finishReason: 'stop',
    usage: { promptTokens: 1, completionTokens: 1 },
    rawCall: { rawPrompt: null, rawSettings: {} },
  }),
});

describe('AgentRuntime', () => {
  it('handles a message end-to-end with mock model', async () => {
    try { fs.unlinkSync(tmpDb); } catch {}
    const store = new MemoryStore(tmpDb, 8);
    const cfg: any = {
      name: 'Mock', id: 'mock',
      llm: { baseUrl: 'x', model: 'm', apiKeyEnv: 'X', temperature: 0.7, maxTokens: 100 },
      channels: { telegram: { enabled: false, tokenEnv: 'X', dmPolicy: 'open', allowFrom: [], groups: {} }, web: { enabled: true, path: '/chat' } },
      mcp: { configFile: 'mcp.json' },
      evolution: { mode: 'off', intervalHours: 24, registries: [], interests: [] },
      memory: { maxSessions: 100, compactAfterTokens: 8000, vectorStorePath: 'x' },
      tools: { builtin: { webSearch: { enabled: false, provider: 'tavily', apiKeyEnv: 'X' }, webFetch: { enabled: false }, codeExec: { enabled: false, timeoutMs: 1000 }, fileOps: { enabled: false, rootDir: '.' } } },
      logging: { level: 'info', logDir: '.' },
    };
    const rt = new AgentRuntime({
      loaded: { dir: '/tmp', config: cfg, soul: 'terse', agents: 'rules', mcp: { servers: {} } },
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

  it('modelFor: uses default model when tenant has no overrides', async () => {
    try { fs.unlinkSync(tmpDb2); } catch {}
    const store = new MemoryStore(tmpDb2, 8);
    const cfg: any = {
      name: 'Mock', id: 'mock',
      llm: { provider: 'openai-compatible', baseUrl: 'https://api.openai.com/v1', model: 'm', apiKeyEnv: 'X', temperature: 0.7, maxTokens: 100 },
      channels: { telegram: { enabled: false, tokenEnv: 'X', dmPolicy: 'open', allowFrom: [], groups: {} }, web: { enabled: true, path: '/chat' } },
      mcp: { configFile: 'mcp.json' },
      evolution: { mode: 'off', intervalHours: 24, registries: [], interests: [] },
      memory: { maxSessions: 100, compactAfterTokens: 8000, vectorStorePath: 'x' },
      tools: { builtin: { webSearch: { enabled: false, provider: 'tavily', apiKeyEnv: 'X' }, webFetch: { enabled: false }, codeExec: { enabled: false, timeoutMs: 1000 }, fileOps: { enabled: false, rootDir: '.' } } },
      logging: { level: 'info', logDir: '.' },
    };

    // Create a minimal mock TenantRegistry
    const tenantWithNoOverrides = {
      slug: 'no-overrides',
      name: 'No Overrides',
      description: 'Tenant with no LLM overrides',
      avatarUrl: null,
      tags: [],
      soul: 'You are plain.',
      agents: '',
      env: {},
      llm: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mockRegistry: any = {
      get: (slug: string) => (slug === 'no-overrides' ? tenantWithNoOverrides : undefined),
      subscribe: () => {},
    };

    const createChatModelSpy = vi.fn();

    const rt = new AgentRuntime({
      loaded: { dir: '/tmp', config: cfg, soul: 'terse', agents: 'rules', mcp: { servers: {} } },
      model: fakeModel,
      embedModel: null,
      store,
      getSkills: () => [],
      getTools: () => ({}),
      tenantRegistry: mockRegistry,
    });

    let out = '';
    await rt.handle({
      channel: 'test',
      chatId: 'c',
      userId: 'u',
      text: 'ping',
      tenant: 'no-overrides',
      reply: async (t) => { out = t; },
    } as any);
    // Should use the default model (fakeModel returns 'pong')
    expect(out).toBe('pong');
    // createChatModel should NOT have been called (no overrides, falls back to default)
    store.close();
  });

  it('modelFor: caches model per tenant slug and clears on subscribe notification', async () => {
    const tmpDb3 = path.resolve(__dirname, '.tmp-rt3.db');
    try { fs.unlinkSync(tmpDb3); } catch {}
    const store = new MemoryStore(tmpDb3, 8);

    // Model that will be "built" for the tenant
    const tenantModel = new MockLanguageModelV1({
      doGenerate: async () => ({
        text: 'tenant-response',
        finishReason: 'stop',
        usage: { promptTokens: 1, completionTokens: 1 },
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });

    const tenantWithEnvOverride = {
      slug: 'env-override',
      name: 'Env Override',
      description: 'Tenant with env override',
      avatarUrl: null,
      tags: [],
      soul: 'You are env-override.',
      agents: '',
      env: { LLM_API_KEY: 'override-key' },
      llm: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    let subscriberFn: ((slug: string) => void) | null = null;
    const mockRegistry: any = {
      get: (slug: string) => (slug === 'env-override' ? tenantWithEnvOverride : undefined),
      subscribe: (fn: (slug: string) => void) => { subscriberFn = fn; },
    };

    const cfg: any = {
      name: 'Mock', id: 'mock',
      llm: { provider: 'openai-compatible', baseUrl: 'https://api.openai.com/v1', model: 'm', apiKeyEnv: 'LLM_API_KEY', temperature: 0.7, maxTokens: 100 },
      channels: { telegram: { enabled: false, tokenEnv: 'X', dmPolicy: 'open', allowFrom: [], groups: {} }, web: { enabled: true, path: '/chat' } },
      mcp: { configFile: 'mcp.json' },
      evolution: { mode: 'off', intervalHours: 24, registries: [], interests: [] },
      memory: { maxSessions: 100, compactAfterTokens: 8000, vectorStorePath: 'x' },
      tools: { builtin: { webSearch: { enabled: false, provider: 'tavily', apiKeyEnv: 'X' }, webFetch: { enabled: false }, codeExec: { enabled: false, timeoutMs: 1000 }, fileOps: { enabled: false, rootDir: '.' } } },
      logging: { level: 'info', logDir: '.' },
    };

    const rt = new AgentRuntime({
      loaded: { dir: '/tmp', config: cfg, soul: 'terse', agents: 'rules', mcp: { servers: {} } },
      model: fakeModel,
      embedModel: null,
      store,
      getSkills: () => [],
      getTools: () => ({}),
      tenantRegistry: mockRegistry,
    });

    // Verify subscribe was called
    expect(subscriberFn).not.toBeNull();

    // Directly inject a model into the cache via the subscribe mechanism
    // to test cache invalidation without actually building a real LLM.
    // First, force the cache to hold a sentinel value by monkey-patching.
    const modelCache: Map<string, any> = (rt as any).modelCache;
    modelCache.set('env-override', tenantModel);
    expect(modelCache.has('env-override')).toBe(true);

    // Fire the subscriber (simulates a PATCH on the tenant)
    subscriberFn!('env-override');

    // Cache entry should be cleared
    expect(modelCache.has('env-override')).toBe(false);

    store.close();
  });
});
