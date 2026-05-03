import { WORLD_CUP_QUALIFIED_TEAMS } from './worldCup2026';
import type { SnapLinkEventType } from './events';

export type ShopItemType = 'avatar' | 'theme' | 'wallpaper';
export type ShopRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface ShopItem {
  id: string;
  type: ShopItemType;
  name: string;
  price: number;
  url: string;
  desc: string;
  rarity: ShopRarity;
  eventType?: SnapLinkEventType;
}

const CORE_SHOP_ITEMS: ShopItem[] = [
  { id: 'dec_1', type: 'avatar', name: 'Golden Ring', price: 500, url: 'ring-gold', desc: 'A luxurious gold trim for your avatar.', rarity: 'common' },
  { id: 'dec_2', type: 'avatar', name: 'Neon Glow', price: 1000, url: 'neon-glow', desc: 'Radiate with a cyberpunk neon frame.', rarity: 'rare' },
  { id: 'dec_3', type: 'avatar', name: 'Rose Gold', price: 800, url: 'ring-rose', desc: 'Elegant rose gold border for your avatar.', rarity: 'common' },
  { id: 'dec_4', type: 'avatar', name: 'Emerald Pulse', price: 1500, url: 'ring-emerald', desc: 'Pulsing emerald energy ring.', rarity: 'epic' },
  { id: 'dec_5', type: 'avatar', name: 'Crimson Blaze', price: 2000, url: 'ring-crimson', desc: 'Fiery crimson border with glow effect.', rarity: 'legendary' },
  { id: 'dec_6', type: 'avatar', name: 'Ice Crystal', price: 1200, url: 'ring-ice', desc: 'Frozen crystal frame that sparkles.', rarity: 'rare' },
  { id: 'dec_7', type: 'avatar', name: 'Shadow Aura', price: 1800, url: 'ring-shadow', desc: 'Dark mystical aura around your avatar.', rarity: 'epic' },
  { id: 'dec_8', type: 'avatar', name: 'Rainbow Prism', price: 2500, url: 'ring-rainbow', desc: 'Shifting rainbow colors around your avatar.', rarity: 'legendary' },
  { id: 'dec_9', type: 'avatar', name: 'Solar Halo', price: 2200, url: 'ring-solar', desc: 'Warm golden orbit with a soft solar flare.', rarity: 'epic' },
  { id: 'dec_10', type: 'avatar', name: 'Orbit Pulse', price: 2600, url: 'ring-orbit', desc: 'A futuristic violet ring with orbit glow.', rarity: 'legendary' },
  { id: 'dec_11', type: 'avatar', name: 'Mint Current', price: 1700, url: 'ring-mint', desc: 'Fresh teal energy that wraps your profile photo.', rarity: 'rare' },
  { id: 'theme_1', type: 'theme', name: 'Midnight Galaxy', price: 3000, url: 'theme-galaxy', desc: 'Deep space gradient with twinkling stars effect.', rarity: 'epic' },
  { id: 'theme_2', type: 'theme', name: 'Aurora Borealis', price: 3500, url: 'theme-aurora', desc: 'Northern lights shimmer across your profile.', rarity: 'legendary' },
  { id: 'theme_3', type: 'theme', name: 'Sunset Fade', price: 2000, url: 'theme-sunset', desc: 'Warm sunset gradient that wraps your profile.', rarity: 'rare' },
  { id: 'theme_4', type: 'theme', name: 'Ocean Depths', price: 2500, url: 'theme-ocean', desc: 'Deep ocean blue with flowing wave patterns.', rarity: 'epic' },
  { id: 'theme_5', type: 'theme', name: 'Neon City', price: 4000, url: 'theme-neon', desc: 'Cyberpunk neon with animated glitch effects.', rarity: 'legendary' },
  { id: 'theme_6', type: 'theme', name: 'Cherry Blossom', price: 2000, url: 'theme-sakura', desc: 'Soft pink with floating petal animations.', rarity: 'rare' },
  { id: 'theme_7', type: 'theme', name: 'Velvet Ember', price: 3400, url: 'theme-velvet', desc: 'Deep velvet reds with polished gold highlights.', rarity: 'epic' },
  { id: 'theme_8', type: 'theme', name: 'Mint Drift', price: 2300, url: 'theme-mint', desc: 'Light mint glass panels with crisp teal accents.', rarity: 'rare' },
  { id: 'wall_1', type: 'wallpaper', name: 'Cyberpunk City', price: 2000, url: 'https://picsum.photos/seed/cyber/800/200', desc: 'A futuristic skyline for your profile.', rarity: 'rare' },
  { id: 'wall_2', type: 'wallpaper', name: 'Serene Nature', price: 1500, url: 'https://picsum.photos/seed/nature/800/200', desc: 'Calming landscapes to ground you.', rarity: 'common' },
  { id: 'wall_3', type: 'wallpaper', name: 'Mountain Peak', price: 1800, url: 'https://picsum.photos/seed/mountain/800/200', desc: 'Majestic mountain views at dawn.', rarity: 'rare' },
  { id: 'wall_4', type: 'wallpaper', name: 'Northern Lights', price: 2500, url: 'https://picsum.photos/seed/aurora/800/200', desc: 'The aurora dancing in the night sky.', rarity: 'epic' },
  { id: 'wall_5', type: 'wallpaper', name: 'Tokyo Nights', price: 2200, url: 'https://picsum.photos/seed/tokyo/800/200', desc: 'Neon-lit streets of Tokyo after dark.', rarity: 'rare' },
  { id: 'wall_6', type: 'wallpaper', name: 'Deep Space', price: 3000, url: 'https://picsum.photos/seed/space/800/200', desc: 'Stars and nebulae in the vast cosmos.', rarity: 'epic' },
  { id: 'wall_7', type: 'wallpaper', name: 'Tropical Paradise', price: 1500, url: 'https://picsum.photos/seed/tropical/800/200', desc: 'Crystal clear waters and palm trees.', rarity: 'common' },
  { id: 'wall_8', type: 'wallpaper', name: 'Autumn Forest', price: 1800, url: 'https://picsum.photos/seed/autumn/800/200', desc: 'Golden leaves in a misty forest.', rarity: 'rare' },
  { id: 'wall_9', type: 'wallpaper', name: 'Retro Grid', price: 1900, url: 'https://picsum.photos/seed/retrogrid/800/200', desc: 'A glowing synthwave skyline for your profile.', rarity: 'rare' },
  { id: 'wall_10', type: 'wallpaper', name: 'Studio Loft', price: 1600, url: 'https://picsum.photos/seed/loft/800/200', desc: 'Warm soft-light studio vibes with minimal decor.', rarity: 'common' },
  { id: 'wall_11', type: 'wallpaper', name: 'Monaco Dusk', price: 2400, url: 'https://picsum.photos/seed/monaco/800/200', desc: 'City lights reflecting across the water at dusk.', rarity: 'epic' },
  { id: 'wall_12', type: 'wallpaper', name: 'Crystal Cave', price: 2100, url: 'https://picsum.photos/seed/crystalcave/800/200', desc: 'Glowing mineral blues with a luminous edge.', rarity: 'rare' },
];

