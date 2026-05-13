import { tool } from 'ai';
import { z } from 'zod';
import { spawn } from 'node:child_process';

export function makeCodeExecTool(timeoutMs: number) {
  return tool({
    description: 'Execute a short shell command in a sandboxed subprocess. Returns stdout/stderr.',
    parameters: z.object({ cmd: z.string(), shell: z.boolean().default(false) }),
    execute: async ({ cmd, shell }) => {
      return await new Promise<{ stdout: string; stderr: string; code: number }>((resolve) => {
        const p = spawn(cmd, [], { shell, timeout: timeoutMs });
        let stdout = '', stderr = '';
        p.stdout?.on('data', (b) => stdout += b.toString());
        p.stderr?.on('data', (b) => stderr += b.toString());
        p.on('close', (code) => resolve({ stdout: stdout.slice(0, 20_000), stderr: stderr.slice(0, 20_000), code: code ?? -1 }));
      });
    },
  });
}
