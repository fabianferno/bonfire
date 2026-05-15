/**
 * 0G Compute → OpenAI-compatible proxy.
 *
 * The Python Pipecat bot uses `OpenAILLMService` and needs an
 * OpenAI-shaped chat-completions endpoint. The 0G Compute broker SDK is
 * Node-only — so this proxy:
 *   1. Lazily initialises the broker against `STORAGE_UPLOADER_PRIVATE_KEY`
 *      (the same wallet that pays for storage; reused for inference).
 *   2. Picks a chat-capable service (honouring `OG_BROKER_PROVIDER` if set).
 *   3. Forwards every POST /chat/completions request to that service's
 *      `<endpoint>/v1/proxy/chat/completions`, injecting per-request signed
 *      headers from `broker.inference.getRequestHeaders()`.
 *   4. Streams the response back unchanged (SSE-compatible for Pipecat).
 *
 * Mirrors the working pattern in `agent/src/runtime/llm-client.ts`.
 */

import type { Context, Hono } from 'hono';
import { ethers } from 'ethers';
import { log } from '../util/logger.js';

interface PickedService {
  provider: string;
  url: string;
  model: string;
}

interface OgLlmProxyState {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  broker: any;
  picked: PickedService;
}

let initPromise: Promise<OgLlmProxyState | null> | null = null;
let initFailedReason: string | null = null;

async function loadBroker(): Promise<{ createZGComputeNetworkBroker: (wallet: ethers.Wallet) => Promise<unknown> }> {
  const { createRequire } = await import('node:module');
  const req = createRequire(import.meta.url);
  return req('@0glabs/0g-serving-broker');
}

async function initProxy(): Promise<OgLlmProxyState | null> {
  const privateKey = process.env.STORAGE_UPLOADER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
  const rpcUrl = process.env.OG_RPC_URL ?? 'https://evmrpc-testnet.0g.ai';
  if (!privateKey) {
    initFailedReason = 'no private key (STORAGE_UPLOADER_PRIVATE_KEY or DEPLOYER_PRIVATE_KEY)';
    return null;
  }
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  log.info({ address: wallet.address }, '0G LLM proxy: initialising broker');
  const { createZGComputeNetworkBroker } = await loadBroker();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const broker: any = await createZGComputeNetworkBroker(wallet as any);

  // Ensure ledger exists
  try { await broker.ledger.getLedger(); }
  catch {
    const balanceWei = await provider.getBalance(wallet.address);
    const balanceOg = Number(ethers.formatEther(balanceWei));
    const reserve = 0.2;
    const amount = Math.max(balanceOg - reserve, 0);
    if (amount < 3) {
      initFailedReason = `0G ledger requires min 3 OG; ${wallet.address} has ${balanceOg.toFixed(4)} OG`;
      log.error({ wallet: wallet.address, balanceOg }, '0G LLM proxy: insufficient balance for ledger');
      return null;
    }
    log.info({ wallet: wallet.address, amount }, '0G LLM proxy: creating ledger');
    await broker.ledger.addLedger(amount);
  }

  // Pick a chat-capable service
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const services: any[] = await broker.inference.listService();
  const chat = services.filter((s) => s.serviceType === 'chatbot' || s.serviceType === 'chat');
  if (!chat.length) {
    initFailedReason = '0G Compute: no chat services available';
    return null;
  }

  const preferred = (process.env.OG_BROKER_PROVIDER ?? '').toLowerCase();
  const ordered = preferred
    ? [
        ...chat.filter((s) => (s.provider ?? '').toLowerCase() === preferred),
        ...chat.filter((s) => (s.provider ?? '').toLowerCase() !== preferred),
      ]
    : chat;

  let picked: PickedService | null = null;
  for (const svc of ordered) {
    try {
      try { await broker.inference.getAccount(svc.provider); }
      catch {
        try {
          await broker.ledger.transferFund(svc.provider, 'inference', ethers.parseEther('1'));
        } catch (e) {
          log.warn({ provider: svc.provider, err: (e as Error).message?.slice(0, 200) }, '0G LLM proxy: transferFund failed, skipping');
          continue;
        }
      }
      await broker.inference.acknowledgeProviderSigner(svc.provider);
      picked = { provider: svc.provider, url: svc.url, model: svc.model };
      break;
    } catch (e) {
      log.debug({ provider: svc.provider, err: (e as Error).message?.slice(0, 120) }, '0G LLM proxy: provider unreachable');
    }
  }
  if (!picked) {
    initFailedReason = '0G Compute: no reachable provider';
    return null;
  }

  log.info({ provider: picked.provider, model: picked.model, endpoint: picked.url }, '0G LLM proxy: ready');
  return { broker, picked };
}

async function getState(): Promise<OgLlmProxyState | null> {
  if (!initPromise) initPromise = initProxy().catch((e) => {
    initFailedReason = (e as Error).message ?? 'unknown error';
    log.error({ err: e }, '0G LLM proxy: init failed');
    return null;
  });
  return initPromise;
}

/**
 * Register the proxy on the given Hono app. Mounts at `/internal/og-llm`.
 *
 * Endpoints:
 *   GET  /internal/og-llm/model          → { model, provider, endpoint } once ready
 *   POST /internal/og-llm/chat/completions → forwards to 0G, OpenAI-shaped
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerOgLlmProxy(app: Hono<any>): void {
  app.get('/internal/og-llm/model', async (c: Context) => {
    const state = await getState();
    if (!state) return c.json({ error: 'og_llm_unavailable', detail: initFailedReason }, 503);
    return c.json({ model: state.picked.model, provider: state.picked.provider, endpoint: state.picked.url });
  });

  app.post('/internal/og-llm/chat/completions', async (c: Context) => {
    const state = await getState();
    if (!state) return c.json({ error: 'og_llm_unavailable', detail: initFailedReason }, 503);

    const body = await c.req.text();
    let headers: Record<string, string> = {};
    try {
      const signed = await state.broker.inference.getRequestHeaders(state.picked.provider);
      for (const [k, v] of Object.entries(signed ?? {})) {
        if (typeof v === 'string') headers[k] = v;
      }
    } catch (e) {
      return c.json({ error: 'og_llm_sign_failed', detail: (e as Error).message?.slice(0, 200) }, 502);
    }

    const upstream = `${state.picked.url}/v1/proxy/chat/completions`;
    let res: Response;
    try {
      res = await fetch(upstream, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body,
      });
    } catch (e) {
      return c.json({ error: 'og_llm_network', detail: (e as Error).message?.slice(0, 200) }, 502);
    }

    // Forward response (streaming-safe — Pipecat reads SSE chunks).
    const respHeaders = new Headers();
    res.headers.forEach((v, k) => respHeaders.set(k, v));
    return new Response(res.body, { status: res.status, headers: respHeaders });
  });
}
