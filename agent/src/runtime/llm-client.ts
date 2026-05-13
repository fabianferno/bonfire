import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { EmbeddingModel, LanguageModelV1 } from 'ai';
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

export function createEmbeddingModel(cfg: AgentConfig): EmbeddingModel<string> | null {
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
