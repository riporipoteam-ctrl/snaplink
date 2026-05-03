import React, { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { ReactionDef } from '../../lib/reactions';

/* ─── SVG Icons ──────────────────────────────────────────── */

function LoveIcon({ color = '#f43f5e', size = 20 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.27 2 8.5 2 5.41 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.08C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.41 22 8.5c0 3.77-3.4 6.86-8.55 11.53L12 21.35z" />
    </svg>
  );
}

function FireIcon({ color = '#f97316', size = 20 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
      <path d="M12 23c-4.97 0-9-3.58-9-8 0-3.05 2.13-5.92 4-7.72 0 0 .72 2.92 3 2.72-.62-3.82 2-8 2-8s2.5 3.54 3.5 6c.56 1.38.5 2.5.5 2.5s1.8-1.26 2-3.5C20.42 9.57 21 12.28 21 15c0 4.42-4.03 8-9 8z" />
    </svg>
  );
}

function SnapIcon({ color = '#eab308', size = 20 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
      <path d="M7 2v11h3v9l7-12h-4l4-8z" />
    </svg>
  );
}

function HypeIcon({ color = '#3b82f6', size = 20 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
      <path d="M12 2C10.08 2 8.5 3.58 8.5 5.5c0 .42.08.83.22 1.2L4 12l1.5 1.5L9 10v12h2v-6h2v6h2V10l3.5 3.5L20 12l-4.72-5.3c.14-.37.22-.78.22-1.2C15.5 3.58 13.92 2 12 2z" />
    </svg>
  );
}

function CrownIcon({ color = '#8b5cf6', size = 20 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
      <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm0 2h14v2H5v-2z" />
    </svg>
  );
}

function LaughIcon({ color = '#06b6d4', size = 20 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size}>
      <circle cx="12" cy="12" r="10" fill={color} />
      <circle cx="8.5" cy="9" r="1.2" fill="white" />
      <circle cx="15.5" cy="9" r="1.2" fill="white" />
      <path d="M7 13c0 3.31 2.24 5 5 5s5-1.69 5-5H7z" fill="white" />
    </svg>
  );
}

const ICON_MAP: Record<ReactionDef['svgId'], React.FC<{ color?: string; size?: number }>> = {
  love: LoveIcon,
  fire: FireIcon,
  snap: SnapIcon,
  hype: HypeIcon,
  crown: CrownIcon,
  laugh: LaughIcon,
};

/* ─── Main Component ─────────────────────────────────────── */

export function ReactionGlyph({ reaction, size = 20 }: { reaction: ReactionDef; size?: number }) {
  const IconComponent = ICON_MAP[reaction.svgId];
  return <IconComponent color={reaction.color} size={size} />;
}

interface ReactionIconProps {
  reaction: ReactionDef;
  size?: number;
  isSelected?: boolean;
  showLabel?: boolean;
  onClick?: () => void;
  /** If true, show the burst animation on next render */
  burst?: boolean;
}

export function ReactionIcon({ reaction, size = 24, isSelected, showLabel, onClick, burst }: ReactionIconProps) {
  const IconComponent = ICON_MAP[reaction.svgId];

  return (
    <button
      type="button"
      onClick={onClick}
      title={reaction.label}
      className="group relative flex flex-col items-center gap-1 rounded-xl p-1.5 transition-all duration-200 hover:scale-125 hover:bg-black/5 dark:hover:bg-white/8 active:scale-95"
    >
      <div className={`relative ${burst ? 'sl-reaction-burst' : ''}`}>
        <IconComponent color={reaction.color} size={size} />

        {/* Particle burst effect */}
        {burst && <ParticleBurst reaction={reaction} />}
      </div>

      {showLabel && (
        <span
          className="text-[10px] font-bold uppercase tracking-wider"
          style={{ color: isSelected ? reaction.color : 'var(--sl-text-muted)' }}
        >
          {reaction.label}
        </span>
      )}

      {isSelected && (
        <motion.div
          layoutId="reaction-selected-dot"
          className="absolute -bottom-0.5 h-1 w-1 rounded-full"
          style={{ backgroundColor: reaction.color }}
        />
      )}
    </button>
  );
}

/* ─── Particle Burst ─────────────────────────────────────── */

function ParticleBurst({ reaction }: { reaction: ReactionDef }) {
  const particles = reaction.particleColors.flatMap((color, i) => [
    { color, rx: `${15 + i * 10}px`, ry: `${-20 - i * 8}px`, delay: i * 0.05 },
    { color, rx: `${-15 - i * 10}px`, ry: `${-15 - i * 10}px`, delay: i * 0.05 + 0.03 },
  ]);

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {particles.map((particle, index) => (
        <div
          key={index}
          className="sl-reaction-particle absolute h-1.5 w-1.5 rounded-full"
          style={{
            backgroundColor: particle.color,
            '--rx': particle.rx,
            '--ry': particle.ry,
            animationDelay: `${particle.delay}s`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

/* ─── Reaction Picker Tray ───────────────────────────────── */

interface ReactionPickerProps {
  reactions: readonly ReactionDef[];
  selectedEmoji?: string | null;
  onPick: (reaction: ReactionDef) => void;
  isOpen: boolean;
}

export function ReactionPicker({ reactions, selectedEmoji, onPick, isOpen }: ReactionPickerProps) {
  const [burstingId, setBurstingId] = useState<string | null>(null);

  const handlePick = useCallback(
    (reaction: ReactionDef) => {
      setBurstingId(reaction.svgId);
      setTimeout(() => setBurstingId(null), 600);
      onPick(reaction);
    },
    [onPick],
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.7, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.7, y: 8 }}
          transition={{ type: 'spring', stiffness: 400, damping: 22 }}
          className="absolute bottom-full left-0 z-30 mb-2 flex items-center gap-0.5 rounded-2xl border border-gray-200/80 bg-white/95 p-1.5 shadow-xl backdrop-blur-xl dark:border-gray-700 dark:bg-gray-900/95"
        >
          {reactions.map((reaction) => (
            <React.Fragment key={reaction.svgId}>
              <ReactionIcon
                reaction={reaction}
                size={22}
                isSelected={selectedEmoji === reaction.emoji}
                burst={burstingId === reaction.svgId}
                onClick={() => handlePick(reaction)}
              />
            </React.Fragment>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── Inline Reaction Chip ───────────────────────────────── */

interface ReactionChipProps {
  reaction: ReactionDef;
  count: number;
  isActive?: boolean;
}

export function ReactionChip({ reaction, count, isActive }: ReactionChipProps) {
  const IconComponent = ICON_MAP[reaction.svgId];

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-all ${
        isActive
          ? 'ring-2 ring-offset-1 dark:ring-offset-gray-900'
          : ''
      } ${reaction.chipClass}`}
      style={isActive ? { ringColor: reaction.color } : undefined}
    >
      <IconComponent color={reaction.color} size={14} />
      <span>{count}</span>
    </div>
  );
}
