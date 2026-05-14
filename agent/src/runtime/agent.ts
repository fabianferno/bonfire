import { generateText, type CoreMessage, type LanguageModelV1, type Tool } from 'ai';
import { buildSystemPrompt } from './prompt-builder.js';
import { createChatModel } from './llm-client.js';
import { hashEnv } from './env-hash.js';
import type { LoadedAgent } from '../config/loader.js';
import type { SkillRecord } from '../skills/loader.js';
import type { MemoryStore } from '../memory/store.js';
import { SessionManager } from './session.js';
import { log } from '../util/logger.js';
import type { InboundMessage, TenantPayload } from '../channels/base.js';
import type { EmbeddingModel } from 'ai';
import { embedText } from '../memory/embeddings.js';
import type { TenantRegistry } from '../tenants/registry.js';
import type { Tenant } from '../tenants/types.js';

export interface RuntimeDeps {
  loaded: LoadedAgent;
  model: LanguageModelV1;
  embedModel: EmbeddingModel<string> | null;
  store: MemoryStore;
  getSkills: () => SkillRecord[];
  getTools: () => Record<string, Tool>;
  tenantRegistry?: TenantRegistry;
}

export class AgentRuntime {
  private sessions: SessionManager;
  // Per-tenant model cache; cleared when a tenant is updated via registry subscription.
  private modelCache = new Map<string, LanguageModelV1>();

  constructor(private d: RuntimeDeps) {
    this.sessions = new SessionManager(d.store, d.loaded.config.memory.compactAfterTokens);
    // Subscribe to registry changes to invalidate stale cached models.
    if (d.tenantRegistry) {
      d.tenantRegistry.subscribe((slug) => { this.invalidateTenantCache(slug); });
    }
  }

  /** Return a tenant-specific LanguageModelV1, building and caching it on first use. */
  private async modelFor(tenant: Tenant | TenantPayload | null, envOverride?: Record<string, string>): Promise<LanguageModelV1> {
    // TenantPayload (inline) has no `env` field; Tenant (registry) may have one.
    const tenantEnv = (tenant as Tenant | null)?.env ?? {};
    const override = envOverride ?? {};
    const effectiveEnv = { ...tenantEnv, ...override };
    const tenantLlm = tenant?.llm ?? {};
    const hasOverrides =
      Object.keys(effectiveEnv).length > 0 ||
      Object.keys(tenantLlm).length > 0;
    if (!hasOverrides) return this.d.model;

    const slug = tenant?.slug ?? '_default';
    const cacheKey = `${slug}:${hashEnv(effectiveEnv)}`;
    const cached = this.modelCache.get(cacheKey);
    if (cached) return cached;

    const mergedCfg = {
      ...this.d.loaded.config,
      llm: { ...this.d.loaded.config.llm, ...tenantLlm },
    };
    const resolver = (k: string) => (effectiveEnv[k] !== undefined ? effectiveEnv[k] : process.env[k]);
    try {
      const handle = await createChatModel(mergedCfg, resolver);
      this.modelCache.set(cacheKey, handle.model);
      return handle.model;
    } catch (e: any) {
      log.warn({ tenant: slug, err: e?.message }, 'tenant model build failed; falling back to default');
      // Don't cache the fallback — try again next time (e.g., after config is fixed).
      return this.d.model;
    }
  }

  /** Clear all cache entries for a given tenant slug (covers all env-hash variants). */
  private invalidateTenantCache(slug: string): void {
    for (const key of this.modelCache.keys()) {
      if (key === slug || key.startsWith(`${slug}:`)) {
        this.modelCache.delete(key);
      }
    }
  }

  async handle(msg: InboundMessage): Promise<void> {
    // Prefer inline decrypted bundle; fall back to registry slug lookup only when no inline payload.
    // When tenantInline is provided, skip the registry entirely to avoid "tenant not found" log spam.
    const tenant: Tenant | TenantPayload | null = msg.tenantInline
      ? msg.tenantInline
      : (msg.tenant && this.d.tenantRegistry
          ? this.d.tenantRegistry.get(msg.tenant) ?? null
          : null);

    const soul = tenant?.soul ?? this.d.loaded.soul;
    const agentRules = tenant?.agents ?? this.d.loaded.agents;
    const agentName = tenant?.name ?? this.d.loaded.config.name;
    const tenantPrefix = tenant ? `tenant:${tenant.slug}::` : '';
    const effectiveChatId = `${tenantPrefix}${msg.chatId}`;

    const { sessionId, history } = this.sessions.load({ channel: msg.channel, chatId: effectiveChatId });
    let memorySnippets: string[] = [];
    if (this.d.embedModel) {
      try {
        const v = await embedText(this.d.embedModel, msg.text);
        memorySnippets = this.d.store.searchVectors(v, 5).map(h => h.snippet);
      } catch (e) { log.warn({ err: e }, 'embed/search failed'); }
    }
    const system = buildSystemPrompt({
      agentName,
      soul,
      agents: agentRules,
      skills: this.d.getSkills(),
      memorySnippets,
    });
    const messages: CoreMessage[] = [...history, { role: 'user', content: msg.text }];
    this.sessions.append(sessionId, 'user', msg.text);

    // Build tenant-specific model (cached after first call).
    const model = await this.modelFor(tenant, msg.envOverride);

    const baseArgs = {
      model,
      system,
      messages,
      temperature: this.d.loaded.config.llm.temperature,
      maxTokens: this.d.loaded.config.llm.maxTokens,
    };

    let final: string | null = null;
    let usageTokens = 0;
    try {
      const result = await generateText({
        ...baseArgs,
        tools: this.d.getTools(),
        maxSteps: 8,
      });
      final = result.text || null;
      usageTokens = result.usage?.totalTokens ?? 0;
    } catch (e: any) {
      const msg2 = String(e?.message ?? e);
      const looksLikeToolHallucination = /unavailable tool|unknown tool|no such tool|invalid tool/i.test(msg2);
      log.warn({ err: msg2, retryWithoutTools: looksLikeToolHallucination }, 'agent loop: generateText threw');
      if (looksLikeToolHallucination) {
        // Retry with tools disabled. The model hallucinated a function call to something that
        // isn't a tool (e.g., trying to call another agent as a tool). Without tools available,
        // it will reply in plain text, which is what we want for agent-to-agent comms.
        try {
          const retry = await generateText({ ...baseArgs, maxSteps: 1 });
          final = retry.text || null;
          usageTokens = retry.usage?.totalTokens ?? 0;
        } catch (e2: any) {
          log.error({ err: e2 }, 'agent loop: retry without tools also failed');
        }
      }
    }

    if (!final) {
      final = "_(I couldn't form a reply this turn.)_";
    }
    this.sessions.append(sessionId, 'assistant', final);
    await msg.reply(final);

    if (this.d.embedModel) {
      try {
        const v = await embedText(this.d.embedModel, msg.text + '\n' + final);
        this.d.store.indexVector(sessionId, `m:${Date.now()}`, msg.text.slice(0, 500), v);
      } catch (e) { log.warn({ err: e }, 'embed/index failed'); }
    }
    this.sessions.maybeCompact(sessionId, usageTokens);
  }
}
