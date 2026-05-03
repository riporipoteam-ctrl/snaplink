import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Coins, Gift, Image as ImageIcon, Palette, PackageOpen, Sparkles, Stars, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { claimLevelReward, getRewardSummary, type LevelRewardBox } from '../../lib/levels';
import { getShopItemById, type ShopItem, type ShopRarity } from '../../lib/shopCatalog';

const REWARD_SURFACE_STYLES: Record<ShopRarity | 'special' | 'default', { glow: string; badge: string; border: string; accent: string }> = {
  common: {
    glow: 'from-slate-100/95 via-white to-slate-100/90',
    badge: 'bg-slate-900 text-white',
    border: 'border-slate-200/90',
    accent: 'text-slate-700',
  },
  rare: {
    glow: 'from-cyan-100 via-white to-sky-100/95',
    badge: 'bg-sky-600 text-white',
    border: 'border-sky-200/90',
    accent: 'text-sky-700',
  },
  epic: {
    glow: 'from-fuchsia-100 via-white to-violet-100/95',
    badge: 'bg-violet-600 text-white',
    border: 'border-violet-200/90',
    accent: 'text-violet-700',
  },
  legendary: {
    glow: 'from-amber-100 via-white to-orange-100/95',
    badge: 'bg-amber-500 text-slate-950',
    border: 'border-amber-200/90',
    accent: 'text-amber-700',
  },
  special: {
    glow: 'from-emerald-100 via-white to-cyan-100/95',
    badge: 'bg-emerald-500 text-white',
    border: 'border-emerald-200/90',
    accent: 'text-emerald-700',
  },
  default: {
    glow: 'from-slate-100/95 via-white to-slate-100/90',
    badge: 'bg-slate-900 text-white',
    border: 'border-slate-200/90',
    accent: 'text-slate-700',
  },
};

function getRewardAppearance(rarity?: LevelRewardBox['rarity'] | null) {
  if (!rarity) return REWARD_SURFACE_STYLES.default;
  return REWARD_SURFACE_STYLES[rarity] || REWARD_SURFACE_STYLES.default;
}

function getRewardTypeLabel(item?: ShopItem | null) {
  if (!item) return 'gift';
  if (item.type === 'avatar') return 'avatar style';
  if (item.type === 'theme') return 'profile theme';
  return 'wallpaper';
}

