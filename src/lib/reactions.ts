import type { UserProfile } from '../contexts/AuthContext';

export type ReactionDef = {
  emoji: string;
  label: string;
  svgId: 'snap' | 'fire' | 'love' | 'hype' | 'laugh' | 'crown';
  color: string;
  bgColor: string;
  burstClass: string;
  chipClass: string;
  /** Particles emitted on burst */
  particleColors: string[];
};

export const SNAPLINK_REACTION_SET: readonly ReactionDef[] = [
  {
    emoji: '💙',
    label: 'Boost',
    svgId: 'snap',
    color: '#1677ff',
    bgColor: 'rgba(22, 119, 255, 0.12)',
    burstClass: 'from-blue-500 to-cyan-400',
    chipClass: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200',
    particleColors: ['#1677ff', '#38bdf8', '#93c5fd'],
  },
  {
    emoji: '🔥',
    label: 'Fire',
    svgId: 'fire',
    color: '#f97316',
    bgColor: 'rgba(249, 115, 22, 0.12)',
    burstClass: 'from-orange-500 to-amber-500',
    chipClass: 'bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300',
    particleColors: ['#f97316', '#fbbf24', '#fb923c'],
  },
  {
    emoji: '⚡',
    label: 'Snap',
    svgId: 'snap',
    color: '#eab308',
    bgColor: 'rgba(234, 179, 8, 0.12)',
    burstClass: 'from-yellow-400 to-amber-500',
    chipClass: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
    particleColors: ['#eab308', '#fde047', '#facc15'],
  },
  {
    emoji: '🚀',
    label: 'Hype',
    svgId: 'hype',
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.12)',
    burstClass: 'from-sky-500 to-blue-500',
    chipClass: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
    particleColors: ['#3b82f6', '#60a5fa', '#93c5fd'],
  },
  {
    emoji: '👑',
    label: 'Crown',
    svgId: 'crown',
    color: '#8b5cf6',
    bgColor: 'rgba(139, 92, 246, 0.12)',
    burstClass: 'from-violet-500 to-purple-500',
    chipClass: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
    particleColors: ['#8b5cf6', '#a78bfa', '#c4b5fd'],
  },
  {
    emoji: '😂',
    label: 'Laugh',
    svgId: 'laugh',
    color: '#06b6d4',
    bgColor: 'rgba(6, 182, 212, 0.12)',
    burstClass: 'from-cyan-400 to-teal-500',
    chipClass: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300',
    particleColors: ['#06b6d4', '#22d3ee', '#67e8f9'],
  },
] as const;

export const POST_REACTIONS = SNAPLINK_REACTION_SET.map((reaction) => reaction.emoji);

export type PostReaction = (typeof POST_REACTIONS)[number];

export function canUsePostReactions(_userProfile?: Pick<UserProfile, 'isPremium' | 'premiumUntil'> | null) {
  return true;
}

export function normalizePostReaction(value?: string | null): PostReaction | null {
  if (!value) return null;
  return POST_REACTIONS.includes(value as PostReaction) ? (value as PostReaction) : null;
}

export function getReactionMeta(reaction?: string | null): ReactionDef {
  return SNAPLINK_REACTION_SET.find((item) => item.emoji === reaction) || SNAPLINK_REACTION_SET[0];
}

export function adjustReactionCounts(
  currentCounts: Record<string, number> | undefined,
  previousReaction: string | null | undefined,
  nextReaction: string | null | undefined
) {
  const nextCounts = { ...(currentCounts || {}) };

  if (previousReaction) {
    nextCounts[previousReaction] = Math.max((nextCounts[previousReaction] || 0) - 1, 0);
    if (nextCounts[previousReaction] === 0) {
      delete nextCounts[previousReaction];
    }
  }

  if (nextReaction) {
    nextCounts[nextReaction] = (nextCounts[nextReaction] || 0) + 1;
  }

  return nextCounts;
}

export function getTopReactionEntries(reactionCounts?: Record<string, number> | null, limit = 3) {
  return Object.entries(reactionCounts || {})
    .filter(([, count]) => count > 0)
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([emoji, count]) => ({
      emoji: normalizePostReaction(emoji) || emoji,
      count,
      meta: getReactionMeta(emoji),
    }));
}
