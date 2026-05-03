import React from 'react';
import { Sparkles } from 'lucide-react';

interface LevelBadgeProps {
  level: number;
  compact?: boolean;
  className?: string;
}

export function LevelBadge({ level, compact = false, className = '' }: LevelBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-blue-200/80 bg-blue-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-blue-700 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-200 ${className}`}
    >
      <Sparkles className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      <span>{compact ? `Lv ${level}` : `Level ${level}`}</span>
    </span>
  );
}
