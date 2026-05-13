import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStore } from '../src/memory/store.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tmp = path.resolve(__dirname, '.tmp-mem.db');

describe('MemoryStore', () => {
  beforeEach(() => { try { fs.unlinkSync(tmp); } catch {} });

  it('persists session messages', () => {
    const m = new MemoryStore(tmp, 8);
    const sid = m.getOrCreateSession('web', 'u1');
    m.appendMessage(sid, 'user', 'hello');
    m.appendMessage(sid, 'assistant', 'hi');
    const msgs = m.recentMessages(sid, 10);
    expect(msgs.length).toBe(2);
    expect(msgs[0].content).toBe('hello');
    m.close();
  });

  it('vector search returns inserted vector', () => {
    const m = new MemoryStore(tmp, 8);
    const sid = m.getOrCreateSession('web', 'u1');
    const vec = new Float32Array(8).fill(0); vec[0] = 1;
    m.indexVector(sid, 'msg-1', 'hello world', vec);
    const hits = m.searchVectors(vec, 5);
    expect(hits.length).toBeGreaterThan(0);
    m.close();
  });
});
