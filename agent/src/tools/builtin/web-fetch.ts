import { tool } from 'ai';
import { z } from 'zod';

export const webFetchTool = tool({
  description: 'Fetch a URL and return text (first 100KB).',
  parameters: z.object({ url: z.string().url() }),
  execute: async ({ url }) => {
    const res = await fetch(url, { redirect: 'follow' });
    const text = await res.text();
    return { status: res.status, text: text.slice(0, 100_000) };
  },
});
