import type { Tool } from 'ai';
import type { AgentConfig } from '../config/schema.js';
import { webFetchTool } from './builtin/web-fetch.js';
import { makeWebSearchTool } from './builtin/web-search.js';
import { makeCodeExecTool } from './builtin/code-exec.js';
import { makeFileOpsTools } from './builtin/file-ops.js';
import type { McpHandle } from './mcp-client.js';

export function buildToolRegistry(cfg: AgentConfig, mcpHandles: McpHandle[]): Record<string, Tool> {
  const tools: Record<string, Tool> = {};
  const b = cfg.tools.builtin;
  if (b.webFetch.enabled) tools.web_fetch = webFetchTool;
  if (b.webSearch.enabled) {
    const k = process.env[b.webSearch.apiKeyEnv];
    if (k) tools.web_search = makeWebSearchTool(b.webSearch.provider, k);
  }
  if (b.codeExec.enabled) tools.code_exec = makeCodeExecTool(b.codeExec.timeoutMs);
  if (b.fileOps.enabled) Object.assign(tools, makeFileOpsTools(b.fileOps.rootDir));
  for (const h of mcpHandles) Object.assign(tools, h.tools);
  return tools;
}
