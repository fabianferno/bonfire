export interface InvokeAgentInput {
  baseUrl: string;
  chatId: string;
  text: string;
  /** Abort signal for upstream call. */
  signal?: AbortSignal;
}

export async function invokeAgent(input: InvokeAgentInput): Promise<string> {
  const msgRes = await fetch(`${input.baseUrl}/chat/message`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: input.chatId, text: input.text }),
    signal: input.signal,
  });
  if (!msgRes.ok) throw new Error(`agent /chat/message returned ${msgRes.status}`);
  const { streamId } = (await msgRes.json()) as { streamId: string };
  if (!streamId) throw new Error('agent did not return streamId');

  const streamRes = await fetch(`${input.baseUrl}/chat/stream/${streamId}`, { signal: input.signal });
  if (!streamRes.ok || !streamRes.body) throw new Error(`agent stream returned ${streamRes.status}`);

  return await accumulateSse(streamRes.body);
}

export async function* sseChunks(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const event = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const dataLine = event.split('\n').find(l => l.startsWith('data:'));
      if (!dataLine) continue;
      const payload = dataLine.slice(5).trim();
      if (!payload || payload === '{}') continue;
      try {
        const parsed = JSON.parse(payload);
        if (typeof parsed.chunk === 'string') yield parsed.chunk;
      } catch { /* ignore malformed events */ }
    }
  }
}

async function accumulateSse(body: ReadableStream<Uint8Array>): Promise<string> {
  let out = '';
  for await (const chunk of sseChunks(body)) out += chunk;
  return out;
}
