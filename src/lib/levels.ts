import { collection, doc, getDoc, runTransaction } from 'firebase/firestore';
import type { UserProfile } from '../contexts/AuthContext';
import { db } from './firebase';
import { getShopItemById, SHOP_ITEMS, type ShopItem, type ShopRarity } from './shopCatalog';
import { getEventBoostForUser } from './events';

export const MAX_LEVEL = 100;
const BASE_XP_PER_LEVEL = 100;
const XP_LEVEL_STEP = 25;
export const LEVEL_REWARD_COLLECTION = 'user_reward_boxes';

export interface LevelRewardBox {
  id: string;
  userId: string;
  level: number;
  createdAt: string;
  claimed: boolean;
  openedAt?: string | null;
  rewardType: 'coins' | 'item';
  coins?: number;
  itemId?: string | null;
  itemName?: string | null;
  rarity?: ShopRarity | 'special';
  message: string;
}

interface ProgressAwardInput {
  xp?: number;
  snapCoins?: number;
}

interface LevelProgressState {
  level: number;
  totalXp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  xpRemaining: number;
  progressRatio: number;
}

export function getXpForLevel(level: number) {
  if (level >= MAX_LEVEL) return 0;
  return BASE_XP_PER_LEVEL + Math.max(0, level - 1) * XP_LEVEL_STEP;
}

export function getTotalXpForLevel(level: number) {
  const safeLevel = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  let total = 0;

  for (let currentLevel = 1; currentLevel < safeLevel; currentLevel += 1) {
    total += getXpForLevel(currentLevel);
  }

  return total;
}

export function getLevelProgress(totalXp: number): LevelProgressState {
  let remainingXp = Math.max(0, Math.floor(totalXp));
  let level = 1;

  while (level < MAX_LEVEL) {
    const xpNeeded = getXpForLevel(level);
    if (remainingXp < xpNeeded) break;
    remainingXp -= xpNeeded;
    level += 1;
  }

  if (level >= MAX_LEVEL) {
    return {
      level: MAX_LEVEL,
      totalXp: Math.max(0, Math.floor(totalXp)),
      xpIntoLevel: 0,
      xpForNextLevel: 0,
      xpRemaining: 0,
      progressRatio: 1,
    };
  }

  const xpForNextLevel = getXpForLevel(level);

  return {
    level,
    totalXp: Math.max(0, Math.floor(totalXp)),
    xpIntoLevel: remainingXp,
    xpForNextLevel,
    xpRemaining: Math.max(xpForNextLevel - remainingXp, 0),
    progressRatio: xpForNextLevel > 0 ? remainingXp / xpForNextLevel : 1,
  };
}

export function normalizeUserProgress(profile?: Partial<UserProfile> | null) {
  const totalXp = Math.max(0, Math.floor(profile?.totalXp || 0));
  const progress = getLevelProgress(totalXp);

  return {
    level: profile?.level ? Math.max(1, Math.min(MAX_LEVEL, Math.floor(profile.level))) : progress.level,
    totalXp,
    xp: typeof profile?.xp === 'number' ? Math.max(0, Math.floor(profile.xp)) : progress.xpIntoLevel,
    xpForNextLevel: progress.xpForNextLevel,
    xpRemaining: progress.xpRemaining,
    progressRatio: progress.progressRatio,
  };
}

