export interface InboundMessage {
  channel: string;
  chatId: string;
  userId: string;
  text: string;
  tenant?: string;
  raw?: unknown;
  reply: (text: string, opts?: { stream?: boolean }) => Promise<void>;
  editLast?: (text: string) => Promise<void>;
}

export interface ChannelAdapter {
  id: string;
  start(onMessage: (m: InboundMessage) => Promise<void>): Promise<void>;
  stop(): Promise<void>;
}
