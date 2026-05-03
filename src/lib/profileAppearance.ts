import { WORLD_CUP_QUALIFIED_TEAMS, getWorldCupHatMeta } from './worldCup2026';

export const PROFILE_THEMES = {
  'theme-galaxy': {
    bg: 'from-slate-950 via-indigo-950 to-purple-950',
    accent: '#8b5cf6',
    surface: 'bg-slate-950/55 border-white/10',
    surfaceSoft: 'bg-white/8 border-white/10',
    mutedText: 'text-white/70',
  },
  'theme-aurora': {
    bg: 'from-emerald-950 via-teal-900 to-cyan-950',
    accent: '#34d399',
    surface: 'bg-emerald-950/45 border-white/10',
    surfaceSoft: 'bg-white/10 border-white/10',
    mutedText: 'text-white/75',
  },
  'theme-sunset': {
    bg: 'from-orange-600 via-rose-500 to-fuchsia-700',
    accent: '#fb923c',
    surface: 'bg-rose-950/35 border-white/15',
    surfaceSoft: 'bg-white/14 border-white/15',
    mutedText: 'text-white/80',
  },
  'theme-ocean': {
    bg: 'from-sky-950 via-blue-900 to-cyan-900',
    accent: '#38bdf8',
    surface: 'bg-slate-950/45 border-white/10',
    surfaceSoft: 'bg-white/8 border-white/10',
    mutedText: 'text-white/70',
  },
  'theme-neon': {
    bg: 'from-violet-950 via-fuchsia-950 to-pink-950',
    accent: '#f472b6',
    surface: 'bg-black/45 border-fuchsia-400/20',
    surfaceSoft: 'bg-white/10 border-fuchsia-300/20',
    mutedText: 'text-fuchsia-100/75',
  },
  'theme-sakura': {
    bg: 'from-rose-300 via-pink-200 to-fuchsia-300',
    accent: '#ec4899',
    surface: 'bg-white/70 border-white/60',
    surfaceSoft: 'bg-white/75 border-white/65',
    mutedText: 'text-rose-950/65',
  },
  'theme-velvet': {
    bg: 'from-amber-950 via-red-950 to-rose-900',
    accent: '#f59e0b',
    surface: 'bg-black/40 border-amber-300/15',
    surfaceSoft: 'bg-white/10 border-amber-200/15',
    mutedText: 'text-amber-50/75',
  },
  'theme-mint': {
    bg: 'from-emerald-200 via-cyan-100 to-sky-200',
    accent: '#0f766e',
    surface: 'bg-white/72 border-white/60',
    surfaceSoft: 'bg-white/78 border-white/65',
    mutedText: 'text-teal-950/65',
  },
  'theme-world-cup-pitch': {
    bg: 'from-emerald-950 via-sky-950 to-emerald-900',
    accent: '#22c55e',
    surface: 'bg-emerald-950/40 border-emerald-200/15',
    surfaceSoft: 'bg-white/10 border-emerald-200/15',
    mutedText: 'text-emerald-50/75',
  },
  'theme-world-cup-night': {
    bg: 'from-sky-950 via-indigo-950 to-emerald-950',
    accent: '#38bdf8',
    surface: 'bg-slate-950/52 border-sky-200/15',
    surfaceSoft: 'bg-white/10 border-sky-200/15',
    mutedText: 'text-sky-50/75',
  },
} as const;

export type ProfileThemeId = keyof typeof PROFILE_THEMES;

const BASE_AVATAR_DECORATION_STYLES: Record<string, string> = {
  'ring-gold': 'border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.45)]',
  'neon-glow': 'border-blue-400 shadow-[0_0_18px_rgba(59,130,246,0.55)]',
  'ring-rose': 'border-rose-400 shadow-[0_0_18px_rgba(251,113,133,0.45)]',
  'ring-emerald': 'border-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.45)]',
  'ring-crimson': 'border-red-500 shadow-[0_0_18px_rgba(239,68,68,0.55)]',
  'ring-ice': 'border-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.45)]',
  'ring-shadow': 'border-slate-800 shadow-[0_0_18px_rgba(15,23,42,0.65)]',
  'ring-rainbow': 'border-pink-400 shadow-[0_0_18px_rgba(236,72,153,0.45)]',
  'ring-solar': 'border-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.55)]',
  'ring-orbit': 'border-violet-400 shadow-[0_0_18px_rgba(167,139,250,0.55)]',
  'ring-mint': 'border-teal-300 shadow-[0_0_18px_rgba(45,212,191,0.45)]',
};

const WORLD_CUP_HAT_STYLES = Object.fromEntries(
  WORLD_CUP_QUALIFIED_TEAMS.map((team) => [
    `hat-${team.slug}`,
    `sl-world-cup-hat sl-decoration-hat-${team.slug} border-white shadow-[0_0_22px_rgba(16,185,129,0.35)]`,
  ])
) as Record<string, string>;

export const AVATAR_DECORATION_STYLES: Record<string, string> = {
  ...BASE_AVATAR_DECORATION_STYLES,
  ...WORLD_CUP_HAT_STYLES,
} as const;

export function getAvatarDecorationClass(decoration?: string | null, fallback = '') {
  return decoration ? AVATAR_DECORATION_STYLES[decoration] || fallback : fallback;
}

export function getProfileTheme(themeId?: string | null) {
  if (!themeId) return null;
  return PROFILE_THEMES[themeId as ProfileThemeId] || null;
}

export function getAvatarAccessoryMeta(decoration?: string | null) {
  return getWorldCupHatMeta(decoration || null);
}
