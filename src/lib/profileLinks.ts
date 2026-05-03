import type { UserProfile } from '../contexts/AuthContext';

export type SocialLinkKey = 'x' | 'instagram' | 'tiktok' | 'youtube' | 'discord';

export type SocialLinks = Partial<Record<SocialLinkKey, string>>;

const SOCIAL_HOSTS: Record<SocialLinkKey, string[]> = {
  x: ['x.com', 'twitter.com', 'www.x.com', 'www.twitter.com'],
  instagram: ['instagram.com', 'www.instagram.com'],
  tiktok: ['tiktok.com', 'www.tiktok.com'],
  youtube: ['youtube.com', 'www.youtube.com', 'youtu.be', 'www.youtu.be'],
  discord: ['discord.gg', 'discord.com', 'www.discord.com', 'www.discord.gg'],
};

function normalizeAbsoluteUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    return url.toString();
  } catch {
    return '';
  }
}

export function normalizeWebsiteUrl(value: string) {
  return normalizeAbsoluteUrl(value);
}

export function normalizeSocialLinks(input: SocialLinks) {
  const normalized: SocialLinks = {};
  for (const [key, value] of Object.entries(input) as Array<[SocialLinkKey, string | undefined]>) {
    const next = normalizeAbsoluteUrl(value || '');
    if (next) {
      normalized[key] = next;
    }
  }
  return normalized;
}

export function validateSocialLinks(websiteUrl: string, socialLinks: SocialLinks) {
  const errors: Partial<Record<'websiteUrl' | SocialLinkKey, string>> = {};
  const normalizedWebsite = websiteUrl.trim() ? normalizeWebsiteUrl(websiteUrl) : '';

  if (websiteUrl.trim() && !normalizedWebsite) {
    errors.websiteUrl = 'Use a full website URL.';
  }

  for (const [key, rawValue] of Object.entries(socialLinks) as Array<[SocialLinkKey, string | undefined]>) {
    if (!rawValue?.trim()) continue;
    const normalized = normalizeAbsoluteUrl(rawValue);
    if (!normalized) {
      errors[key] = 'Use a full URL.';
      continue;
    }

    const hostname = new URL(normalized).hostname.toLowerCase();
    if (!SOCIAL_HOSTS[key].includes(hostname)) {
      errors[key] = `That does not look like a valid ${key} link.`;
    }
  }

  return errors;
}

export function getProfileSocialLinks(profile: Partial<UserProfile>) {
  const socialLinks = (profile.socialLinks || {}) as SocialLinks;
  return normalizeSocialLinks(socialLinks);
}
