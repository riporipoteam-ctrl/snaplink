import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Lock, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { Logo } from '../components/ui/Logo';
import { FeatureGateKey, getFeatureGate, getFeatureUnlockLabel } from '../lib/featureGates';

export function FeatureLaunchTeaser({ feature }: { feature: FeatureGateKey }) {
  const gate = getFeatureGate(feature);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_42%),linear-gradient(180deg,#eff6ff_0%,#ffffff_32%)] px-4 pb-20 pt-10 dark:bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.14),transparent_40%),linear-gradient(180deg,#020617_0%,#0f172a_36%)] md:pb-8">
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[32px] border border-white/70 bg-white/88 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur dark:border-white/10 dark:bg-slate-950/72"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
            <Logo className="h-10 w-10" animate={false} />
          </div>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-blue-600 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-200">
            <Lock className="h-3.5 w-3.5" />
            Saturday Unlock
          </div>
          <h1 className="mt-5 text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">
            {gate.label} opens soon
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">
            {gate.teaser}
          </p>

          <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50/90 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/85">
            <div className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <CalendarDays className="h-4 w-4 text-blue-500" />
              Unlocks on {getFeatureUnlockLabel(feature)} Europe/Sarajevo
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/"
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            >
              Back to Home
            </Link>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 dark:border-slate-800 dark:text-slate-300">
              <Sparkles className="h-4 w-4 text-amber-400" />
              The menu will unlock automatically.
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
