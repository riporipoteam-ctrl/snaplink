export const DEFAULT_GROUP_THEME_ID = 'skyline';
export const DEFAULT_GROUP_BADGE = '👥';

export interface GroupThemeOption {
  id: string;
  label: string;
  classes: string;
}

export const GROUP_THEME_OPTIONS: GroupThemeOption[] = [
  { id: 'skyline', label: 'Skyline', classes: 'from-blue-500 via-cyan-500 to-indigo-600' },
  { id: 'sunset', label: 'Sunset', classes: 'from-orange-500 via-rose-500 to-pink-600' },
  { id: 'mint', label: 'Mint', classes: 'from-emerald-500 via-teal-500 to-cyan-600' },
  { id: 'violet', label: 'Violet', classes: 'from-violet-500 via-fuchsia-500 to-pink-600' },
  { id: 'ember', label: 'Ember', classes: 'from-amber-500 via-orange-500 to-red-600' },
  { id: 'midnight', label: 'Midnight', classes: 'from-slate-700 via-blue-700 to-indigo-900' },
];

export function getGroupTheme(themeId?: string | null, fallbackSeed = 'snaplink') {
  const explicitTheme = GROUP_THEME_OPTIONS.find((theme) => theme.id === themeId);
  if (explicitTheme) {
    return explicitTheme;
  }

  let hash = 0;
  for (let index = 0; index < fallbackSeed.length; index += 1) {
    hash = fallbackSeed.charCodeAt(index) + ((hash << 5) - hash);
  }

  return GROUP_THEME_OPTIONS[Math.abs(hash) % GROUP_THEME_OPTIONS.length];
}
