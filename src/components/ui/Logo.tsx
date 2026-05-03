import React from 'react';
import { motion } from 'motion/react';

interface LogoProps {
  className?: string;
  showText?: boolean;
  animate?: boolean;
}

const logoSpring = { type: 'spring', stiffness: 230, damping: 20 } as const;

function LogoMark({ animate = true }: { animate?: boolean }) {
  return (
    <motion.svg
      viewBox="0 0 84 84"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      initial={animate ? { opacity: 0, scale: 0.88, rotate: -8 } : false}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      transition={logoSpring}
      className="h-full w-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="snaplink-mark-fill" x1="8" y1="8" x2="76" y2="76" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22D3EE" />
          <stop offset="0.58" stopColor="#3B82F6" />
          <stop offset="1" stopColor="#1D4ED8" />
        </linearGradient>
      </defs>

      <motion.rect
        x="6"
        y="6"
        width="72"
        height="72"
        rx="23"
        fill="url(#snaplink-mark-fill)"
        initial={animate ? { opacity: 0, scale: 0.92 } : false}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ ...logoSpring, delay: 0.03 }}
      />

      <motion.rect
        x="19.5"
        y="26"
        width="29"
        height="18"
        rx="9"
        transform="rotate(-38 34 35)"
        stroke="white"
        strokeWidth="7"
        initial={animate ? { opacity: 0, pathLength: 0 } : false}
        animate={{ opacity: 1, pathLength: 1 }}
        transition={{ duration: 0.55, ease: 'easeOut', delay: 0.12 }}
      />

      <motion.rect
        x="35.5"
        y="40"
        width="29"
        height="18"
        rx="9"
        transform="rotate(-38 50 49)"
        stroke="white"
        strokeWidth="7"
        initial={animate ? { opacity: 0, pathLength: 0 } : false}
        animate={{ opacity: 1, pathLength: 1 }}
        transition={{ duration: 0.55, ease: 'easeOut', delay: 0.22 }}
      />
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
          className="text-[10px] font-black uppercase tracking-[0.28em] text-sky-500/80"
        >
          Social network
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
