import React, { useId } from 'react';
import { motion } from 'motion/react';

interface LogoProps {
  className?: string;
  showText?: boolean;
  animate?: boolean;
}

const logoSpring = { type: 'spring', stiffness: 230, damping: 20 } as const;

function LogoMark({ animate = true }: { animate?: boolean }) {
  const id = useId();
  const fillId = `snaplink-mark-fill-${id}`;
  const glowId = `snaplink-mark-glow-${id}`;

  return (
    <motion.svg
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      initial={animate ? { opacity: 0, scale: 0.88, rotate: -8 } : false}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      transition={logoSpring}
      className="h-full w-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={fillId} x1="12" y1="9" x2="84" y2="88" gradientUnits="userSpaceOnUse">
          <stop stopColor="#07111F" />
          <stop offset="0.48" stopColor="#0B48FF" />
          <stop offset="1" stopColor="#00C8FF" />
        </linearGradient>
        <radialGradient id={glowId} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(28 20) rotate(52) scale(62 44)">
          <stop stopColor="white" stopOpacity="0.92" />
          <stop offset="0.45" stopColor="#7DD3FC" stopOpacity="0.3" />
          <stop offset="1" stopColor="#0B48FF" stopOpacity="0" />
        </radialGradient>
      </defs>

      <motion.rect
        x="7"
        y="7"
        width="82"
        height="82"
        rx="26"
        fill={`url(#${fillId})`}
        initial={animate ? { opacity: 0, scale: 0.92 } : false}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ ...logoSpring, delay: 0.03 }}
      />

      <rect x="7" y="7" width="82" height="82" rx="26" fill={`url(#${glowId})`} opacity="0.78" />

      <motion.path
        d="M62.5 25.5H42.8C33.4 25.5 27 31.5 27 39.2C27 47.2 33.3 52.8 42.6 52.8H53.1C61.7 52.8 68 58.3 68 66C68 73.9 61.4 79.5 52.3 79.5H30.5"
        stroke="white"
        strokeWidth="10.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={animate ? { opacity: 0, pathLength: 0 } : false}
        animate={{ opacity: 1, pathLength: 1 }}
        transition={{ duration: 0.72, ease: 'easeOut', delay: 0.12 }}
      />

      <motion.path
        d="M68.8 18.5L27.2 77.5"
        stroke="#77F7FF"
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.78"
        initial={animate ? { opacity: 0, pathLength: 0 } : false}
        animate={{ opacity: 0.78, pathLength: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut', delay: 0.25 }}
      />

      <path d="M21 17.5C30 12 43 11 55 15" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.38" />
    </motion.svg>
  );
}

export function Logo({ className = '', showText = false, animate = true }: LogoProps) {
  if (!showText) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <LogoMark animate={animate} />
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="h-12 w-12 shrink-0">
        <LogoMark animate={animate} />
      </div>
      <div className="min-w-0">
        <motion.div
          initial={animate ? { opacity: 0, y: 10 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, delay: 0.08, ease: 'easeOut' }}
          className="text-[10px] font-black uppercase tracking-[0.28em] text-blue-500/80"
        >
          Network
        </motion.div>
        <motion.div
          initial={animate ? { opacity: 0, y: 12 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.48, delay: 0.14, ease: 'easeOut' }}
          className="text-3xl font-black tracking-[-0.05em] text-slate-950 dark:text-white"
        >
          SnapLink
        </motion.div>
      </div>
    </div>
  );
}
