import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, ChevronDown, User, Settings, LogOut, Trophy, CalendarDays, MapPin } from 'lucide-react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth, UserProfile } from '../../contexts/AuthContext';
import { Avatar } from '../ui/Avatar';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { VerificationBadge, UserBadges } from '../ui/VerificationBadge';
import { AnimatePresence, motion } from 'motion/react';
import { getAvatarDecorationClass } from '../../lib/profileAppearance';
import { resolveOwnedShopUrl } from '../../lib/shopCatalog';
import { getSuggestedUsersForViewer } from '../../lib/friendSuggestions';
import { useSnapLinkEvents } from '../../contexts/EventContext';
import { WORLD_CUP_2026_FIXTURE_DAYS } from '../../lib/worldCup2026';

export function RightSidebar() {
  const { userProfile, logout } = useAuth();
  const { activeEvent } = useSnapLinkEvents();
  const navigate = useNavigate();
  const [trending, setTrending] = useState<{tag: string, count: number}[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const visibleProfileDecoration = resolveOwnedShopUrl(
    userProfile?.profileDecoration || null,
    'avatar',
    userProfile?.unlockedDecorations
  );
  const worldCupMatchday = useMemo(() => {
    if (activeEvent?.type !== 'world_cup_2026') return null;
    return WORLD_CUP_2026_FIXTURE_DAYS[0] || null;
  }, [activeEvent?.type]);

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const q = query(collection(db, 'hashtags'), orderBy('count', 'desc'), limit(6));
        const snapshot = await getDocs(q);
        
        const sortedTags = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data() as any;
            return {
              tag: data.tag || data.name || `#${docSnap.id}`,
              count: data.count || 0
            };
          })
          .filter(t => t.tag !== '#welcome' && t.tag !== '#snaplink');

        setTrending(sortedTags);
      } catch (error) {
        console.error("Error fetching trending:", error);
      }
    };

    const fetchSuggestedUsers = async () => {
      if (!userProfile) return;
      try {
        const users = await getSuggestedUsersForViewer(userProfile, { limit: 6 });
        setSuggestedUsers(users);
      } catch (error) {
        console.error("Error fetching suggested users:", error);
      }
    };

    fetchTrending();
    fetchSuggestedUsers();
  }, [userProfile]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };
  return (
    <aside className="snaplink-right-rail hidden xl:flex xl:flex-col w-[var(--snaplink-right-rail-width)] pl-4 pr-4 2xl:pl-6 2xl:pr-5 py-4 sticky top-0 h-screen overflow-y-auto shrink-0 bg-transparent">
      <div className="sticky top-0 z-10 bg-transparent pb-4">
        {userProfile && (
          <div ref={accountMenuRef} className="mb-4 relative">
            <div className="snaplink-right-column-card p-3.5 text-left transition-colors">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/profile')}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-1 text-left transition-colors hover:bg-gray-100/80 dark:hover:bg-gray-700/70"
                >
                  <Avatar
                    src={userProfile.photoURL}
                    alt={userProfile.displayName}
                    className={getAvatarDecorationClass(visibleProfileDecoration, '')}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-black text-slate-950 dark:text-white">{userProfile.displayName}</div>
                    <div className="truncate text-xs text-slate-500 dark:text-slate-400">@{userProfile.username}</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAccountMenuOpen((prev) => !prev)}
                  className="flex items-center gap-2 rounded-2xl p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                  {userProfile.role === 'admin' ? 'Admin' : userProfile.role === 'moderator' ? 'Moderator' : userProfile.role === 'member' ? 'Member' : 'User'}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isAccountMenuOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>

            <AnimatePresence>
              {isAccountMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  className="absolute inset-x-0 top-[calc(100%+0.5rem)] rounded-[24px] border border-slate-200/80 bg-[rgba(255,255,255,0.96)] p-2 shadow-xl backdrop-blur dark:border-slate-800 dark:bg-[rgba(5,13,24,0.96)]"
                >
                  <button
                    onClick={() => {
                      setIsAccountMenuOpen(false);
                      navigate('/profile');
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    <User className="h-4 w-4 text-blue-500" />
                    Profile
                  </button>
                  <button
                    onClick={() => {
                      setIsAccountMenuOpen(false);
                      navigate('/settings');
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    <Settings className="h-4 w-4 text-blue-500" />
                    Settings
                  </button>
                  <button
                    onClick={async () => {
                      setIsAccountMenuOpen(false);
                      await logout();
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <LogOut className="h-4 w-4" />
                    Log out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <div className="snaplink-right-column-card snaplink-search-card relative rounded-full px-0 py-0">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearch}
            className="h-12 w-full rounded-[24px] border-none bg-transparent pl-12 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-white dark:placeholder-slate-500 transition-colors"
          />
        </div>
      </div>

      {(activeEvent || userProfile?.role === 'admin') && (
        <div className="snaplink-event-card mb-4 rounded-[24px] border border-emerald-200/80 bg-[linear-gradient(135deg,rgba(16,185,129,0.16),rgba(255,255,255,0.96))] p-4 dark:border-emerald-400/20 dark:bg-[linear-gradient(135deg,rgba(16,185,129,0.18),rgba(15,23,42,0.96))]">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-500/12 p-3 text-emerald-600 dark:text-emerald-300">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-300">Events</p>
              <h2 className="text-lg font-black text-slate-950 dark:text-white">
                {activeEvent?.type === 'world_cup_2026' ? 'World Cup 2026 live' : activeEvent?.title || 'Admin preview ready'}
              </h2>
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            {activeEvent?.announcement || 'Open the Events hub to preview the next major SnapLink takeover before it goes live for everyone.'}
          </p>
          <Button
            size="sm"
            className="mt-4 rounded-full bg-slate-950 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            onClick={() => navigate('/events')}
          >
            Open Events
          </Button>
        </div>
      )}

      {worldCupMatchday && (
        <div className="snaplink-worldcup-score-card mb-4 overflow-hidden rounded-[24px] border border-emerald-200 bg-[linear-gradient(180deg,rgba(240,253,244,0.98),rgba(255,255,255,0.96))] p-4 shadow-lg dark:border-emerald-400/20 dark:bg-[linear-gradient(180deg,rgba(2,44,34,0.96),rgba(2,6,23,0.96))]">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-500/12 p-3 text-emerald-600 dark:text-emerald-300">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-300">World Cup 2026</p>
              <h2 className="text-xl font-black text-slate-950 dark:text-white">{worldCupMatchday.label}</h2>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {worldCupMatchday.matches.slice(0, 3).map((match) => (
              <div key={`${worldCupMatchday.date}-${match.fixture}`} className="rounded-2xl border border-emerald-200/70 bg-white/90 px-3 py-3 dark:border-emerald-400/15 dark:bg-slate-950/70">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-300">Group {match.group}</div>
                <div className="mt-1 text-sm font-bold text-slate-950 dark:text-white">{match.fixture}</div>
                <div className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                  <MapPin className="h-3.5 w-3.5" />
                  {match.venue}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="snaplink-right-column-card snaplink-trending-card mb-4 p-3.5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-extrabold dark:text-white">What&apos;s happening</h2>
          <Link to="/search?q=%23" className="text-xs font-black uppercase tracking-[0.14em] text-blue-500 hover:text-blue-600">
            More
          </Link>
        </div>
        <div className="snaplink-rail-list space-y-1.5">
          {trending.length > 0 ? (
            trending.map((item, i) => (
              <div key={i} className="group flex cursor-pointer items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 transition-colors hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-900" onClick={() => navigate(`/hashtag/${item.tag.replace('#', '')}`)}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-black text-blue-600 transition-colors group-hover:bg-blue-500 group-hover:text-white dark:bg-blue-500/10 dark:text-blue-300">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Trending</p>
                  <p className="truncate font-black dark:text-white">{item.tag}</p>
                </div>
                <p className="shrink-0 text-xs font-semibold text-slate-500 dark:text-slate-400">{item.count}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">Nothing trending right now. Create a hashtag!</p>
          )}
        </div>
      </div>

      <div className="snaplink-right-column-card snaplink-follow-card p-3.5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-extrabold dark:text-white">Who to follow</h2>
          <Link to="/friends" className="text-xs font-black uppercase tracking-[0.14em] text-blue-500 hover:text-blue-600">
            More
          </Link>
        </div>
        <div className="snaplink-rail-list space-y-1.5">
          {suggestedUsers.length > 0 ? (
            suggestedUsers.map(user => (
              <div key={user.uid} className="group flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-transparent px-3 py-2.5 transition-colors hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-900" onClick={() => navigate(`/profile/${user.uid}`)}>
                <div className="flex min-w-0 items-center space-x-3">
                  <Avatar src={user.photoURL} alt={user.displayName} />
                  <div className="flex min-w-0 flex-col">
                    <span className="flex max-w-[150px] items-center truncate text-sm font-bold dark:text-white">
                      {user.displayName}
                      {user.isVerified && <VerificationBadge className="ml-1 w-3.5 h-3.5" />}
                      <UserBadges badges={user.badges} hiddenBadges={user.hiddenBadges} badgeSize="w-3.5 h-3.5" />
                    </span>
                    <span className="max-w-[150px] truncate text-xs text-gray-500 dark:text-gray-400">@{user.username}</span>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="h-8 shrink-0 rounded-full px-3 py-1 text-xs transition-colors group-hover:border-blue-300 group-hover:text-blue-600 dark:border-gray-600 dark:text-gray-300 dark:group-hover:border-blue-500 dark:group-hover:text-blue-300" onClick={(e) => { e.stopPropagation(); navigate(`/profile/${user.uid}`); }}>
                  View
                </Button>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">Suggestions will appear here.</p>
          )}
        </div>
      </div>

      <div className="mt-4 text-center py-4">
        <p className="text-xs text-gray-400 dark:text-gray-600">Made by <span className="font-semibold text-gray-500 dark:text-gray-500">Ripo Team</span></p>
      </div>
    </aside>
  );
}
