import { generateText, type CoreMessage, type LanguageModelV1, type Tool } from 'ai';
import { buildSystemPrompt } from './prompt-builder.js';
import type { LoadedAgent } from '../config/loader.js';
import type { SkillRecord } from '../skills/loader.js';
import type { MemoryStore } from '../memory/store.js';
import { SessionManager } from './session.js';
import { log } from '../util/logger.js';
import type { InboundMessage } from '../channels/base.js';
import type { EmbeddingModel } from 'ai';
import { embedText } from '../memory/embeddings.js';

export interface RuntimeDeps {
  loaded: LoadedAgent;
  model: LanguageModelV1;
  embedModel: EmbeddingModel<string> | null;
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
