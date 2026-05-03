import React from 'react';
import { Play } from 'lucide-react';
import { PostMediaItem } from '../../lib/postMedia';

interface PostMediaGridProps {
  items: PostMediaItem[];
  className?: string;
  onImageClick?: (url: string) => void;
}

export function PostMediaGrid({ items, className = '', onImageClick }: PostMediaGridProps) {
  if (!items.length) return null;

  return (
    <div
      className={`mt-3 overflow-hidden rounded-[24px] border border-gray-200 dark:border-gray-700 grid gap-1 ${
        items.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
      } ${className}`}
    >
      {items.map((item, index) => {
        const isTallLead = items.length === 3 && index === 0;
        const isAvatarSticker = item.type !== 'video' && item.url.includes('api.dicebear.com') && item.url.includes('/svg?seed=');

        return (
          <div key={`${item.url}-${index}`} className={`relative bg-black/5 dark:bg-black/20 ${isTallLead ? 'row-span-2' : ''}`}>
            {item.type === 'video' ? (
              <>
                <video
                  src={item.url}
                  className="h-full max-h-[28rem] min-h-[12rem] w-full object-cover"
                  controls
                  playsInline
                  preload="metadata"
                  controlsList="nodownload noplaybackrate"
                  disablePictureInPicture
                />
                <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-semibold text-white">
                  <Play className="h-3 w-3 fill-current" />
                  Video
                </div>
              </>
            ) : (
              <div className={`relative flex min-h-[12rem] items-center justify-center ${isAvatarSticker ? 'bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.18),rgba(255,255,255,0.92)_60%)] dark:bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.25),rgba(15,23,42,0.92)_65%)]' : ''}`}>
                <img
                  src={item.url}
                  alt={`Post media ${index + 1}`}
                  className={`w-full ${isAvatarSticker ? 'max-h-[18rem] object-contain p-4 md:p-6' : 'h-full max-h-[28rem] min-h-[12rem] object-cover'} ${onImageClick ? 'cursor-pointer transition-opacity hover:opacity-90' : ''}`}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onClick={onImageClick ? () => onImageClick(item.url) : undefined}
                />
                {isAvatarSticker && (
                  <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-blue-600 shadow-sm dark:bg-slate-900/80 dark:text-blue-300">
                    Sticker
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
