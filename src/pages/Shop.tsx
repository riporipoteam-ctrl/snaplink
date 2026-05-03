import React, { useMemo, useState } from 'react';
import { doc, updateDoc, arrayUnion, increment } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { ShoppingBag, Star, Image as ImageIcon, Check, Palette, Shirt, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AVATAR_DECORATION_STYLES, PROFILE_THEMES } from '../lib/profileAppearance';
import { SHOP_ITEMS, SHOP_RARITY_STYLES, isShopItemVisibleForEvent, resolveOwnedShopUrl, type ShopItem } from '../lib/shopCatalog';
import { useSnapLinkEvents } from '../contexts/EventContext';
import { Avatar } from '../components/ui/Avatar';
import { Link } from 'react-router-dom';

export function Shop() {
  const { userProfile } = useAuth();
  const { activeEvent } = useSnapLinkEvents();
  const [loading, setLoading] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<'all' | 'wallpaper' | 'avatar' | 'theme'>('all');
  const resolvedProfileDecoration = resolveOwnedShopUrl(userProfile?.profileDecoration || null, 'avatar', userProfile?.unlockedDecorations);
  const resolvedProfileTheme = resolveOwnedShopUrl(userProfile?.profileTheme || null, 'theme', userProfile?.unlockedDecorations);
  const resolvedProfileWallpaper = resolveOwnedShopUrl(userProfile?.bannerURL || null, 'wallpaper', userProfile?.unlockedDecorations);
  const isAdminPreview = userProfile?.role === 'admin' && activeEvent?.type === 'world_cup_2026' && activeEvent.scope === 'admin_preview';

  const visibleItems = useMemo(
    () =>
      SHOP_ITEMS.filter((item) => isShopItemVisibleForEvent(item, activeEvent?.type || null, isAdminPreview)).filter(
        (item) => activeCategory === 'all' || item.type === activeCategory
      ),
    [activeCategory, activeEvent?.type, isAdminPreview]
  );

  const handlePurchase = async (item: ShopItem) => {
    if (!userProfile) return;
    if (userProfile.snapCoins < item.price) {
      alert('Not enough SnapCoins.');
      return;
    }
    if (userProfile.unlockedDecorations?.includes(item.id)) {
      alert('You already own this item.');
      return;
    }

    setLoading(item.id);
    try {
      const userRef = doc(db, 'users', userProfile.uid);
      await updateDoc(userRef, {
        snapCoins: increment(-item.price),
        unlockedDecorations: arrayUnion(item.id),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userProfile.uid}`);
    } finally {
      setLoading(null);
    }
  };

  const handleEquip = async (item: ShopItem) => {
    if (!userProfile) return;
    if (!userProfile.unlockedDecorations?.includes(item.id)) {
      alert("You don't own this item yet.");
      return;
    }
    setLoading(`equip_${item.id}`);
    try {
      const userRef = doc(db, 'users', userProfile.uid);
      if (item.type === 'avatar') {
        await updateDoc(userRef, { profileDecoration: item.url });
      } else if (item.type === 'wallpaper') {
        await updateDoc(userRef, { bannerURL: item.url });
      } else if (item.type === 'theme') {
        await updateDoc(userRef, { profileTheme: item.url });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userProfile.uid}`);
    } finally {
      setLoading(null);
    }
  };

  const handleUnequip = async (type: ShopItem['type']) => {
    if (!userProfile) return;
    setLoading(`unequip_${type}`);
    try {
      const userRef = doc(db, 'users', userProfile.uid);
      if (type === 'avatar') {
        await updateDoc(userRef, { profileDecoration: null });
      } else if (type === 'wallpaper') {
        await updateDoc(userRef, { bannerURL: null });
      } else if (type === 'theme') {
        await updateDoc(userRef, { profileTheme: null });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userProfile.uid}`);
    } finally {
      setLoading(null);
    }
  };

  if (!userProfile) return null;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_42%,#f8fafc_100%)] pb-20 dark:bg-[linear-gradient(180deg,#020617_0%,#0f172a_50%,#020617_100%)]">
      <div className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 px-4 py-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/88">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-500">SnapLink shop</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950 dark:text-white">Collect profile gear</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
              The shop is flatter, denser, and event-aware now. Supporter drops unlock during live events and admins can preview them before everyone else.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {activeEvent?.type === 'world_cup_2026' && (
              <Link
                to="/events"
                className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200"
              >
                <Trophy className="h-4 w-4" />
                World Cup drops live
              </Link>
            )}
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200">
              <Star className="h-4 w-4 fill-current" />
              {userProfile.snapCoins} Coins
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
        {activeEvent?.type === 'world_cup_2026' && (
          <div className="overflow-hidden rounded-[28px] border border-emerald-200 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.22),rgba(255,255,255,0.98)_48%),linear-gradient(135deg,#0f766e,#0f172a)] p-6 text-white shadow-xl dark:border-emerald-400/20 dark:bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),rgba(2,6,23,0.96)_48%),linear-gradient(135deg,#065f46,#020617)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-100/70">Event collection</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight">World Cup 2026 supporter drop</h2>
                <p className="mt-3 max-w-2xl text-sm text-white/75">
                  Matchday hats, themed profile surfaces, and supporter wallpapers are live while the tournament event is running.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {['Matchday hats', 'Pitch themes', 'Host wallpapers'].map((label) => (
                  <span key={label} className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-white/85">
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {[
            { id: 'all', label: 'All Items', icon: ShoppingBag },
            { id: 'theme', label: 'Themes', icon: Palette },
            { id: 'wallpaper', label: 'Wallpapers', icon: ImageIcon },
            { id: 'avatar', label: 'Avatar Gear', icon: Shirt },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as typeof activeCategory)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeCategory === cat.id
                  ? 'bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <cat.icon className="h-4 w-4" />
              {cat.label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.05fr_2fr]">
          <div className="space-y-4">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Equipped now</p>
              <div className="mt-5 flex items-center gap-4">
                <Avatar
                  src={userProfile.photoURL}
                  alt={userProfile.displayName}
                  size="xl"
                  className={resolvedProfileDecoration ? AVATAR_DECORATION_STYLES[resolvedProfileDecoration] : ''}
                  animated={false}
                />
                <div className="min-w-0">
                  <p className="truncate text-lg font-black text-slate-950 dark:text-white">{userProfile.displayName}</p>
                  <p className="truncate text-sm text-slate-500 dark:text-slate-400">@{userProfile.username}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 dark:border-slate-700 dark:bg-slate-900">
                      Border: {resolvedProfileDecoration ? 'Equipped' : 'None'}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 dark:border-slate-700 dark:bg-slate-900">
                      Theme: {resolvedProfileTheme ? 'Equipped' : 'None'}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 dark:border-slate-700 dark:bg-slate-900">
                      Wallpaper: {resolvedProfileWallpaper ? 'Equipped' : 'None'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Shop notes</p>
              <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                  New supporter gear appears automatically during event windows and admin previews.
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                  Avatar gear now supports matchday topper overlays, so country hats actually show above the profile photo.
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <AnimatePresence mode="popLayout">
              {visibleItems.map((item) => {
                const isOwned = userProfile.unlockedDecorations?.includes(item.id);
                const isEquipped =
                  item.type === 'avatar'
                    ? resolvedProfileDecoration === item.url
                    : item.type === 'theme'
                    ? resolvedProfileTheme === item.url
                    : resolvedProfileWallpaper === item.url;

                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    key={item.id}
                    className="flex h-full flex-col overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950"
                  >
                    <div className="relative h-44 overflow-hidden border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
                      {item.type === 'wallpaper' ? (
                        <img src={item.url} alt={item.name} className="h-full w-full object-cover" />
                      ) : item.type === 'theme' ? (
                        <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${PROFILE_THEMES[item.url as keyof typeof PROFILE_THEMES]?.bg || 'from-slate-900 to-slate-700'}`}>
                          <div className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-white">
                            Theme preview
                          </div>
                        </div>
                      ) : (
                        <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),rgba(255,255,255,0.92)_58%)] dark:bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),rgba(2,6,23,0.95)_58%)]">
                          <Avatar
                            src={userProfile.photoURL}
                            alt={item.name}
                            size="xl"
                            animated={false}
                            className={AVATAR_DECORATION_STYLES[item.url] || 'border-white'}
                          />
                        </div>
                      )}
                      {item.eventType === 'world_cup_2026' && (
                        <span className="absolute left-3 top-3 rounded-full bg-emerald-500 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                          Event drop
                        </span>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-lg font-black text-slate-950 dark:text-white">{item.name}</h3>
                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{item.desc}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${SHOP_RARITY_STYLES[item.rarity]}`}>
                          {item.rarity}
                        </span>
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <div className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-sm font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
                          <Star className="h-4 w-4 fill-current" />
                          {item.price}
                        </div>
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{item.type}</span>
                      </div>

                      <div className="mt-5 flex gap-2">
                        {isOwned ? (
                          <>
                            <Button
                              className={`flex-1 rounded-full ${isEquipped ? 'bg-emerald-500 text-white hover:bg-emerald-600' : ''}`}
                              onClick={() => handleEquip(item)}
                              disabled={isEquipped || loading === `equip_${item.id}`}
                              variant={isEquipped ? 'default' : 'outline'}
                            >
                              {loading === `equip_${item.id}` ? 'Equipping...' : isEquipped ? <><Check className="mr-2 h-4 w-4" /> Equipped</> : 'Equip'}
                            </Button>
                            {isEquipped && (
                              <Button
                                variant="outline"
                                onClick={() => handleUnequip(item.type)}
                                disabled={loading === `unequip_${item.type}`}
                                className="rounded-full border-red-200 text-red-500 hover:bg-red-50 dark:border-red-400/20 dark:hover:bg-red-500/10"
                              >
                                Remove
                              </Button>
                            )}
                          </>
                        ) : (
                          <Button
                            className="w-full rounded-full bg-slate-950 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                            onClick={() => handlePurchase(item)}
                            disabled={loading === item.id || userProfile.snapCoins < item.price}
                          >
                            {loading === item.id ? 'Buying...' : userProfile.snapCoins >= item.price ? 'Unlock' : 'Need more coins'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
