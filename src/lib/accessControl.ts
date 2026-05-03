import type { UserProfile } from '../contexts/AuthContext';

type RestrictedProfile = Pick<UserProfile, 'isBanned' | 'banReason' | 'banExpiresAt'> | null | undefined;

function formatRestrictionDate(value?: string) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function isReadOnlyUser(profile: RestrictedProfile) {
  return Boolean(profile?.isBanned);
}

export function getReadOnlyReason(profile: RestrictedProfile) {
  if (!profile?.isBanned) return null;

  const until = formatRestrictionDate(profile.banExpiresAt);
  const base = until
    ? `This account is in read-only mode until ${until}.`
    : 'This account is in read-only mode.';

  if (profile.banReason) {
    return `${base} Reason: ${profile.banReason}`;
  }

  return `${base} You can browse SnapLink, but posting, messaging, and creating new content are disabled.`;
}
