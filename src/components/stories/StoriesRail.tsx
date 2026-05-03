import React from 'react';
import { Plus, Play, Sparkles } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import type { StoryAuthorGroup } from '../../lib/stories';
import type { UserProfile } from '../../contexts/AuthContext';

interface StoriesRailProps {
  viewer?: UserProfile | null;
  groups: StoryAuthorGroup[];
  onCreate: () => void;
  onOpenAuthor: (authorId: string) => void;
}

export function StoriesRail({ viewer, groups, onCreate, onOpenAuthor }: StoriesRailProps) {
  return (
    <section className="snaplink-stories-rail mb-0 overflow-hidden border-y border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 md:border-x">
      <div className="px-4 py-3 sm:px-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-blue-500">Stories</p>
            <h2 className="text-base font-black tracking-tight text-slate-950 dark:text-white sm:text-lg">Moments on SnapLink</h2>
          </div>
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-3.5 py-2 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 sm:text-sm sm:normal-case sm:tracking-tight"
          >
            <Plus className="h-4 w-4" />
            Add story
          </button>
        </div>

        <div className="snaplink-story-scroll flex gap-3 overflow-x-auto pb-2">
          <button
            type="button"
            onClick={onCreate}
            className="group relative flex h-[9.2rem] min-w-[6.4rem] shrink-0 flex-col overflow-hidden rounded-[1.15rem] border border-slate-200 bg-[linear-gradient(180deg,#eff6ff_0%,#ffffff_58%)] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-[linear-gradient(180deg,#0f172a_0%,#020617_100%)] sm:h-[10.4rem] sm:min-w-[7rem]"
          >
            <div className="relative flex-1 overflow-hidden">
              {viewer?.photoURL ? (
                <img src={viewer.photoURL} alt={viewer.displayName} className="h-full w-full object-cover opacity-85 transition duration-300 group-hover:scale-105" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,#93c5fd,transparent_60%),linear-gradient(180deg,#dbeafe_0%,#eff6ff_100%)] dark:bg-[radial-gradient(circle_at_top,#2563eb,transparent_60%),linear-gradient(180deg,#0f172a_0%,#020617_100%)]">
                  <Sparkles className="h-8 w-8 text-blue-500 dark:text-blue-300" />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-950/50 via-slate-950/15 to-transparent" />
              <div className="absolute left-2.5 top-2.5 rounded-full border-[3px] border-white bg-blue-500 p-1.5 text-white shadow-lg dark:border-slate-950">
                <Plus className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-center justify-center px-2.5 py-2.5">
              <span className="text-xs font-black tracking-tight text-slate-950 dark:text-white sm:text-sm">Create story</span>
            </div>
          </button>

          {groups.map((group) => {
            const latestStory = group.stories[group.stories.length - 1];
            if (!latestStory) return null;

            return (
              <button
                type="button"
                key={group.authorId}
                onClick={() => onOpenAuthor(group.authorId)}
                className="group relative flex h-[9.2rem] min-w-[6.4rem] shrink-0 overflow-hidden rounded-[1.15rem] border border-slate-200 bg-slate-900 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 sm:h-[10.4rem] sm:min-w-[7rem]"
              >
                {latestStory.mediaType === 'video' ? (
                  <video
                    className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    src={latestStory.mediaUrl}
                    muted
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <img
                    src={latestStory.mediaUrl}
                    alt={latestStory.caption || group.authorName}
                    className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-slate-950/18 via-transparent to-slate-950/82" />
                <div className="relative z-10 flex h-full w-full flex-col justify-between p-2.5 sm:p-3">
                  <div className="flex items-start justify-between gap-2">
                    <Avatar
                      src={group.authorPhotoURL || undefined}
                      alt={group.authorName}
                      size="md"
                      animated={false}
                      storyActive
                      storyUnseen={group.hasUnseen}
                      className="border-2 border-white/85 shadow-md dark:border-slate-950"
                    />
                    {latestStory.mediaType === 'video' && (
                      <span className="rounded-full bg-black/45 p-1.5 text-white backdrop-blur-sm">
                        <Play className="h-4 w-4 fill-current" />
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <p className="line-clamp-2 text-xs font-black leading-tight text-white drop-shadow-md sm:text-sm">
                      {latestStory.caption || group.authorName}
                    </p>
                    <p className="truncate text-xs font-semibold text-white/88">@{group.authorUsername}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
