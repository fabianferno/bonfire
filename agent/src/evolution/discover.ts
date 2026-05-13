export interface DiscoveredSkill { slug: string; owner: string; description: string; securityScore?: number; }

export async function discover(interests: string[]): Promise<DiscoveredSkill[]> {
  const out: DiscoveredSkill[] = [];
  for (const tag of interests) {
    try {
      const r = await fetch(`https://agentskill.sh/api/search?q=${encodeURIComponent(tag)}`);
      if (!r.ok) continue;
      const data: any = await r.json();
      for (const it of data.results ?? []) {
        out.push({ slug: it.slug, owner: it.owner, description: it.description, securityScore: it.securityScore });
      }
    } catch { /* registry endpoints may change; documented in code */ }
  }
  return out;
}
