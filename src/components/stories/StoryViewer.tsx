import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Eye, Flag, Flame, Heart, MessageCircleHeart, MoreHorizontal, Trash2, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Avatar } from '../ui/Avatar';
import type { UserProfile } from '../../contexts/AuthContext';
import {
  createStoryReport,
  deleteStory,
  fetchStoryInteractions,
  rememberViewedStory,
  registerStoryReaction,
  registerStoryView,
  type StoryAuthorGroup,
  type StoryReaction,
} from '../../lib/stories';

interface StoryViewerProps {
  isOpen: boolean;
  onClose: () => void;
  groups: StoryAuthorGroup[];
  initialAuthorId?: string | null;
  viewer?: UserProfile | null;
}

export function StoryViewer({ isOpen, onClose, groups, initialAuthorId, viewer }: StoryViewerProps) {
  const [activeAuthorIndex, setActiveAuthorIndex] = useState(0);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [storyProgress, setStoryProgress] = useState(0);
  const [interactions, setInteractions] = useState<{
    views: Array<{ userId: string; displayName?: string; photoURL?: string | null; createdAt: string }>;
    reactions: Array<{ userId: string; reaction: StoryReaction; displayName?: string; photoURL?: string | null; createdAt: string }>;
  }>({ views: [], reactions: [] });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const authorIndex = Math.max(
      0,
      groups.findIndex((group) => group.authorId === initialAuthorId)
    );
    setActiveAuthorIndex(authorIndex === -1 ? 0 : authorIndex);
    setActiveStoryIndex(0);
    setShowMenu(false);
    setShowInsights(false);
  }, [groups, initialAuthorId, isOpen]);

  const activeGroup = groups[activeAuthorIndex];
  const activeStory = activeGroup?.stories[activeStoryIndex];
  const isOwner = Boolean(viewer?.uid && activeStory?.authorId === viewer.uid);
  const canModerate = isOwner || viewer?.role === 'admin';

  useEffect(() => {
    setShowMenu(false);
    setShowInsights(false);
    setStoryProgress(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [activeStory?.id]);

  const nextStory = React.useCallback(() => {
    if (!activeGroup) return onClose();
    if (activeStoryIndex < activeGroup.stories.length - 1) {
      setActiveStoryIndex((current) => current + 1);
      return;
    }
    if (activeAuthorIndex < groups.length - 1) {
      setActiveAuthorIndex((current) => current + 1);
      setActiveStoryIndex(0);
      return;
    }
    onClose();
  }, [activeAuthorIndex, activeGroup, activeStoryIndex, groups.length, onClose]);

  const previousStory = React.useCallback(() => {
    if (!activeGroup) return;
    if (activeStoryIndex > 0) {
      setActiveStoryIndex((current) => current - 1);
      return;
    }
    if (activeAuthorIndex > 0) {
      const previousAuthorIndex = activeAuthorIndex - 1;
      setActiveAuthorIndex(previousAuthorIndex);
      setActiveStoryIndex(Math.max(0, groups[previousAuthorIndex].stories.length - 1));
    }
  }, [activeAuthorIndex, activeGroup, activeStoryIndex, groups]);

  useEffect(() => {
    if (!isOpen || !activeStory) return;

    rememberViewedStory(activeStory.id, viewer);
    void registerStoryView(activeStory, viewer || null);
    void fetchStoryInteractions(activeStory.id).then(setInteractions).catch(() => {
      setInteractions({ views: [], reactions: [] });
    });
  }, [activeStory, isOpen, nextStory, viewer]);

  useEffect(() => {
    if (!isOpen || !activeStory) return;

    setStoryProgress(0);

    if (activeStory.mediaType === 'image') {
      const durationMs = 7000;
      let rafId = 0;
      const startedAt = performance.now();

      const step = (now: number) => {
        const nextProgress = Math.min(1, (now - startedAt) / durationMs);
        setStoryProgress(nextProgress);
        if (nextProgress >= 1) {
          nextStory();
          return;
        }
        rafId = window.requestAnimationFrame(step);
      };

      rafId = window.requestAnimationFrame(step);
      return () => window.cancelAnimationFrame(rafId);
    }

    const video = videoRef.current;
    let progressInterval: number | null = null;
    const fallbackId = window.setTimeout(() => {
      setStoryProgress(1);
      nextStory();
    }, 20000);

    const syncVideoProgress = () => {
      if (!video) return;
      if (video.duration && Number.isFinite(video.duration) && video.duration > 0) {
        setStoryProgress(Math.min(1, video.currentTime / video.duration));
      }
    };

    const handleEnded = () => {
      setStoryProgress(1);
      nextStory();
    };

    if (video) {
      video.currentTime = 0;
      video.play().catch(() => undefined);
      syncVideoProgress();
      video.addEventListener('ended', handleEnded);
      video.addEventListener('loadedmetadata', syncVideoProgress);
      video.addEventListener('durationchange', syncVideoProgress);
      video.addEventListener('timeupdate', syncVideoProgress);
      progressInterval = window.setInterval(syncVideoProgress, 120);
    }

    return () => {
      window.clearTimeout(fallbackId);
      if (progressInterval !== null) {
        window.clearInterval(progressInterval);
      }
      if (video) {
        video.removeEventListener('ended', handleEnded);
        video.removeEventListener('loadedmetadata', syncVideoProgress);
        video.removeEventListener('durationchange', syncVideoProgress);
        video.removeEventListener('timeupdate', syncVideoProgress);
      }
    };
  }, [activeStory, isOpen, nextStory]);

  useEffect(() => {
    if (!isOpen || !activeStory?.musicUrl || !audioRef.current) return;
    audioRef.current.volume = 0.45;
    audioRef.current.play().catch(() => undefined);
  }, [activeStory?.id, activeStory?.musicUrl, isOpen]);

  const handleReact = async (reaction: StoryReaction) => {
    if (!viewer || !activeStory) return;
    await registerStoryReaction(activeStory, viewer, reaction);
    const refreshed = await fetchStoryInteractions(activeStory.id);
    setInteractions(refreshed);
  };

  const handleDelete = async () => {
    if (!activeStory || !canModerate) return;
    const confirmed = window.confirm('Remove this story?');
    if (!confirmed) return;
    await deleteStory(activeStory);
    nextStory();
  };

  const handleReport = async () => {
    if (!viewer || !activeStory) return;
    const reason = window.prompt('Why are you reporting this story?');
    if (!reason?.trim()) return;
    await createStoryReport(activeStory, viewer, reason.trim());
    setShowMenu(false);
    alert('Story reported.');
  };

  const insightSummary = useMemo(
    () =>
      interactions.reactions.reduce<Record<string, number>>((acc, reaction) => {
        acc[reaction.reaction] = (acc[reaction.reaction] || 0) + 1;
        return acc;
      }, {}),
    [interactions.reactions]
  );

  if (!isOpen || !activeGroup || !activeStory) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.22),transparent_34%)]" />
      <div className="relative flex h-full flex-col text-white">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex gap-1 px-4 pb-3 pt-4 sm:px-6">
          {activeGroup.stories.map((story, index) => (
            <div key={story.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-white transition-[width] duration-100"
                style={{
                  width:
                    index < activeStoryIndex
                      ? '100%'
                      : index === activeStoryIndex
                        ? `${Math.max(0, Math.min(1, storyProgress)) * 100}%`
                        : '0%',
                }}
              />
            </div>
          ))}
        </div>

        <div className="relative z-20 flex items-start justify-between gap-3 px-4 pt-8 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link to={`/profile/${activeGroup.authorId}`} onClick={onClose}>
              <Avatar
                src={activeGroup.authorPhotoURL || undefined}
                alt={activeGroup.authorName}
                size="md"
                animated={false}
                className="border border-white/25"
              />
            </Link>
            <div className="min-w-0">
              <Link to={`/profile/${activeGroup.authorId}`} onClick={onClose} className="block truncate text-sm font-black">
                {activeGroup.authorName}
              </Link>
              <p className="truncate text-xs text-white/70">
                @{activeGroup.authorUsername} · {formatDistanceToNow(new Date(activeStory.createdAt), { addSuffix: true })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeStory.musicTitle ? (
              <span className="rounded-full border border-white/15 bg-black/35 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-white/88 backdrop-blur-sm">
                {activeStory.musicTitle}
              </span>
            ) : null}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setShowMenu((current) => !current);
              }}
              className="rounded-full bg-white/10 p-2 text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onClose();
              }}
              className="rounded-full bg-white/10 p-2 text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {showMenu ? (
          <div className="absolute right-4 top-20 z-30 w-56 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/90 shadow-2xl backdrop-blur-xl sm:right-6">
            {(canModerate || viewer?.role === 'admin') && (
              <button
                type="button"
                onClick={handleDelete}
                className="flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/8"
              >
                <Trash2 className="h-4 w-4 text-red-300" />
                Remove story
              </button>
            )}
            <button
              type="button"
              onClick={handleReport}
              className="flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/8"
            >
              <Flag className="h-4 w-4 text-amber-300" />
              Report story
            </button>
            {canModerate && (
              <button
                type="button"
                onClick={() => {
                  setShowInsights((current) => !current);
                  setShowMenu(false);
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/8"
              >
                <Eye className="h-4 w-4 text-blue-300" />
                {showInsights ? 'Hide insights' : 'Show insights'}
              </button>
            )}
          </div>
        ) : null}

        <button
          type="button"
          aria-label="Previous story"
          onClick={previousStory}
          className="absolute bottom-28 left-0 top-20 z-10 w-[32%] bg-transparent sm:w-24"
        />
        <button
          type="button"
          aria-label="Next story"
          onClick={nextStory}
          className="absolute bottom-28 right-0 top-20 z-10 w-[32%] bg-transparent sm:w-24"
        />
        <button type="button" onClick={previousStory} className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-20 items-center justify-start pl-4 text-white/60 transition hover:text-white sm:flex">
          <ChevronLeft className="h-8 w-8" />
        </button>
        <button type="button" onClick={nextStory} className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-20 items-center justify-end pr-4 text-white/60 transition hover:text-white sm:flex">
          <ChevronRight className="h-8 w-8" />
        </button>

        <div className="relative flex flex-1 items-center justify-center px-4 pb-28 pt-6 sm:px-6">
          <div className="pointer-events-none absolute inset-0">
            {activeStory.mediaType === 'video' ? (
              <video
                ref={videoRef}
                src={activeStory.mediaUrl}
                className="h-full w-full object-contain"
                playsInline
                autoPlay
                controls={false}
                onEnded={nextStory}
              />
            ) : (
              <img src={activeStory.mediaUrl} alt={activeStory.caption || activeGroup.authorName} className="h-full w-full object-contain" />
            )}
          </div>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />

          {activeStory.caption ? (
            <div
              className={`pointer-events-none absolute bottom-28 left-1/2 z-10 w-[min(92vw,34rem)] -translate-x-1/2 rounded-[1.6rem] px-5 py-4 text-center text-white shadow-2xl backdrop-blur-md ${
                activeStory.captionStyle === 'headline'
                  ? 'bg-black/28 text-[1.35rem] font-black uppercase tracking-[0.02em]'
                  : activeStory.captionStyle === 'mono'
                    ? 'bg-black/30 font-mono text-[1rem] font-semibold'
                    : 'bg-black/24 text-[1.1rem] font-semibold'
              }`}
            >
              {activeStory.caption}
            </div>
          ) : null}
        </div>

        {showInsights && canModerate ? (
          <div className="absolute bottom-28 right-4 z-20 w-[min(22rem,calc(100vw-2rem))] rounded-[1.75rem] border border-white/10 bg-slate-950/88 p-4 text-white shadow-2xl backdrop-blur-xl sm:right-6">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/55">Story insights</p>
                <p className="text-sm font-bold">Views and reactions</p>
              </div>
              <div className="rounded-full bg-white/8 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em]">
                {interactions.views.length} views
              </div>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              {(['heart', 'fire', 'wow'] as StoryReaction[]).map((key) => (
                <span key={key} className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs font-semibold">
                  {key} · {insightSummary[key] || 0}
                </span>
              ))}
            </div>
            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {interactions.reactions.map((entry) => (
                <div key={`${entry.userId}-${entry.reaction}`} className="flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-2">
                  <Avatar src={entry.photoURL || undefined} alt={entry.displayName || entry.userId} size="sm" animated={false} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{entry.displayName || entry.userId}</p>
                    <p className="text-xs text-white/60">{entry.reaction}</p>
                  </div>
                </div>
              ))}
              {interactions.reactions.length === 0 && (
                <p className="rounded-2xl bg-white/5 px-3 py-4 text-sm text-white/70">No reactions yet.</p>
              )}
            </div>
          </div>
        ) : null}

        <div className="relative z-20 border-t border-white/10 bg-black/34 px-4 py-4 backdrop-blur-xl sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleReact('heart')}
                className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/16"
              >
                <Heart className="h-4 w-4 fill-current text-pink-400" />
                Heart
              </button>
              <button
                type="button"
                onClick={() => handleReact('fire')}
                className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/16"
              >
                <Flame className="h-4 w-4 fill-current text-orange-400" />
                Fire
              </button>
              <button
                type="button"
                onClick={() => handleReact('wow')}
                className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/16"
              >
                <MessageCircleHeart className="h-4 w-4 text-blue-300" />
                Wow
              </button>
            </div>

            <div className="flex items-center gap-4 text-sm font-semibold text-white/82">
              <span>{interactions.views.length || activeStory.viewsCount || 0} views</span>
              <span>{interactions.reactions.length || activeStory.reactionsCount || 0} reactions</span>
            </div>
          </div>
        </div>

        {activeStory.musicUrl ? <audio ref={audioRef} src={activeStory.musicUrl} loop hidden /> : null}
      </div>
    </div>
  );
}
