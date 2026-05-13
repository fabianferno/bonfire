import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { log } from '../util/logger.js';

const REPO = 'https://github.com/agentskill-sh/ags.git';
const RAW_SKILL_URL = 'https://raw.githubusercontent.com/agentskill-sh/ags/main/SKILL.md';

export async function ensureLearnSkill(agentDir: string): Promise<void> {
  const dir = path.join(agentDir, 'skills', 'learn');
  try { await fs.access(path.join(dir, 'SKILL.md')); return; } catch {}
  await fs.mkdir(path.join(agentDir, 'skills'), { recursive: true });
  try {
    await new Promise<void>((resolve, reject) => {
      const p = spawn('git', ['clone', '--depth', '1', REPO, dir], { stdio: 'inherit' });
      p.on('exit', (c) => c === 0 ? resolve() : reject(new Error(`git clone exit ${c}`)));
      p.on('error', reject);
    });
    log.info('Installed /learn skill from agentskill.sh — agent can now search and install skills autonomously.');
  } catch (e) {
    log.warn({ err: e }, 'git clone failed; falling back to HTTPS SKILL.md fetch');
    try {
      const r = await fetch(RAW_SKILL_URL);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, 'SKILL.md'), await r.text());
      log.info('Installed /learn SKILL.md via HTTPS.');
    } catch (e2) { log.error({ err: e2 }, '/learn bootstrap failed; continuing without it'); }
  }
}
