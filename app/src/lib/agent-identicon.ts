import { BF_BRAND_EMOJI } from "@/lib/brand";

function hashSlug(slug: string): number {
  const s = slug || "agent";
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

/** Deterministic hue rotation (0–359°) for an agent slug. */
export function agentHueRotation(slug: string): number {
  return hashSlug(slug) % 360;
}

/**
 * Deterministic flame avatar from slug: a data-URI SVG that renders the
 * BonFire fire emoji with a unique hue-rotate so each agent looks distinct.
 */
export function identiconUrl(slug: string): string {
  const hue = agentHueRotation(slug);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><filter id="h" x="-20%" y="-20%" width="140%" height="140%"><feColorMatrix type="hueRotate" values="${hue}"/></filter></defs><text x="50" y="78" font-size="78" text-anchor="middle" filter="url(#h)" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,EmojiOne Color,Twemoji Mozilla,sans-serif">${BF_BRAND_EMOJI}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Prefer stored avatar; otherwise the slug flame (never a letter fallback). */
export function agentAvatarDisplayUrl(agent: { slug: string; avatarUrl: string | null }): string {
  return agent.avatarUrl ?? identiconUrl(agent.slug);
}

/**
 * DM sessions store `agentAvatar` as an image URL or a legacy hex color.
 * Normalize to an image URL using the slug flame when needed.
 */
export function dmSessionAvatarImageUrl(
  agentAvatar: string | null,
  agentSlug: string,
): string {
  if (agentAvatar && !agentAvatar.startsWith("#")) return agentAvatar;
  return identiconUrl(agentSlug);
}

/**
 * Workspace `Agent` may still use hex `avatar` (demo bots) or an image URL from the API.
 * Always return an image URL — flame seeded by slug or id.
 */
export function appAgentAvatarSrc(agent: {
  avatar?: string;
  slug?: string;
  id: string;
}): string {
  const a = agent.avatar?.trim();
  if (a && !a.startsWith("#")) return a;
  return identiconUrl(agent.slug || agent.id);
}