const WORLD_CUP_SHOP_ITEMS: ShopItem[] = [
  {
    id: 'wc_theme_pitch',
    type: 'theme',
    name: 'Matchday Pitch',
    price: 4200,
    url: 'theme-world-cup-pitch',
    desc: 'A football-first profile theme with stadium glow, turf tones, and neon scoreboard accents.',
    rarity: 'legendary',
    eventType: 'world_cup_2026',
  },
  {
    id: 'wc_theme_night',
    type: 'theme',
    name: 'Night Fixture',
    price: 3600,
    url: 'theme-world-cup-night',
    desc: 'A night-match profile treatment inspired by floodlights, blue steel, and late kick-offs.',
    rarity: 'epic',
    eventType: 'world_cup_2026',
  },
  {
    id: 'wc_wall_hosts',
    type: 'wallpaper',
    name: 'Host City Lights',
    price: 2400,
    url: 'https://picsum.photos/seed/worldcuphostcities/1200/400',
    desc: 'A panoramic host-city wallpaper built for World Cup event mode.',
    rarity: 'epic',
    eventType: 'world_cup_2026',
  },
  {
    id: 'wc_wall_matchday',
    type: 'wallpaper',
    name: 'Matchday Boards',
    price: 2100,
    url: 'https://picsum.photos/seed/worldcupmatchday/1200/400',
    desc: 'Scoreboard-inspired wallpaper with crisp panels and crowd-light gradients.',
    rarity: 'rare',
    eventType: 'world_cup_2026',
  },
  ...WORLD_CUP_QUALIFIED_TEAMS.map((team, index) => ({
    id: `wc_hat_${team.slug}`,
    type: 'avatar' as const,
    name: `${team.name} Matchday Hat`,
    price: 1300 + (index % 5) * 120,
    url: `hat-${team.slug}`,
    desc: `A country supporter hat topper for ${team.name} that unlocks during the World Cup 2026 event.`,
    rarity: (index % 6 === 0 ? 'epic' : index % 3 === 0 ? 'rare' : 'common') as ShopRarity,
    eventType: 'world_cup_2026' as const,
  })),
];

export const SHOP_ITEMS: ShopItem[] = [...CORE_SHOP_ITEMS, ...WORLD_CUP_SHOP_ITEMS];

export const SHOP_RARITY_STYLES: Record<ShopRarity, string> = {
  common: 'text-gray-500 bg-gray-100 dark:bg-gray-700 dark:text-gray-400',
  rare: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400',
  epic: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400',
  legendary: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400',
};

export function getShopItemById(itemId?: string | null) {
  if (!itemId) return null;
  return SHOP_ITEMS.find((item) => item.id === itemId) || null;
}

export function resolveOwnedShopUrl(
  url: string | null | undefined,
  type: ShopItemType,
  unlockedItemIds?: string[] | null
) {
  if (!url) return null;

  const matchingItem = SHOP_ITEMS.find((item) => item.type === type && item.url === url);
  if (!matchingItem) {
    return url;
  }

  return (unlockedItemIds || []).includes(matchingItem.id) ? url : null;
}

export function isShopItemVisibleForEvent(item: ShopItem, activeEventType?: SnapLinkEventType | null, isAdminPreview = false) {
  if (!item.eventType) return true;
  return isAdminPreview || item.eventType === activeEventType;
}
