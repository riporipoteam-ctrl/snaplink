export type FeatureGateKey = 'makespace' | 'ripoai';
export type FeatureGateRole = 'admin' | 'member' | 'user' | string | null | undefined;

type FeatureGateConfig = {
  key: FeatureGateKey;
  label: string;
  path: string;
  releaseAtUtc: string;
  teaser: string;
};

const SATURDAY_UNLOCK_UTC = '2026-04-17T22:00:00.000Z';

export const FEATURE_GATES: Record<FeatureGateKey, FeatureGateConfig> = {
  makespace: {
    key: 'makespace',
    label: 'MakeSpace',
    path: '/makespace',
    releaseAtUtc: SATURDAY_UNLOCK_UTC,
    teaser: 'A new 3D social world is almost ready to open.',
  },
  ripoai: {
    key: 'ripoai',
    label: 'RipoAI',
    path: '/ripoai',
    releaseAtUtc: SATURDAY_UNLOCK_UTC,
    teaser: 'The dedicated RipoAI experience unlocks soon.',
  },
};

export function getFeatureGate(key: FeatureGateKey) {
  return FEATURE_GATES[key];
}

export function isFeatureUnlocked(key: FeatureGateKey, now = new Date()) {
  return now.getTime() >= Date.parse(FEATURE_GATES[key].releaseAtUtc);
}

export function canPreviewLockedFeatures(role: FeatureGateRole) {
  return role === 'admin' || role === 'moderator';
}

export function canAccessFeature(key: FeatureGateKey, role?: FeatureGateRole, now = new Date()) {
  return canPreviewLockedFeatures(role) || isFeatureUnlocked(key, now);
}

export function getFeatureUnlockDate(key: FeatureGateKey) {
  return new Date(FEATURE_GATES[key].releaseAtUtc);
}

export function getFeatureUnlockLabel(key: FeatureGateKey) {
  const releaseDate = getFeatureUnlockDate(key);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Sarajevo',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(releaseDate);
}