function createRewardSeed(userId: string, level: number) {
  let hash = 2166136261;
  const input = `${userId}:${level}`;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function pickRewardItem(userId: string, level: number, unlockedIds: string[]) {
  const availableItems = SHOP_ITEMS.filter((item) => !unlockedIds.includes(item.id));
  if (!availableItems.length) return null;

  const highTierItems = availableItems.filter((item) => item.rarity === 'legendary' || item.rarity === 'epic');
  const mediumTierItems = availableItems.filter((item) => item.rarity === 'rare');
  const commonItems = availableItems.filter((item) => item.rarity === 'common');

  let rewardPool: ShopItem[] = availableItems;
  if (level % 10 === 0 && highTierItems.length > 0) {
    rewardPool = highTierItems;
  } else if (level % 5 === 0 && mediumTierItems.length > 0) {
    rewardPool = mediumTierItems;
  } else if (commonItems.length > 0) {
    rewardPool = commonItems;
  }

  const seed = createRewardSeed(userId, level);
  return rewardPool[seed % rewardPool.length];
}

function buildRewardBox(userId: string, level: number, unlockedIds: string[]): Omit<LevelRewardBox, 'id'> {
  const guaranteedItem = level % 5 === 0;
  const rewardItem = guaranteedItem ? pickRewardItem(userId, level, unlockedIds) : null;

  if (rewardItem) {
    return {
      userId,
      level,
      createdAt: new Date().toISOString(),
      claimed: false,
      openedAt: null,
      rewardType: 'item',
      itemId: rewardItem.id,
      itemName: rewardItem.name,
      rarity: rewardItem.rarity,
      message: `SnapLink sent you a ${rewardItem.name} unlock for reaching level ${level}.`,
    };
  }

  const coinReward = 120 + level * 18 + (level % 3) * 15;
  return {
    userId,
    level,
    createdAt: new Date().toISOString(),
    claimed: false,
    openedAt: null,
    rewardType: 'coins',
    coins: coinReward,
    rarity: level % 10 === 0 ? 'special' : 'common',
    message: `SnapLink packed ${coinReward} SnapCoins into your level ${level} gift box.`,
  };
}

export async function awardUserProgress(userId: string, reward: ProgressAwardInput) {
  if (!userId) return { rewards: [] as LevelRewardBox[], leveledUpTo: null as number | null };
  const eventBoost = await getEventBoostForUser(userId);
  const xpToAdd = Math.max(0, Math.floor((reward.xp || 0) * eventBoost.xpMultiplier));
  const coinsToAdd = Math.floor((reward.snapCoins || 0) * eventBoost.coinMultiplier);

  if (xpToAdd === 0 && coinsToAdd === 0) {
    return { rewards: [] as LevelRewardBox[], leveledUpTo: null as number | null };
  }

  const userRef = doc(db, 'users', userId);
  const rewardCollection = collection(db, LEVEL_REWARD_COLLECTION);
  const createdRewards: LevelRewardBox[] = [];
  let leveledUpTo: number | null = null;

  await runTransaction(db, async (transaction) => {
    const userSnapshot = await transaction.get(userRef);
    if (!userSnapshot.exists()) return;

    const userData = userSnapshot.data() as UserProfile;
    const normalized = normalizeUserProgress(userData);
    const nextTotalXp = normalized.totalXp + xpToAdd;
    const nextProgress = getLevelProgress(nextTotalXp);
    const unlockedIds = [...(userData.unlockedDecorations || [])];

    transaction.update(userRef, {
      snapCoins: Math.max((userData.snapCoins || 0) + coinsToAdd, 0),
      totalXp: nextTotalXp,
      level: nextProgress.level,
      xp: nextProgress.xpIntoLevel,
    });

    if (nextProgress.level > normalized.level) {
      leveledUpTo = nextProgress.level;

      for (let level = normalized.level + 1; level <= nextProgress.level; level += 1) {
        const rewardRef = doc(rewardCollection);
        const rewardBox = buildRewardBox(userId, level, unlockedIds);
        if (rewardBox.itemId) unlockedIds.push(rewardBox.itemId);

        const finalReward: LevelRewardBox = {
          id: rewardRef.id,
          ...rewardBox,
        };

        transaction.set(rewardRef, finalReward);
        createdRewards.push(finalReward);
      }
    }
  });

  return { rewards: createdRewards, leveledUpTo };
}

export async function claimLevelReward(userId: string, rewardId: string) {
  const rewardRef = doc(db, LEVEL_REWARD_COLLECTION, rewardId);
  const userRef = doc(db, 'users', userId);

  return runTransaction(db, async (transaction) => {
    const [rewardSnapshot, userSnapshot] = await Promise.all([
      transaction.get(rewardRef),
      transaction.get(userRef),
    ]);

    if (!rewardSnapshot.exists() || !userSnapshot.exists()) {
      throw new Error('Reward is no longer available.');
    }

    const rewardBox = rewardSnapshot.data() as LevelRewardBox;
    if (rewardBox.userId !== userId) {
      throw new Error('This gift box does not belong to you.');
    }
    if (rewardBox.claimed) {
      throw new Error('This gift box was already opened.');
    }

    const userData = userSnapshot.data() as UserProfile;
    const unlockedDecorations = [...(userData.unlockedDecorations || [])];

    const nextUserData: Partial<UserProfile> & { snapCoins: number; unlockedDecorations: string[] } = {
      snapCoins: userData.snapCoins || 0,
      unlockedDecorations,
    };

    if (rewardBox.rewardType === 'coins') {
      nextUserData.snapCoins += rewardBox.coins || 0;
    }

    if (rewardBox.rewardType === 'item' && rewardBox.itemId && !unlockedDecorations.includes(rewardBox.itemId)) {
      nextUserData.unlockedDecorations = [...unlockedDecorations, rewardBox.itemId];
    }

    transaction.update(userRef, nextUserData);
    transaction.update(rewardRef, {
      claimed: true,
      openedAt: new Date().toISOString(),
    });

    return rewardBox;
  });
}

export async function getPendingLevelRewardCount(userId: string) {
  if (!userId) return 0;
  const rewardSnapshot = await getDoc(doc(db, LEVEL_REWARD_COLLECTION, userId));
  return rewardSnapshot.exists() ? 1 : 0;
}

export function getRewardSummary(reward: Pick<LevelRewardBox, 'rewardType' | 'coins' | 'itemId' | 'itemName'>) {
  if (reward.rewardType === 'item') {
    const item = getShopItemById(reward.itemId);
    return item?.name || reward.itemName || 'Mystery unlock';
  }

  return `${reward.coins || 0} SnapCoins`;
}
