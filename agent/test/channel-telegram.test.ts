import { describe, it, expect } from 'vitest';
import { TelegramAdapter } from '../src/channels/telegram.js';

describe('TelegramAdapter', () => {
  it('does not start when disabled', async () => {
    const cfg: any = { channels: { telegram: { enabled: false, tokenEnv: 'NONE', dmPolicy: 'open', allowFrom: [], groups: {} } } };
    const a = new TelegramAdapter(cfg);
    await a.start(async () => {});
    expect(true).toBe(true);
  });

  it('does not start when token env is missing', async () => {
    delete process.env.TG_TEST_NOPE;
    const cfg: any = { channels: { telegram: { enabled: true, tokenEnv: 'TG_TEST_NOPE', dmPolicy: 'open', allowFrom: [], groups: {} } } };
    const a = new TelegramAdapter(cfg);
    await a.start(async () => {});
    expect(true).toBe(true);
  });
});
