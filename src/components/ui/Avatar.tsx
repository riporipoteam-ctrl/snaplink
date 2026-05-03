import React from 'react';
import { cn } from '../../lib/utils';
import { User } from 'lucide-react';
import { motion } from 'motion/react';
import { getAvatarAccessoryMeta } from '../../lib/profileAppearance';

interface AvatarProps {
  src?: string | null;
  alt?: string;
  className?: string;
  fallback?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  animated?: boolean;
  storyActive?: boolean;
  storyUnseen?: boolean;
}

function extractDecorationId(className?: string) {
  if (!className) return null;
  const match = className.match(/sl-decoration-([^\s]+)/);
  return match ? match[1] : null;
}

export function Avatar({
  src,
  alt,
  className,
  fallback,
  size = 'md',
  animated = true,
  storyActive = false,
  storyUnseen = false,
}: AvatarProps) {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
    xl: 'h-32 w-32',
  };

  const Wrapper = animated ? motion.div : 'div';
  const animationProps = animated
    ? {
        whileHover: { scale: 1.1, rotate: [0, -5, 5, 0] },
        whileTap: { scale: 0.9 },
        transition: { type: 'spring', stiffness: 400, damping: 15 },
      }
    : {};

  const accessory = getAvatarAccessoryMeta(extractDecorationId(className));

  return (
    <Wrapper
      {...animationProps}
      className={cn(`relative flex shrink-0 overflow-visible rounded-full bg-gray-200 cursor-pointer ${sizeClasses[size]}`, className)}
    >
      {storyActive && (
        <span
          className={cn(
            'pointer-events-none absolute inset-0 rounded-full',
            storyUnseen
              ? 'shadow-[0_0_0_3px_#ffffff,0_0_0_7px_#2563eb]'
              : 'shadow-[0_0_0_3px_#ffffff,0_0_0_7px_rgba(148,163,184,0.55)]'
          )}
        />
      )}

      <div className="relative z-[1] flex h-full w-full items-center justify-center overflow-hidden rounded-full">
        {src ? (
          <img src={src} alt={alt || 'Avatar'} className="aspect-square h-full w-full rounded-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-full bg-gray-200 text-gray-500">
            {fallback ? <span className="text-sm font-medium">{fallback}</span> : <User className="h-5 w-5" />}
          </div>
        )}
      </div>

      {accessory && (
        <div
          className="pointer-events-none absolute -top-2 left-1/2 z-[2] -translate-x-1/2 rounded-full border border-white/70 px-2 py-0.5 shadow-lg"
          style={{ background: accessory.background }}
        >
          <span className="block whitespace-nowrap text-[9px] font-black uppercase tracking-[0.16em] text-white">
            {accessory.code}
          </span>
        </div>
      )}
    </Wrapper>
  );
}
