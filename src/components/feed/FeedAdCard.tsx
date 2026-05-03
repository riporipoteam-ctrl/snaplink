import React from 'react';
import { Link2, Megaphone, PlayCircle } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import type { SponsoredAd } from '../../lib/business';

export function FeedAdCard({ ad }: { ad: SponsoredAd }) {
  return (
    <article className="snaplink-post-shell relative overflow-hidden border-b border-slate-200 bg-white/98 dark:border-slate-800 dark:bg-slate-950/96 md:border-x md:border-b md:rounded-[22px]">
      <div className="border-b border-slate-200/70 bg-[linear-gradient(90deg,rgba(29,155,240,0.08),rgba(15,23,42,0.03))] px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 dark:border-slate-800/70 dark:bg-[linear-gradient(90deg,rgba(29,155,240,0.18),rgba(15,23,42,0.06))] dark:text-slate-400">
        Sponsored
      </div>
      <div className="px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <Avatar src={ad.businessPhotoURL || undefined} alt={ad.businessName} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-[15px] font-black text-slate-950 dark:text-white">{ad.businessName}</span>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                Promoted
              </span>
              {ad.businessUsername ? (
                <span className="text-sm text-slate-500 dark:text-slate-400">@{ad.businessUsername}</span>
              ) : null}
            </div>
            <h3 className="mt-3 text-[1rem] font-black tracking-tight text-slate-950 dark:text-white sm:text-[1.15rem]">
              {ad.title}
            </h3>
            <p className="mt-2 text-[15px] leading-7 text-slate-700 dark:text-slate-200">{ad.description}</p>

            {ad.mediaUrl ? (
              <div className="mt-4 overflow-hidden rounded-[20px] border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
                {ad.mediaType === 'video' ? (
                  <video className="h-72 w-full object-cover" controls preload="metadata">
                    <source src={ad.mediaUrl} />
                  </video>
                ) : (
                  <img src={ad.mediaUrl} alt={ad.title} className="h-72 w-full object-cover" />
                )}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <a
                href={ad.linkUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                <Link2 className="h-4 w-4" />
                Open link
              </a>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                {ad.mediaType === 'video' ? <PlayCircle className="h-3.5 w-3.5" /> : <Megaphone className="h-3.5 w-3.5" />}
                Business promotion
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
