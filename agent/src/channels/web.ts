import type { ChannelAdapter, InboundMessage } from './base.js';
import { EventEmitter } from 'node:events';

export interface WebChatBus {
  enqueue(userId: string, text: string): Promise<string>;
  subscribe(streamId: string, write: (chunk: string) => void): () => void;
  finalize(streamId: string): void;
}

export class WebChatAdapter implements ChannelAdapter, WebChatBus {
  id = 'web';
  private handler?: (m: InboundMessage) => Promise<void>;
  private streams = new Map<string, { write: (chunk: string) => void; emitter: EventEmitter }>();

  async start(onMessage: (m: InboundMessage) => Promise<void>) { this.handler = onMessage; }
  async stop() { this.streams.clear(); }

  async enqueue(userId: string, text: string): Promise<string> {
    if (!this.handler) throw new Error('web adapter not started');
    const streamId = `${userId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    const emitter = new EventEmitter();
    this.streams.set(streamId, { write: () => {}, emitter });
    queueMicrotask(async () => {
      await this.handler!({
        channel: 'web',
        chatId: userId,
        userId,
        text,
        reply: async (t) => { const s = this.streams.get(streamId); s?.write(t); s?.emitter.emit('done'); },
        editLast: async (t) => { const s = this.streams.get(streamId); s?.write(`\x00REPLACE\x00${t}`); },
      });
    });
    return streamId;
  }

  subscribe(streamId: string, write: (chunk: string) => void): () => void {
    const s = this.streams.get(streamId);
    if (!s) { write('error: no such stream'); return () => {}; }
    s.write = write;
    const done = () => { this.streams.delete(streamId); };
    s.emitter.once('done', done);
    return () => { this.streams.delete(streamId); };
  }
  finalize(streamId: string) { this.streams.delete(streamId); }
}
