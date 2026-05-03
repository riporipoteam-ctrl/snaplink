import React from 'react';
import { AlertTriangle, Sparkles, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { SnapLinkEventRecord } from '../../lib/events';
import { Link } from 'react-router-dom';

export function EventBanner({ event }: { event: SnapLinkEventRecord | null }) {
  const themeClass =
    event?.themeKey === 'doomsday'
      ? 'border-red-500/30 bg-[linear-gradient(90deg,rgba(127,29,29,0.96),rgba(30,41,59,0.96),rgba(120,53,15,0.96))] text-white'
      : event?.themeKey === 'world-cup'
      ? 'border-emerald-500/30 bg-[linear-gradient(90deg,rgba(6,95,70,0.96),rgba(4,120,87,0.92),rgba(15,23,42,0.96))] text-white'
      : 'border-blue-500/20 bg-[linear-gradient(90deg,rgba(29,78,216,0.96),rgba(59,130,246,0.9),rgba(6,182,212,0.92))] text-white';

  const icon =
    event?.themeKey === 'doomsday'
      ? <AlertTriangle className="h-5 w-5" />
      : event?.themeKey === 'world-cup'
      ? <Trophy className="h-5 w-5" />
      : <Sparkles className="h-5 w-5" />;

  return (
    <AnimatePresence initial={false}>
      {event && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          className={`border-b px-4 py-3 shadow-sm backdrop-blur-xl ${themeClass}`}
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/12">
                {icon}
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-white/70">Live Event</p>
                <p className="text-sm font-bold sm:text-base">{event.title}</p>
                <p className="text-xs text-white/75 sm:text-sm">{event.announcement}</p>
              </div>
            </div>
            <div className="hidden items-center gap-3 md:flex">
              <div className="rounded-full bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-white/80">
                {event.challengeMultiplier}x challenges · {event.xpMultiplier}x xp · {event.coinMultiplier}x coins
              </div>
              <Link
                to="/events"
                className="rounded-full border border-white/20 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-white/10"
              >
                Open Events
              </Link>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
