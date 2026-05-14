/**
 * Tests for the INFT authorization gate in backend/src/agents/invoker.ts
 *
 * Covers:
 *  - isInvocationAllowed: authorized → true
 *  - isInvocationAllowed: unauthorized → false
 *  - Public-mode agent → true without hitting chain
 *  - Legacy agent (no tokenId) → true without hitting chain
 *  - Auth cache: second call within 60s skips chain read
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import { isInvocationAllowed, invalidateAuthCache } from '../src/agents/invoker.js';
import type { InftDeps } from '../src/agents/invoker.js';
import type { AgentDoc } from '../src/db/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAgent(overrides: Partial<AgentDoc> = {}): AgentDoc {
  return {
    _id: new ObjectId(),
    name: 'Test Agent',
    slug: 'test-agent',
    avatarUrl: null,
    description: 'test',
    bio: null,
    tags: [],
    baseUrl: 'http://localhost:7777',
    visibility: 'public',
    agentKeyHash: null,
    createdBy: new ObjectId(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as AgentDoc;
}

function makeDeps(isAuthorizedResult: boolean): InftDeps {
  return {
    inft: {
      isAuthorized: vi.fn().mockResolvedValue(isAuthorizedResult),
    } as unknown as InftDeps['inft'],
    storage: {
      fetch: vi.fn(),
      upload: vi.fn(),
    } as unknown as InftDeps['storage'],
    platformExecutorPrivkey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  };
}

const SERVER_WALLET = '0xaAbBcCdDeEfF0011223344556677889900aAbBcC';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Bust auth cache between tests by invalidating any tokenId that might be cached
  // (we use token IDs '1' and '99' in tests below)
  invalidateAuthCache('1', SERVER_WALLET);
  invalidateAuthCache('99', SERVER_WALLET);
});

describe('isInvocationAllowed', () => {
  it('mock isAuthorized returns true → isInvocationAllowed returns true', async () => {
    const deps = makeDeps(true);
    const agent = makeAgent({ tokenId: '1', mode: 'permissioned' });

    const result = await isInvocationAllowed(agent, SERVER_WALLET, deps);

    expect(result).toBe(true);
    expect(deps.inft.isAuthorized).toHaveBeenCalledOnce();
    expect(deps.inft.isAuthorized).toHaveBeenCalledWith(BigInt('1'), SERVER_WALLET);
  });

  it('mock isAuthorized returns false → isInvocationAllowed returns false', async () => {
    const deps = makeDeps(false);
    const agent = makeAgent({ tokenId: '1', mode: 'permissioned' });

    const result = await isInvocationAllowed(agent, SERVER_WALLET, deps);

    expect(result).toBe(false);
    expect(deps.inft.isAuthorized).toHaveBeenCalledOnce();
  });

  it('public-mode INFT agent → returns true without hitting chain', async () => {
    const deps = makeDeps(false); // would return false if called, but shouldn't be called
    const agent = makeAgent({ tokenId: '1', mode: 'public' });

    const result = await isInvocationAllowed(agent, SERVER_WALLET, deps);

    expect(result).toBe(true);
    expect(deps.inft.isAuthorized).not.toHaveBeenCalled();
  });

  it('legacy agent (no tokenId) → returns true without hitting chain', async () => {
    const deps = makeDeps(false); // would return false if called, but shouldn't be called
    const agent = makeAgent({ tokenId: undefined, mode: undefined });

    const result = await isInvocationAllowed(agent, SERVER_WALLET, deps);

    expect(result).toBe(true);
    expect(deps.inft.isAuthorized).not.toHaveBeenCalled();
  });

  it('cache: second call within 60s returns cached result without hitting chain again', async () => {
    const deps = makeDeps(true);
    const agent = makeAgent({ tokenId: '99', mode: 'permissioned' });

    // First call — hits chain and populates cache
    const first = await isInvocationAllowed(agent, SERVER_WALLET, deps);
    expect(deps.inft.isAuthorized).toHaveBeenCalledOnce();
    expect(first).toBe(true);

    // Second call — should return cached value without a second chain read
    const second = await isInvocationAllowed(agent, SERVER_WALLET, deps);
    expect(second).toBe(true);
    // isAuthorized still called only once — the second result came from cache
    expect(deps.inft.isAuthorized).toHaveBeenCalledOnce();
  });

  it('invalidateAuthCache clears specific entry so next call hits chain again', async () => {
    const deps = makeDeps(true);
    const agent = makeAgent({ tokenId: '99', mode: 'permissioned' });

    // Populate cache
    await isInvocationAllowed(agent, SERVER_WALLET, deps);
    expect(deps.inft.isAuthorized).toHaveBeenCalledOnce();

    // Invalidate the cached entry (simulates UsageRevoked chain event)
    invalidateAuthCache('99', SERVER_WALLET);

    // Next call should re-query chain
    await isInvocationAllowed(agent, SERVER_WALLET, deps);
    expect(deps.inft.isAuthorized).toHaveBeenCalledTimes(2);
  });

  it('cache key is case-insensitive for serverWallet', async () => {
    const deps = makeDeps(true);
    const agent = makeAgent({ tokenId: '99', mode: 'permissioned' });

    // Call with lowercase wallet
    await isInvocationAllowed(agent, SERVER_WALLET.toLowerCase(), deps);
    expect(deps.inft.isAuthorized).toHaveBeenCalledOnce();

    // Call with uppercase wallet — same cache entry should be hit
    await isInvocationAllowed(agent, SERVER_WALLET.toUpperCase(), deps);
    expect(deps.inft.isAuthorized).toHaveBeenCalledOnce(); // still only 1 call
  });
});
