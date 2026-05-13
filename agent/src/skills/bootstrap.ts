import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { log } from '../util/logger.js';

const REPO = 'https://github.com/agentskill-sh/ags.git';
const RAW_SKILL_URL = 'https://raw.githubusercontent.com/agentskill-sh/ags/main/SKILL.md';

async function fetchViaHttps(dir: string): Promise<boolean> {
  try {
    const r = await fetch(RAW_SKILL_URL);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const body = await r.text();
    if (!body || !body.trim()) throw new Error('empty SKILL.md body');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'SKILL.md'), body);
    log.info('Installed /learn SKILL.md via HTTPS.');
    return true;
  } catch (e) {
    log.error({ err: e }, '/learn bootstrap failed; continuing without it');
    return false;
  }
}

export async function ensureLearnSkill(agentDir: string): Promise<void> {
  const dir = path.join(agentDir, 'skills', 'learn');
  try { await fs.access(path.join(dir, 'SKILL.md')); return; } catch {}
  await fs.mkdir(path.join(agentDir, 'skills'), { recursive: true });
  let cloned = false;
  try {
    await new Promise<void>((resolve, reject) => {
      const p = spawn('git', ['clone', '--depth', '1', REPO, dir], { stdio: 'inherit' });
      p.on('exit', (c) => c === 0 ? resolve() : reject(new Error(`git clone exit ${c}`)));
      p.on('error', reject);
    });
    cloned = true;
  } catch (e) {
    log.warn({ err: e }, 'git clone failed; falling back to HTTPS SKILL.md fetch');
    await fetchViaHttps(dir);
    return;
  }
  // Verify SKILL.md exists after clone
  try {
    await fs.access(path.join(dir, 'SKILL.md'));
    log.info('Installed /learn skill from agentskill.sh — agent can now search and install skills autonomously.');
  } catch {
    log.warn('cloned /learn repo missing SKILL.md at top level; falling back to HTTPS fetch');
    await fs.rm(dir, { recursive: true, force: true });
    await fetchViaHttps(dir);
  }
  void cloned;
}
