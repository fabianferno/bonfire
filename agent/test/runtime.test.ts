import { describe, it, expect } from 'vitest';
import { MockLanguageModelV1 } from 'ai/test';
import { AgentRuntime } from '../src/runtime/agent.js';
import { MemoryStore } from '../src/memory/store.js';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tmpDb = path.resolve(__dirname, '.tmp-rt.db');

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
});
