import fs from 'node:fs/promises';
import path from 'node:path';
import { scanContent } from './scanner.js';
import { AgentSkillShClient } from './registry-clients/agentskill-sh.js';
import { ClawHubClient } from './registry-clients/clawhub.js';
import { GitUrlClient } from './registry-clients/skills-sh.js';
import type { InstallRequest } from './registry-clients/base.js';
import { log } from '../util/logger.js';

export type EvolutionMode = 'off' | 'suggest' | 'auto-safe' | 'auto-all';

const clients = {
  'agentskill.sh': new AgentSkillShClient(),
  'clawhub': new ClawHubClient(),
  'url': new GitUrlClient(),
};

export interface InstallResult {
  ok: boolean;
  slug?: string;
  dir?: string;
  securityScore?: number;
  reason?: string;
  findings?: { critical: any[]; warnings: any[] };
}

export async function installSkill(
  agentDir: string,
  source: keyof typeof clients,
  req: InstallRequest,
  mode: EvolutionMode = 'suggest'
): Promise<InstallResult> {
  const targetDir = path.join(agentDir, 'skills');
  await fs.mkdir(targetDir, { recursive: true });
  const client = clients[source];
  if (!client) return { ok: false, reason: `unknown source: ${source}` };

  const installed = await client.install(req, targetDir);
  const skillMdPath = path.join(installed.dir, 'SKILL.md');
  let content = '';
  try { content = await fs.readFile(skillMdPath, 'utf8'); }
  catch { await fs.rm(installed.dir, { recursive: true, force: true }); return { ok: false, reason: 'no SKILL.md found' }; }

  const findings = scanContent(content);
  if (findings.critical.length > 0) {
    await fs.rm(installed.dir, { recursive: true, force: true });
    log.warn({ findings: findings.critical }, 'skill blocked by scanner');
    return { ok: false, reason: 'scanner: critical findings', findings };
  }
  if (mode === 'auto-safe') {
    const requiresBins = /requires:\s*\n[\s\S]*?bins:\s*\[[^\]\n]+\]/.test(content);
    if (requiresBins) {
      await fs.rm(installed.dir, { recursive: true, force: true });
      return { ok: false, reason: 'auto-safe: skill requires bins', findings };
    }
  }
  return { ok: true, slug: installed.slug, dir: installed.dir, findings };
}

export async function removeSkill(agentDir: string, slug: string): Promise<boolean> {
  const dir = path.join(agentDir, 'skills', slug);
  try { await fs.rm(dir, { recursive: true, force: true }); return true; } catch { return false; }
}
