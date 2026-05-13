import { Bot } from 'grammy';
import type { ChannelAdapter, InboundMessage } from './base.js';
import type { AgentConfig } from '../config/schema.js';
import { log } from '../util/logger.js';

export class TelegramAdapter implements ChannelAdapter {
  id = 'telegram';
  private bot?: Bot;
  constructor(private cfg: AgentConfig) {}

  async start(onMessage: (m: InboundMessage) => Promise<void>) {
    const tg = this.cfg.channels.telegram;
    if (!tg.enabled) return;
    const token = process.env[tg.tokenEnv];
    if (!token) { log.warn('Telegram enabled but token env empty; skipping'); return; }
    this.bot = new Bot(token);

    this.bot.command('help', (ctx) => ctx.reply('Commands: /help /status /skills /reset /soul'));
    this.bot.command('status', (ctx) => ctx.reply('Ember online.'));
    this.bot.command('reset', (ctx) => ctx.reply('Session reset (not yet wired).'));

    this.bot.on('message:text', async (ctx) => {
      const m = ctx.message; if (!m) return;
      const chat = ctx.chat; if (!chat) return;
      const userId = String(ctx.from?.id ?? 'unknown');
      const chatId = String(chat.id);

      if (chat.type === 'private') {
        if (tg.dmPolicy === 'disabled') return;
        if (tg.dmPolicy === 'allowlist' && !tg.allowFrom.includes(userId)) return;
      } else {
        const g = tg.groups[chatId];
        if (g?.requireMention !== false) {
          const me = await ctx.api.getMe();
          if (!m.text.includes('@' + me.username)) return;
        }
        if (g?.allowFrom?.length && !g.allowFrom.includes(userId)) return;
      }

      const preview = await ctx.reply('…');
      await onMessage({
        channel: 'telegram',
        chatId, userId,
        text: m.text,
        raw: ctx,
        reply: async (text) => {
          try { await ctx.api.editMessageText(chat.id, preview.message_id, text, { parse_mode: 'HTML' }); }
          catch { await ctx.api.editMessageText(chat.id, preview.message_id, text); }
        },
        editLast: async (text) => {
          try { await ctx.api.editMessageText(chat.id, preview.message_id, text); } catch {}
        },
      });
    });

    this.bot.start({ onStart: (info) => log.info({ username: info.username }, 'telegram bot started') });
  }

  async stop() { await this.bot?.stop(); }
}
