import { generateText, type CoreMessage, type LanguageModelV1, type Tool } from 'ai';
import { buildSystemPrompt } from './prompt-builder.js';
import { createChatModel } from './llm-client.js';
import type { LoadedAgent } from '../config/loader.js';
import type { SkillRecord } from '../skills/loader.js';
import type { MemoryStore } from '../memory/store.js';
import { SessionManager } from './session.js';
import { log } from '../util/logger.js';
import type { InboundMessage } from '../channels/base.js';
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
      d.tenantRegistry.subscribe((slug) => { this.modelCache.delete(slug); });
    }
  }

  /** Return a tenant-specific LanguageModelV1, building and caching it on first use. */
  private async modelFor(tenant: Tenant | null): Promise<LanguageModelV1> {
    if (!tenant) return this.d.model;
    const hasOverrides =
      Object.keys(tenant.env ?? {}).length > 0 ||
      Object.keys(tenant.llm ?? {}).length > 0;
    if (!hasOverrides) return this.d.model;
    const cached = this.modelCache.get(tenant.slug);
    if (cached) return cached;
    const mergedCfg = {
      ...this.d.loaded.config,
      llm: { ...this.d.loaded.config.llm, ...(tenant.llm ?? {}) },
    };
    const tenantEnv = tenant.env ?? {};
    const resolver = (k: string) => (tenantEnv[k] !== undefined ? tenantEnv[k] : process.env[k]);
    try {
      const handle = await createChatModel(mergedCfg, resolver);
      this.modelCache.set(tenant.slug, handle.model);
      return handle.model;
    } catch (e: any) {
      log.warn({ tenant: tenant.slug, err: e?.message }, 'tenant model build failed; falling back to default');
      // Don't cache the fallback — try again next time (e.g., after config is fixed).
      return this.d.model;
    }
  }

  async handle(msg: InboundMessage): Promise<void> {
    // Resolve tenant-specific overrides when a tenant slug is provided
    const tenant = msg.tenant && this.d.tenantRegistry
      ? this.d.tenantRegistry.get(msg.tenant) ?? null
      : null;

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
    const model = await this.modelFor(tenant);

    try {
      const result = await generateText({
        model,
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
