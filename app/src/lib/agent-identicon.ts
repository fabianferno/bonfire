/**
 * Deterministic identicon from slug (DiceBear identicon, transparent background).
 * Matches the preview in Create Agent — same seed always yields the same avatar.
 */
export function identiconUrl(slug: string): string {
  const seed = encodeURIComponent(slug || "agent");
  return `https://api.dicebear.com/7.x/identicon/svg?seed=${seed}&backgroundColor=transparent`;
}

/** Prefer stored avatar; otherwise the slug identicon (never a letter fallback). */
export function agentAvatarDisplayUrl(agent: { slug: string; avatarUrl: string | null }): string {
  return agent.avatarUrl ?? identiconUrl(agent.slug);
}

/**
 * DM sessions store `agentAvatar` as an image URL or a legacy hex color.
 * Normalize to an image URL using the slug identicon when needed.
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
 * Always return an image URL — identicon seeded by slug or id.
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
