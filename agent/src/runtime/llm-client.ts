import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { EmbeddingModel, LanguageModelV1 } from 'ai';
import { ethers } from 'ethers';
import type { AgentConfig } from '../config/schema.js';
import { log } from '../util/logger.js';

export interface ChatModelInfo {
  provider: 'openai-compatible' | 'zerog';
  model: string;
  endpoint?: string;
  zerogProviderAddress?: string;
}

export interface ChatModelHandle {
  model: LanguageModelV1;
  info: ChatModelInfo;
}

export async function createChatModel(cfg: AgentConfig): Promise<ChatModelHandle> {
  if (cfg.llm.provider === 'zerog') return createZeroGModel(cfg);
  return createOpenAiCompatibleModel(cfg);
}

function createOpenAiCompatibleModel(cfg: AgentConfig): ChatModelHandle {
  if (!cfg.llm.baseUrl) throw new Error('llm.baseUrl required for openai-compatible provider');
  if (!cfg.llm.model) throw new Error('llm.model required for openai-compatible provider');
  const apiKey = process.env[cfg.llm.apiKeyEnv];
  if (!apiKey) throw new Error(`Missing env ${cfg.llm.apiKeyEnv}`);
  const provider = createOpenAICompatible({
    name: 'configured-llm',
    baseURL: cfg.llm.baseUrl,
    apiKey,
  });
  return {
    model: provider.chatModel(cfg.llm.model),
    info: { provider: 'openai-compatible', model: cfg.llm.model, endpoint: cfg.llm.baseUrl },
  };
}

async function createZeroGModel(cfg: AgentConfig): Promise<ChatModelHandle> {
  const rpcUrl = process.env[cfg.llm.rpcUrlEnv];
  const privateKey = process.env[cfg.llm.privateKeyEnv];
  if (!rpcUrl) throw new Error(`Missing env ${cfg.llm.rpcUrlEnv}`);
  if (!privateKey) throw new Error(`Missing env ${cfg.llm.privateKeyEnv}`);

  const { createZGComputeNetworkBroker } = await loadBrokerModule();

  const rpcProvider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, rpcProvider);
  log.info({ wallet: wallet.address }, '0G broker: initializing');
  const broker: any = await createZGComputeNetworkBroker(wallet as any);

  try { await broker.ledger.getLedger(); }
  catch {
    log.info('0G broker: creating ledger with 0.05 OG');
    try { await broker.ledger.addLedger(0.05); }
    catch (e: any) { log.warn({ err: e?.message }, '0G broker: addLedger failed'); }
  }

  const services: any[] = await broker.inference.listService();
  if (!services?.length) throw new Error('0G Compute: no services available');
  const chat = services.filter((s) => s.serviceType === 'chatbot' || s.serviceType === 'chat');
  if (!chat.length) throw new Error('0G Compute: no chat services available');

  const preferred = process.env[cfg.llm.preferredProviderEnv]?.toLowerCase();
  const ordered = preferred
    ? [
        ...chat.filter((s) => s.provider?.toLowerCase() === preferred),
        ...chat.filter((s) => s.provider?.toLowerCase() !== preferred),
      ]
    : chat;

  // If the config pins a specific model name, prefer that.
  if (cfg.llm.model) {
    const wanted = cfg.llm.model;
    ordered.sort((a, b) => (a.model === wanted ? -1 : b.model === wanted ? 1 : 0));
  }

  let picked: { provider: string; url: string; model: string } | null = null;
  for (const svc of ordered) {
    try {
      try { await broker.inference.getAccount(svc.provider); }
      catch {
        try { await broker.ledger.transferFund(svc.provider, 'inference', 0.05); }
        catch (e: any) {
          log.debug({ provider: svc.provider, err: e?.message?.slice?.(0, 120) }, '0G broker: transferFund failed, skipping');
          continue;
        }
      }
      await broker.inference.acknowledgeProviderSigner(svc.provider);
      picked = { provider: svc.provider, url: svc.url, model: svc.model };
      break;
    } catch (e: any) {
      log.debug({ provider: svc.provider, model: svc.model, err: e?.message?.slice?.(0, 120) }, '0G broker: provider unreachable, trying next');
    }
  }
  if (!picked) throw new Error('0G Compute: no reachable provider');

  log.info({ provider: picked.provider, model: picked.model, endpoint: picked.url }, '0G broker: ready');

  const fetchWithZeroGHeaders: typeof fetch = async (input, init) => {
    const headers = await broker.inference.getRequestHeaders(picked!.provider);
    const merged = new Headers(init?.headers as HeadersInit | undefined);
    for (const [k, v] of Object.entries(headers ?? {})) {
      if (typeof v === 'string') merged.set(k, v);
    }
    return globalThis.fetch(input as any, { ...init, headers: merged });
  };

  const provider = createOpenAICompatible({
    name: 'zerog',
    baseURL: `${picked.url}/v1/proxy`,
    apiKey: 'unused-zerog-uses-headers',
    fetch: fetchWithZeroGHeaders,
  });

  return {
    model: provider.chatModel(picked.model),
    info: { provider: 'zerog', model: picked.model, endpoint: picked.url, zerogProviderAddress: picked.provider },
  };
}

async function loadBrokerModule(): Promise<{ createZGComputeNetworkBroker: any }> {
  // 0G broker is CommonJS; load via createRequire to dodge ESM interop quirks.
  const { createRequire } = await import('node:module');
  const req = createRequire(import.meta.url);
  return req('@0glabs/0g-serving-broker');
}

export function createEmbeddingModel(cfg: AgentConfig): EmbeddingModel<string> | null {
  if (!cfg.embeddings) return null;
  const apiKey = process.env[cfg.embeddings.apiKeyEnv];
  if (!apiKey) {
    log.warn(`Embeddings configured but env ${cfg.embeddings.apiKeyEnv} is empty; disabling vector memory`);
    return null;
  }
  const provider = createOpenAICompatible({
    name: 'configured-embeddings',
    baseURL: cfg.embeddings.baseUrl,
    apiKey,
  });
  return provider.textEmbeddingModel(cfg.embeddings.model);
}