function RewardPreview({
  reward,
  item,
  compact = false,
}: {
  reward: LevelRewardBox;
  item?: ShopItem | null;
  compact?: boolean;
}) {
  const appearance = getRewardAppearance(reward.rarity);
  const shellClassName = compact
    ? `relative overflow-hidden rounded-[24px] border ${appearance.border} bg-gradient-to-br ${appearance.glow} p-4 text-slate-950`
    : `relative overflow-hidden rounded-[30px] border ${appearance.border} bg-gradient-to-br ${appearance.glow} p-5 text-slate-950 shadow-[0_24px_70px_rgba(15,23,42,0.12)]`;

  if (reward.rewardType === 'coins') {
    return (
      <div className={shellClassName}>
        <div className="absolute -right-10 top-0 h-28 w-28 rounded-full bg-amber-300/35 blur-3xl" />
        <div className="absolute -left-10 bottom-0 h-24 w-24 rounded-full bg-sky-200/35 blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-white">
            <Coins className="h-3.5 w-3.5 text-amber-300" />
            SnapCoins
          </div>
          <div className="mt-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Balance boost</p>
              <h4 className="mt-2 text-4xl font-black tracking-tight text-slate-950">+{(reward.coins || 0).toLocaleString()}</h4>
              <p className="mt-2 max-w-[15rem] text-sm leading-6 text-slate-600">
                {reward.coins || 0} SnapCoins have been dropped straight into your wallet.
              </p>
            </div>
            <div className="grid gap-2 rounded-[24px] bg-white/70 p-3 shadow-inner shadow-white/60">
              {[0, 1, 2].map((index) => (
                <motion.div
                  key={index}
                  initial={{ y: 18, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.08 * index, duration: 0.35 }}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 via-yellow-200 to-amber-400 shadow-[inset_0_2px_0_rgba(255,255,255,0.7)]"
                >
                  <Coins className="h-5 w-5 text-amber-900" />
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const itemLabel = getRewardTypeLabel(item);

  if (item?.type === 'wallpaper') {
    return (
      <div className={shellClassName}>
        <div className="absolute inset-0 bg-slate-950/10" />
        <div className="relative overflow-hidden rounded-[22px] border border-white/60 shadow-[0_20px_50px_rgba(15,23,42,0.12)]">
          <img src={item.url} alt={item.name} className="h-40 w-full object-cover" referrerPolicy="no-referrer" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/75 to-transparent px-4 pb-4 pt-12 text-white">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/70">{itemLabel}</p>
            <h4 className="mt-1 text-2xl font-black tracking-tight">{item.name}</h4>
          </div>
        </div>
        <p className="relative mt-4 text-sm leading-6 text-slate-600">{item.desc}</p>
      </div>
    );
  }

  if (item?.type === 'theme') {
    return (
      <div className={shellClassName}>
        <div className="absolute -right-16 -top-10 h-36 w-36 rounded-full bg-fuchsia-300/35 blur-3xl" />
        <div className="relative overflow-hidden rounded-[24px] border border-white/70 bg-slate-950 p-4 text-white shadow-[0_20px_50px_rgba(15,23,42,0.18)]">
          <div className="rounded-[20px] bg-gradient-to-br from-fuchsia-400 via-violet-500 to-sky-500 p-4">
            <div className="rounded-[18px] border border-white/20 bg-slate-950/30 p-4 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/70">Theme unlocked</p>
                <Palette className="h-4 w-4 text-white/80" />
              </div>
              <div className="mt-5 space-y-2">
                <div className="h-3 w-20 rounded-full bg-white/75" />
                <div className="h-2.5 w-28 rounded-full bg-white/50" />
                <div className="grid grid-cols-3 gap-2 pt-3">
                  <div className="h-14 rounded-2xl bg-white/20" />
                  <div className="h-14 rounded-2xl bg-white/10" />
                  <div className="h-14 rounded-2xl bg-white/15" />
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/60">{itemLabel}</p>
            <h4 className="mt-1 text-2xl font-black tracking-tight">{item.name}</h4>
          </div>
        </div>
        <p className="relative mt-4 text-sm leading-6 text-slate-600">{item.desc}</p>
      </div>
    );
  }

  return (
    <div className={shellClassName}>
      <div className="absolute -right-12 top-0 h-28 w-28 rounded-full bg-amber-300/25 blur-3xl" />
      <div className="absolute -left-12 bottom-0 h-28 w-28 rounded-full bg-sky-200/30 blur-3xl" />
      <div className="relative rounded-[26px] border border-white/80 bg-white/65 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.12)] backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Avatar style</p>
            <h4 className="mt-1 text-2xl font-black tracking-tight text-slate-950">{item?.name || reward.itemName}</h4>
          </div>
          <Stars className={`h-5 w-5 ${appearance.accent}`} />
        </div>
        <div className="mt-5 flex items-center gap-4">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-slate-950 via-slate-800 to-slate-700 text-xl font-black text-white shadow-[0_20px_40px_rgba(15,23,42,0.2)]">
            SL
            <div className="absolute inset-[-7px] rounded-full border-[5px] border-amber-300/80 shadow-[0_0_0_4px_rgba(255,255,255,0.85),0_0_35px_rgba(251,191,36,0.35)]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold capitalize text-slate-600">{itemLabel}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{item?.desc || 'A new style is ready in your collection.'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LevelGiftOverlay() {
  const { userProfile } = useAuth();
  const [rewardBoxes, setRewardBoxes] = useState<LevelRewardBox[]>([]);
  const [isOpening, setIsOpening] = useState(false);
  const [openedReward, setOpenedReward] = useState<LevelRewardBox | null>(null);

  useEffect(() => {
    if (!userProfile?.uid) {
      setRewardBoxes([]);
      return;
    }

    const rewardsQuery = query(collection(db, 'user_reward_boxes'), where('userId', '==', userProfile.uid));
    const unsubscribe = onSnapshot(rewardsQuery, (snapshot) => {
      const pendingRewards = snapshot.docs
        .map((rewardDoc) => rewardDoc.data() as LevelRewardBox)
        .filter((reward) => !reward.claimed)
        .sort((left, right) => left.level - right.level);

      setRewardBoxes(pendingRewards);
    });

    return () => unsubscribe();
  }, [userProfile?.uid]);

  const nextReward = rewardBoxes[0] || null;
  const remainingCount = Math.max(rewardBoxes.length - 1, 0);
  const rewardLabel = useMemo(() => (openedReward ? getRewardSummary(openedReward) : ''), [openedReward]);
  const nextRewardItem = useMemo(() => getShopItemById(nextReward?.itemId), [nextReward?.itemId]);
  const openedRewardItem = useMemo(() => getShopItemById(openedReward?.itemId), [openedReward?.itemId]);
  const openedAppearance = getRewardAppearance(openedReward?.rarity);
  const queuedAfterOpenCount = rewardBoxes.length;

  const handleOpenReward = async () => {
    if (!userProfile?.uid || !nextReward || isOpening) return;

    setIsOpening(true);
    try {
      const reward = await claimLevelReward(userProfile.uid, nextReward.id);
      setOpenedReward(reward as LevelRewardBox);
    } catch (error) {
      console.error('Failed to open reward box:', error);
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {nextReward && !openedReward && (
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 28, scale: 0.94 }}
            className="pointer-events-none fixed bottom-6 right-6 z-[110] w-[min(92vw,24rem)]"
          >
            <motion.div
              drag
              dragMomentum={false}
              dragElastic={0.18}
              className="pointer-events-auto overflow-hidden rounded-[30px] border border-amber-300/35 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.34),rgba(245,158,11,0.12)_35%,rgba(15,23,42,0.96)_100%)] p-5 text-white shadow-[0_32px_80px_rgba(15,23,42,0.42)]"
            >
              <div className="pointer-events-none absolute inset-0 opacity-75">
                <div className="absolute -top-14 right-3 h-32 w-32 rounded-full bg-amber-300/20 blur-3xl" />
                <div className="absolute bottom-0 left-0 h-28 w-28 rounded-full bg-sky-300/10 blur-3xl" />
              </div>

              <div className="relative">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-100/90">From SnapLink</p>
                    <h3 className="mt-1 text-2xl font-black tracking-tight">Level {nextReward.level} gift box</h3>
                    <p className="mt-2 max-w-[18rem] text-sm leading-6 text-white/80">
                      Crack it open for your reward. This one is queued and ready now.
                    </p>
                  </div>
                  <div className="rounded-full bg-white/10 p-3">
                    <Gift className="h-6 w-6 text-amber-200" />
                  </div>
                </div>

                <div className="mt-4 rounded-[24px] border border-white/10 bg-white/8 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/60">
                        {nextReward.rewardType === 'coins' ? 'Wallet drop' : getRewardTypeLabel(nextRewardItem)}
                      </p>
                      <p className="mt-1 text-lg font-black">{nextReward.rewardType === 'coins' ? `${nextReward.coins || 0} SnapCoins` : nextRewardItem?.name || nextReward.itemName}</p>
                    </div>
                    <div className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-white/75">
                      Level {nextReward.level}
                    </div>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/70">
                    {remainingCount > 0 ? `${remainingCount} more gift boxes are waiting behind this one.` : 'You earned this one from your latest level-up.'}
                  </p>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleOpenReward}
                  disabled={isOpening}
                  className="mt-4 flex w-full items-center justify-between gap-3 rounded-[22px] border border-white/15 bg-white px-4 py-4 text-left text-slate-950 transition-colors hover:bg-amber-50 disabled:opacity-60"
                >
                  <div className="flex items-center gap-3">
                    <motion.div
                      animate={isOpening ? { rotate: [0, -12, 10, -8, 0], scale: [1, 1.08, 1] } : { y: [0, -3, 0] }}
                      transition={isOpening ? { duration: 0.8 } : { duration: 1.8, repeat: Infinity }}
                      className="rounded-2xl bg-amber-100 p-3"
                    >
                      {isOpening ? <PackageOpen className="h-6 w-6 text-amber-700" /> : <Gift className="h-6 w-6 text-amber-700" />}
                    </motion.div>
                    <div>
                      <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-600">{isOpening ? 'Opening now' : 'Open gift box'}</p>
                      <p className="mt-1 text-sm text-slate-500">Tap once and SnapLink will reveal what landed.</p>
                    </div>
                  </div>
                  <Sparkles className="h-5 w-5 text-amber-500" />
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {openedReward && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-end justify-center p-4 sm:p-6 md:items-center"
          >
            <motion.button
              type="button"
              aria-label="Close gift reward"
              onClick={() => setOpenedReward(null)}
              className="absolute inset-0 bg-slate-950/68 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 240, damping: 24 }}
              className={`relative w-full max-w-[54rem] overflow-hidden rounded-[34px] border ${openedAppearance.border} bg-white text-slate-950 shadow-[0_40px_120px_rgba(15,23,42,0.42)]`}
            >
              <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-amber-300 via-fuchsia-400 to-sky-400" />
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute -right-14 top-0 h-44 w-44 rounded-full bg-amber-200/45 blur-3xl" />
                <div className="absolute left-0 top-20 h-36 w-36 rounded-full bg-sky-200/35 blur-3xl" />
              </div>

              <button
                type="button"
                onClick={() => setOpenedReward(null)}
                className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-500 transition hover:text-slate-950"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="relative grid gap-6 p-5 sm:p-6 lg:grid-cols-[0.95fr,1.05fr] lg:p-8">
                <div className="order-2 lg:order-1">
                  <RewardPreview reward={openedReward} item={openedRewardItem} />
                </div>

                <div className="order-1 flex flex-col justify-center lg:order-2">
                  <div className="inline-flex w-fit items-center gap-2 rounded-full bg-slate-950 px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] text-white">
                    <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                    Reward revealed
                  </div>

                  <div className="mt-5">
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Level {openedReward.level} delivery</p>
                    <h3 className="mt-2 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">{rewardLabel}</h3>
                    <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">{openedReward.message}</p>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${openedAppearance.badge}`}>
                      {(openedReward.rarity || 'special').toString()}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-600">
                      {openedReward.rewardType === 'coins' ? <Coins className="h-3.5 w-3.5" /> : openedRewardItem?.type === 'theme' ? <Palette className="h-3.5 w-3.5" /> : openedRewardItem?.type === 'wallpaper' ? <ImageIcon className="h-3.5 w-3.5" /> : <Stars className="h-3.5 w-3.5" />}
                      {openedReward.rewardType === 'coins' ? 'Wallet updated' : 'Collection updated'}
                    </span>
                    {queuedAfterOpenCount > 0 && (
                      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">
                        {queuedAfterOpenCount} more waiting
                      </span>
                    )}
                  </div>

                  <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => setOpenedReward(null)}
                      className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white transition hover:bg-slate-800"
                    >
                      Nice
                    </button>
                    {queuedAfterOpenCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setOpenedReward(null)}
                        className="inline-flex items-center justify-center rounded-full border border-slate-200 px-6 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                      >
                        See next gift box
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
