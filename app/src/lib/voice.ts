import { api } from '@/lib/api';

export interface VoiceSession {
  roomUrl: string;
  token: string;
  sessionId: string;
  agentSlug: string | null;
  expiresAt: string;
}

export const voiceApi = {
  join: (channelId: string) =>
    api<VoiceSession>('POST', `/v1/channels/${channelId}/voice/join`, {}),

  leave: (channelId: string, sessionId: string) =>
    api<{ ok: boolean; ended: boolean }>(
      'POST',
      `/v1/channels/${channelId}/voice/leave`,
      { sessionId },
    ),

  status: (channelId: string) =>
    api<{
      active: boolean;
      sessionId?: string;
      participantCount?: number;
      expiresAt?: string;
    }>('GET', `/v1/channels/${channelId}/voice/status`, undefined),
};
