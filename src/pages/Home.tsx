import React, { useEffect, useMemo, useState } from 'react';
import { collection, query, orderBy, onSnapshot, limit, getDocs, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { AnimatePresence } from 'motion/react';
import { CreatePost } from '../components/post/CreatePost';
import { PostItem } from '../components/post/PostItem';
import { FeedAdCard } from '../components/feed/FeedAdCard';
import { useSnapLinkEvents } from '../contexts/EventContext';
import { Trophy, AlertTriangle } from 'lucide-react';
import { subscribeToActiveAds, type SponsoredAd } from '../lib/business';
import { StoryComposerModal } from '../components/stories/StoryComposerModal';
import { StoriesRail } from '../components/stories/StoriesRail';
import { StoryViewer } from '../components/stories/StoryViewer';
import { groupStoriesByAuthor, subscribeToActiveStories, type StoryRecord } from '../lib/stories';

export function Home() {
  const { userProfile } = useAuth();
  const { activeEvent } = useSnapLinkEvents();
  const [posts, setPosts] = useState<any[]>([]);
  const [ads, setAds] = useState<SponsoredAd[]>([]);
  const [stories, setStories] = useState<StoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedType, setFeedType] = useState<'forYou' | 'following'>('forYou');
  const [isStoryComposerOpen, setIsStoryComposerOpen] = useState(false);
  const [storyViewerAuthorId, setStoryViewerAuthorId] = useState<string | null>(null);
  const viewerUserId = userProfile?.uid || null;
  const blockedUserIds = userProfile?.blockedUserIds || [];
  const blockedUserKey = blockedUserIds.join('|');
  const adFreeFeed = Boolean(userProfile?.isPremium);

  useEffect(() => {
    const unsubscribe = subscribeToActiveStories((nextStories) => {
      setStories(nextStories.filter((story) => !blockedUserIds.includes(story.authorId)));
    });
    return () => unsubscribe();
  }, [blockedUserKey, blockedUserIds]);

  useEffect(() => {
    if (!viewerUserId && feedType === 'following') return;

    setLoading(true);
    let unsubscribe: () => void;
    const blockedSet = new Set(blockedUserIds);

    const fetchPosts = async () => {
      try {
        if (feedType === 'forYou') {
          const postsRef = collection(db, 'posts');
          const q = query(postsRef, orderBy('createdAt', 'desc'), limit(50));
          
          unsubscribe = onSnapshot(q, (snapshot) => {
            const newPosts = snapshot.docs
              .map(doc => ({
                id: doc.id,
                ...doc.data()
              }))
              .filter((post: any) => !post.isSponsored)
              .filter((post: any) => !blockedSet.has(post.authorId));
            setPosts(newPosts);
            setLoading(false);
          }, (error) => {
            setLoading(false);
            try { handleFirestoreError(error, OperationType.LIST, 'posts'); } catch(e) {}
          });
        } else if (feedType === 'following' && viewerUserId) {
          const followsRef = collection(db, 'follows');
          const qFollows = query(followsRef, where('followerId', '==', viewerUserId));
          const followingSnap = await getDocs(qFollows);
          const followingIds = followingSnap.docs.map(doc => doc.data().followingId);
          
          followingIds.push(viewerUserId);

          const postsRef = collection(db, 'posts');
          const q = query(postsRef, orderBy('createdAt', 'desc'), limit(100));

          unsubscribe = onSnapshot(q, (snapshot) => {
            const newPosts = snapshot.docs
              .map(doc => ({ id: doc.id, ...doc.data() as any }))
              .filter(post => followingIds.includes(post.authorId))
              .filter(post => !post.isSponsored)
              .filter(post => !blockedSet.has(post.authorId));
            
            setPosts(newPosts);
            setLoading(false);
          }, (error) => {
            setLoading(false);
            try { handleFirestoreError(error, OperationType.LIST, 'posts'); } catch(e) {}
          });
        }
      } catch (error) {
        console.error("Error fetching posts:", error);
        setLoading(false);
      }
    };

    fetchPosts();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [blockedUserKey, feedType, viewerUserId]);

  useEffect(() => {
    if (adFreeFeed) {
      setAds([]);
      return;
    }

    const unsubscribe = subscribeToActiveAds(setAds);
    return () => unsubscribe();
  }, [adFreeFeed]);

  const feedItems = useMemo(() => {
    const visibleAds = ads.filter((ad) => !blockedUserIds.includes(ad.businessUid));

    if (adFreeFeed || visibleAds.length === 0) {
      return posts.map((post) => ({ type: 'post' as const, id: `post-${post.id}`, post }));
    }

    const nextItems: Array<
      | { type: 'post'; id: string; post: any }
      | { type: 'ad'; id: string; ad: SponsoredAd }
    > = [];

    let adIndex = 0;
    posts.forEach((post, index) => {
      nextItems.push({ type: 'post', id: `post-${post.id}`, post });
      const shouldInjectAd = (index === 1 || (index + 1) % 6 === 0) && adIndex < visibleAds.length;
      if (shouldInjectAd) {
        nextItems.push({
          type: 'ad',
          id: `ad-${visibleAds[adIndex].id}`,
          ad: visibleAds[adIndex],
        });
        adIndex += 1;
      }
    });

    if (nextItems.length === 0 && visibleAds[0]) {
      nextItems.push({ type: 'ad', id: `ad-${visibleAds[0].id}`, ad: visibleAds[0] });
    }

    return nextItems;
  }, [adFreeFeed, ads, blockedUserIds, posts]);

  const storyGroups = useMemo(() => {
    const groups = groupStoriesByAuthor(stories, userProfile || null);
    return groups.sort((left, right) => {
      if (left.authorId === viewerUserId) return -1;
      if (right.authorId === viewerUserId) return 1;
      if (left.hasUnseen !== right.hasUnseen) return left.hasUnseen ? -1 : 1;
      return 0;
    });
  }, [stories, userProfile, viewerUserId]);

  return (
    <div className="snaplink-feed-page min-h-screen pb-24 md:pb-0">
      <div className="snaplink-home-header sticky top-0 z-10 border-b border-slate-200/80 backdrop-blur-xl dark:border-slate-800/80">
        <div className="snaplink-feed-shell py-1">
          <div className="snaplink-feed-titlebar flex items-center justify-between gap-3 px-4 pb-2 pt-1 md:px-5">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-blue-500">Timeline</p>
              <h1 className="font-display text-[1.32rem] font-black tracking-tight text-slate-950 dark:text-white sm:text-[1.65rem]">Home</h1>
            </div>
            {adFreeFeed ? (
              <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-blue-600 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-300">
                Plus ad-free
              </span>
            ) : null}
          </div>

          <div className="snaplink-dense-tabs mt-1 grid grid-cols-2 overflow-hidden border-y border-slate-200/80 dark:border-slate-800/80 md:border-x-0">
            <button
                className={`border-b-[3px] px-4 py-3 text-[15px] font-semibold transition-all ${
                feedType === 'forYou'
                  ? 'border-blue-500 bg-white text-slate-950 dark:bg-slate-950 dark:text-white'
                  : 'border-transparent text-slate-500 hover:bg-slate-100/80 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900/80 dark:hover:text-white'
              }`}
              onClick={() => setFeedType('forYou')}
            >
              For you
            </button>
            <button
                className={`border-b-[3px] px-4 py-3 text-[15px] font-semibold transition-all ${
                feedType === 'following'
                  ? 'border-blue-500 bg-white text-slate-950 dark:bg-slate-950 dark:text-white'
                  : 'border-transparent text-slate-500 hover:bg-slate-100/80 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900/80 dark:hover:text-white'
              }`}
              onClick={() => setFeedType('following')}
            >
              Following
            </button>
          </div>
        </div>
      </div>

      <div className="snaplink-feed-shell pt-0 md:pt-3">
        {activeEvent?.type === 'world_cup_2026' && (
          <div className="snaplink-worldcup-home-banner mb-3 overflow-hidden rounded-[26px] border border-emerald-200 bg-[linear-gradient(135deg,rgba(16,185,129,0.18),rgba(255,255,255,0.98))] px-5 py-4 shadow-sm dark:border-emerald-400/20 dark:bg-[linear-gradient(135deg,rgba(16,185,129,0.14),rgba(2,6,23,0.94))]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-emerald-500/12 p-3 text-emerald-600 dark:text-emerald-300">
                  <Trophy className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-300">World Cup 2026 mode</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">The feed is in matchday mode with supporter drops, themed surfaces, and boosted rewards.</p>
                </div>
              </div>
              <div className="rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-700 shadow-sm dark:bg-slate-900 dark:text-emerald-300">
                2x XP · 2x coins
              </div>
            </div>
          </div>
        )}

        {activeEvent?.type === 'doomsday' && (
          <div className="mb-3 overflow-hidden rounded-[26px] border border-red-200 bg-[linear-gradient(135deg,rgba(239,68,68,0.12),rgba(255,255,255,0.98))] px-5 py-4 shadow-sm dark:border-red-400/20 dark:bg-[linear-gradient(135deg,rgba(239,68,68,0.12),rgba(2,6,23,0.94))]">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-red-500/12 p-3 text-red-600 dark:text-red-300">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-red-600 dark:text-red-300">Doomsday live</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Meteor mode is running right now. Coins, XP, and challenge steps are all doubled for a 20-minute burst.</p>
              </div>
            </div>
          </div>
        )}

        <StoriesRail
          viewer={userProfile}
          groups={storyGroups}
          onCreate={() => setIsStoryComposerOpen(true)}
          onOpenAuthor={(authorId) => setStoryViewerAuthorId(authorId)}
        />

        <div className="snaplink-composer-frame snaplink-feed-composer overflow-hidden border-y border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 md:border-x">
          <CreatePost />
        </div>
      </div>

      {loading ? (
        <div className="snaplink-feed-shell py-2 space-y-0">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse border-b border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 md:border-x">
              <div className="flex items-center space-x-3 mb-3">
                <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-full" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24" />
                </div>
              </div>
              <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg w-full" />
            </div>
          ))}
        </div>
      ) : feedItems.length > 0 ? (
        <div className="snaplink-feed-shell py-2 md:py-4">
          <AnimatePresence mode="popLayout">
            {feedItems.map((item) => (
              item.type === 'post' ? (
                <PostItem key={item.id} post={item.post} />
              ) : (
                <React.Fragment key={item.id}>
                  <FeedAdCard ad={item.ad} />
                </React.Fragment>
              )
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="snaplink-feed-shell py-6">
          <div className="mx-4 rounded-[20px] border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400 md:mx-0">
            No posts yet. Be the first to post!
          </div>
        </div>
      )}

      <StoryComposerModal
        isOpen={isStoryComposerOpen}
        onClose={() => setIsStoryComposerOpen(false)}
        userProfile={userProfile}
      />
      <StoryViewer
        isOpen={Boolean(storyViewerAuthorId)}
        onClose={() => setStoryViewerAuthorId(null)}
        groups={storyGroups}
        initialAuthorId={storyViewerAuthorId}
        viewer={userProfile}
      />
    </div>
  );
}
