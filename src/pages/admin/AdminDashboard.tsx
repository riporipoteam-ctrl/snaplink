import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Shield, Users, FileText, AlertTriangle, Ban, CircleGauge, Sparkles, Database, Loader2, TimerReset, Zap, Siren } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { motion } from 'motion/react';
import { CleanupSummary, runAdminCleanup } from '../../lib/dataCleanup';
import { DOOMSDAY_DURATION_MS, WORLD_CUP_EVENT_DURATION_MS, getNextDoomsdayStart, launchDoomsdayEvent, launchWorldCupEvent } from '../../lib/events';
import { WORLD_CUP_2026_START } from '../../lib/worldCup2026';
import { logAdminAction } from '../../lib/adminLogs';
import { canViewAdminDashboard } from '../../lib/adminPermissions';

export function AdminDashboard() {
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'admin';
  const isMember = userProfile?.role === 'member';
  const canViewDashboard = canViewAdminDashboard(userProfile?.role);
  const [stats, setStats] = useState({ users: 0, posts: 0, reports: 0 });
  const [loading, setLoading] = useState(isAdmin);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [feedRetentionDays, setFeedRetentionDays] = useState('90');
  const [notificationRetentionDays, setNotificationRetentionDays] = useState('30');
  const [cleanupLimit, setCleanupLimit] = useState('10');
  const [cleanupSummary, setCleanupSummary] = useState<CleanupSummary | null>(null);
  const [eventLoading, setEventLoading] = useState<'preview' | 'global' | 'worldcup-preview' | 'worldcup-global' | null>(null);
  const nextDoomsday = useMemo(() => getNextDoomsdayStart(), []);

  const fetchStats = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [usersSnap, postsSnap, reportsSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'posts')),
        getDocs(collection(db, 'reports')),
      ]);

      setStats({
        users: usersSnap.size,
        posts: postsSnap.size,
        reports: reportsSnap.size,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  const handleRunCleanup = async () => {
    const parsedFeedDays = Math.max(7, parseInt(feedRetentionDays, 10) || 90);
    const parsedNotificationDays = Math.max(7, parseInt(notificationRetentionDays, 10) || 30);
    const parsedCleanupLimit = Math.max(1, Math.min(50, parseInt(cleanupLimit, 10) || 10));

    setCleanupLoading(true);
    try {
      const summary = await runAdminCleanup({
        postRetentionDays: parsedFeedDays,
        notificationRetentionDays: parsedNotificationDays,
        maxPostsPerRun: parsedCleanupLimit,
        maxNotificationsPerRun: parsedCleanupLimit * 20,
        maxSessionsPerRun: parsedCleanupLimit * 10,
        maxLoginTokensPerRun: parsedCleanupLimit * 10,
      });
      setCleanupSummary(summary);
      await fetchStats();
    } catch (error) {
      console.error('Error running cleanup:', error);
      alert('Cleanup failed. Check the console for details.');
    } finally {
      setCleanupLoading(false);
    }
  };

  const handlePreviewEvent = async () => {
    if (!userProfile?.uid || eventLoading) return;
    setEventLoading('preview');
    try {
      await launchDoomsdayEvent({
        createdBy: userProfile.uid,
        scope: 'admin_preview',
        previewForUserId: userProfile.uid,
      });
      await logAdminAction({
        actorId: userProfile.uid,
        actorDisplayName: userProfile.displayName,
        actorRole: userProfile.role,
        action: 'Launched Doomsday preview',
        targetType: 'event',
        targetId: 'doomsday_preview',
        targetLabel: 'Doomsday Event',
        details: 'Admin preview visible only to the triggering admin.',
      });
    } finally {
      setEventLoading(null);
    }
  };

  const handleGlobalEvent = async () => {
    if (!userProfile?.uid || eventLoading) return;
    if (!window.confirm('Launch the global Doomsday event for everyone right now?')) return;
    setEventLoading('global');
    try {
      await launchDoomsdayEvent({
        createdBy: userProfile.uid,
        scope: 'global',
      });
      await logAdminAction({
        actorId: userProfile.uid,
        actorDisplayName: userProfile.displayName,
        actorRole: userProfile.role,
        action: 'Launched Doomsday globally',
        targetType: 'event',
        targetId: 'doomsday_global',
        targetLabel: 'Doomsday Event',
      });
    } finally {
      setEventLoading(null);
    }
  };

  const handleWorldCupPreview = async () => {
    if (!userProfile?.uid || eventLoading) return;
    setEventLoading('worldcup-preview');
    try {
      await launchWorldCupEvent({
        createdBy: userProfile.uid,
        scope: 'admin_preview',
        previewForUserId: userProfile.uid,
      });
      await logAdminAction({
        actorId: userProfile.uid,
        actorDisplayName: userProfile.displayName,
        actorRole: userProfile.role,
        action: 'Launched World Cup preview',
        targetType: 'event',
        targetId: 'worldcup_preview',
        targetLabel: 'World Cup 2026',
        details: 'Admin preview visible only to the triggering admin.',
      });
    } finally {
      setEventLoading(null);
    }
  };

  const handleWorldCupGlobal = async () => {
    if (!userProfile?.uid || eventLoading) return;
    if (!window.confirm('Launch the World Cup 2026 event globally right now?')) return;
    setEventLoading('worldcup-global');
    try {
      await launchWorldCupEvent({
        createdBy: userProfile.uid,
        scope: 'global',
      });
      await logAdminAction({
        actorId: userProfile.uid,
        actorDisplayName: userProfile.displayName,
        actorRole: userProfile.role,
        action: 'Launched World Cup globally',
        targetType: 'event',
        targetId: 'worldcup_global',
        targetLabel: 'World Cup 2026',
      });
    } finally {
      setEventLoading(null);
    }
  };

  if (!canViewDashboard) {
    return <div className="p-8 text-center text-red-500">Access Denied.</div>;
  }

  return (
    <div className="min-h-screen bg-white pb-20 md:pb-0">
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-md">
        <div className="p-4 flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center">
            <Shield className="mr-2 text-blue-500" /> Dashboard
          </h1>
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-gray-200 bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-900 p-6 text-white shadow-xl"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm uppercase tracking-[0.28em] text-white/60">{isAdmin ? 'Control Center' : 'Member View'}</div>
              <h2 className="mt-3 text-3xl font-black">{isAdmin ? 'Team overview at a glance' : `Your status, ${userProfile?.displayName}`}</h2>
              <p className="mt-3 max-w-2xl text-sm text-white/75">
                {isAdmin
                  ? 'Live counts for the team workspace, moderation queue, and network activity.'
                  : 'This dashboard is private to your account and only shows your own moderation and activity status.'}
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 text-right backdrop-blur-sm">
              <div className="text-xs uppercase tracking-[0.24em] text-white/60">Role</div>
              <div className="mt-1 text-lg font-bold">{isAdmin ? 'Administrator' : 'Member'}</div>
            </div>
          </div>
        </motion.div>

        {isAdmin ? (
          loading ? (
            <div className="text-gray-500">Loading statistics...</div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  {
                    icon: Users,
                    label: 'Total Users',
                    value: stats.users,
                    card: 'bg-blue-50 border-blue-100',
                    iconWrap: 'bg-blue-500',
                    valueClass: 'text-blue-900',
                    labelClass: 'text-blue-600',
                  },
                  {
                    icon: FileText,
                    label: 'Total Posts',
                    value: stats.posts,
                    card: 'bg-green-50 border-green-100',
                    iconWrap: 'bg-green-500',
                    valueClass: 'text-green-900',
                    labelClass: 'text-green-600',
                  },
                  {
                    icon: AlertTriangle,
                    label: 'Active Reports',
                    value: stats.reports,
                    card: 'bg-red-50 border-red-100',
                    iconWrap: 'bg-red-500',
                    valueClass: 'text-red-900',
                    labelClass: 'text-red-600',
                  },
                ].map((card, index) => (
                  <motion.div
                    key={card.label}
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.08 * (index + 1) }}
                    className={`${card.card} rounded-2xl border p-6 flex items-center hover:shadow-md transition-shadow`}
                  >
                    <div className={`${card.iconWrap} text-white p-4 rounded-xl mr-4`}>
                      <card.icon className="h-8 w-8" />
                    </div>
                    <div>
                      <div className={`text-sm font-bold uppercase tracking-wider ${card.labelClass}`}>{card.label}</div>
                      <div className={`text-3xl font-black ${card.valueClass}`}>{card.value}</div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-2xl">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-slate-900 p-3 text-white">
                        <Database className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-black uppercase tracking-[0.24em] text-slate-500">Data Cleanup</div>
                        <h3 className="text-2xl font-black tracking-tight text-slate-900">Keep Firestore from ballooning</h3>
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-relaxed text-slate-600">
                      This removes old feed posts with their related comments, likes, reposts, and post notifications, plus stale notifications, login links, and session records. New post and comment images now upload to Firebase Storage instead of stuffing Firestore with base64 blobs.
                    </p>
                  </div>

                  <div className="grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
                    <label className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Feed Days</div>
                      <input
                        type="number"
                        min={7}
                        max={365}
                        value={feedRetentionDays}
                        onChange={(event) => setFeedRetentionDays(event.target.value)}
                        className="mt-2 w-full bg-transparent text-2xl font-black text-slate-900 outline-none"
                      />
                    </label>
                    <label className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Notif Days</div>
                      <input
                        type="number"
                        min={7}
                        max={180}
                        value={notificationRetentionDays}
                        onChange={(event) => setNotificationRetentionDays(event.target.value)}
                        className="mt-2 w-full bg-transparent text-2xl font-black text-slate-900 outline-none"
                      />
                    </label>
                    <label className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Posts Per Run</div>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={cleanupLimit}
                        onChange={(event) => setCleanupLimit(event.target.value)}
                        className="mt-2 w-full bg-transparent text-2xl font-black text-slate-900 outline-none"
                      />
                    </label>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-4 border-t border-slate-200 pt-5 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <TimerReset className="h-4 w-4 text-blue-500" />
                    Run this a few times if you already have a large backlog of old posts.
                  </div>
                  <button
                    type="button"
                    onClick={handleRunCleanup}
                    disabled={cleanupLoading}
                    className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {cleanupLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Cleaning...
                      </>
                    ) : (
                      'Run Cleanup'
                    )}
                  </button>
                </div>

                {cleanupSummary && (
                  <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-200 pt-5 md:grid-cols-4">
                    {[
                      { label: 'Posts removed', value: cleanupSummary.posts },
                      { label: 'Comments removed', value: cleanupSummary.comments },
                      { label: 'Notifications removed', value: cleanupSummary.notifications },
                      { label: 'Storage files removed', value: cleanupSummary.storageObjects },
                    ].map((item) => (
                      <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">{item.label}</div>
                        <div className="mt-2 text-3xl font-black text-slate-900">{item.value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.38 }}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-2xl">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-slate-900 p-3 text-white">
                        <Siren className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-black uppercase tracking-[0.24em] text-slate-500">Event Engine</div>
                        <h3 className="text-2xl font-black tracking-tight text-slate-900">Event controls</h3>
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-relaxed text-slate-600">
                      Launch private previews for yourself or push live events globally. Doomsday now runs for {Math.floor(DOOMSDAY_DURATION_MS / 60000)} minutes, and World Cup 2026 mode stays up for the full tournament window.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4">
                      <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Next scheduled doomsday</div>
                      <div className="mt-2 text-xl font-black text-slate-900">
                        {new Intl.DateTimeFormat('en-GB', {
                          timeZone: 'Europe/Sarajevo',
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }).format(nextDoomsday)}
                      </div>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4">
                      <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">World Cup window</div>
                      <div className="mt-2 text-xl font-black text-slate-900">
                        {new Intl.DateTimeFormat('en-GB', {
                          timeZone: 'Europe/Sarajevo',
                          dateStyle: 'medium',
                        }).format(new Date(WORLD_CUP_2026_START))}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">{Math.round(WORLD_CUP_EVENT_DURATION_MS / (1000 * 60 * 60 * 24))} days of event mode</div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 border-t border-slate-200 pt-5 lg:grid-cols-2">
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Doomsday</div>
                    <p className="mt-2 text-sm text-slate-600">The short-burst survival skin with 2x rewards and emergency-mode visuals.</p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={handlePreviewEvent}
                        disabled={Boolean(eventLoading)}
                        className="inline-flex items-center justify-center rounded-full border border-slate-300 px-5 py-3 font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        <Zap className="mr-2 h-4 w-4" />
                        {eventLoading === 'preview' ? 'Launching Preview...' : 'Preview For Me'}
                      </button>
                      <button
                        type="button"
                        onClick={handleGlobalEvent}
                        disabled={Boolean(eventLoading)}
                        className="inline-flex items-center justify-center rounded-full bg-red-500 px-5 py-3 font-bold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        <Siren className="mr-2 h-4 w-4" />
                        {eventLoading === 'global' ? 'Launching Global...' : 'Launch Global'}
                      </button>
                    </div>
                  </div>
                  <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-4">
                    <div className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-700">World Cup 2026</div>
                    <p className="mt-2 text-sm text-emerald-900/80">Preview the full tournament takeover privately or push the event board and matchday shop live.</p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={handleWorldCupPreview}
                        disabled={Boolean(eventLoading)}
                        className="inline-flex items-center justify-center rounded-full border border-emerald-300 px-5 py-3 font-bold text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        <Zap className="mr-2 h-4 w-4" />
                        {eventLoading === 'worldcup-preview' ? 'Launching Preview...' : 'Preview For Me'}
                      </button>
                      <button
                        type="button"
                        onClick={handleWorldCupGlobal}
                        disabled={Boolean(eventLoading)}
                        className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-3 font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        <Siren className="mr-2 h-4 w-4" />
                        {eventLoading === 'worldcup-global' ? 'Launching Global...' : 'Launch Global'}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: AlertTriangle,
                label: 'Warnings',
                value: userProfile?.warnings || 0,
                accent: 'text-orange-600',
                card: 'bg-orange-50 border-orange-100',
                chip: (userProfile?.warnings || 0) > 0 ? 'Needs attention' : 'Clear',
              },
              {
                icon: Ban,
                label: 'Ban Status',
                value: userProfile?.isBanned ? 'Restricted' : 'Clear',
                accent: userProfile?.isBanned ? 'text-red-600' : 'text-green-600',
                card: userProfile?.isBanned ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100',
                chip: userProfile?.isBanned ? 'Active' : 'No active ban',
              },
              {
                icon: CircleGauge,
                label: 'Activity',
                value: (userProfile?.actualPresenceStatus || userProfile?.activityStatus || 'online').toUpperCase(),
                accent: 'text-blue-600',
                card: 'bg-blue-50 border-blue-100',
                chip: 'Actual presence',
              },
            ].map((card, index) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 * (index + 1) }}
                className={`${card.card} rounded-2xl border p-6 shadow-sm`}
              >
                <div className="flex items-center justify-between">
                  <div className={`p-3 rounded-2xl bg-white shadow-sm ${card.accent}`}>
                    <card.icon className="h-6 w-6" />
                  </div>
                  <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-gray-600">{card.chip}</span>
                </div>
                <div className="mt-5 text-sm font-semibold uppercase tracking-wider text-gray-500">{card.label}</div>
                <div className={`mt-2 text-3xl font-black ${card.accent}`}>{card.value}</div>
              </motion.div>
            ))}
          </div>
        )}

        {!isAdmin && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="rounded-2xl border border-gray-200 bg-gray-50 p-5"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white p-3 text-indigo-500 shadow-sm">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="font-bold text-gray-900">Only your own status is shown here.</div>
                <div className="text-sm text-gray-500">For detailed history, use the `Warnings` and `Bans` pages from the sidebar.</div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
