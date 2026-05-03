import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSnapLinkEvents } from '../contexts/EventContext';
import { WORLD_CUP_2026_FIXTURE_DAYS, WORLD_CUP_2026_GROUPS, WORLD_CUP_2026_HOST_CITIES, WORLD_CUP_2026_START, WORLD_CUP_2026_END } from '../lib/worldCup2026';
import { CalendarDays, Globe2, ShieldAlert, Sparkles, Trophy, Zap } from 'lucide-react';

function formatSarajevoDate(date: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Sarajevo',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date));
}

export function Events() {
  const { userProfile } = useAuth();
  const { activeEvent } = useSnapLinkEvents();
  const isAdmin = userProfile?.role === 'admin';
  const canPreviewWorldCup = isAdmin || activeEvent?.type === 'world_cup_2026';
  const canSeeDoomsday = isAdmin || activeEvent?.type === 'doomsday';

  if (!canPreviewWorldCup && !canSeeDoomsday) {
    return (
      <div className="min-h-screen bg-white px-4 py-10 dark:bg-slate-950">
        <div className="mx-auto max-w-4xl rounded-[32px] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-8 text-white shadow-2xl">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-300/80">Events</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight">Nothing is live right now</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/75">
            SnapLink events stay hidden until they go live. When an event starts, this page becomes the control room for boosts, challenges, and the event-specific theme.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="snaplink-worldcup-page min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef5ff_40%,#f8fafc_100%)] pb-20 dark:bg-[linear-gradient(180deg,#020617_0%,#08111f_40%,#020617_100%)] md:pb-0">
      <div className="snaplink-events-topbar border-b border-slate-200/80 bg-white/88 px-4 py-5 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/82">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-500">Events category</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950 dark:text-white">SnapLink live events</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
              Matchday takeovers, short-burst app skins, boosted rewards, and admin-only previews all live here now.
            </p>
          </div>
          {activeEvent && (
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              <Sparkles className="h-4 w-4 text-blue-500" />
              {activeEvent.title} is active
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
        {canPreviewWorldCup && (
          <section className="snaplink-worldcup-hero relative overflow-hidden rounded-[34px] border border-emerald-200 p-6 text-white shadow-xl dark:border-emerald-400/20">
            <div className="snaplink-worldcup-hero-art" />
            <div className="snaplink-worldcup-ribbon snaplink-worldcup-ribbon-a" />
            <div className="snaplink-worldcup-ribbon snaplink-worldcup-ribbon-b" />
            <div className="snaplink-worldcup-mark" aria-hidden="true">26</div>
            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-white/85 backdrop-blur-sm">
                  <Trophy className="h-3.5 w-3.5" />
                  World Cup 2026 x SnapLink
                </div>
                <h2 className="mt-4 max-w-2xl text-4xl font-black tracking-tight md:text-6xl">World Cup 2026 takes over all of SnapLink.</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-white/80">
                  Matchday boards, supporter drops, score panels, themed surfaces, and boosted rewards take over the app from {formatSarajevoDate(WORLD_CUP_2026_START)} until {formatSarajevoDate(WORLD_CUP_2026_END)}.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: 'Groups', value: '12' },
                  { label: 'Host cities', value: String(WORLD_CUP_2026_HOST_CITIES.length) },
                  { label: 'Event boost', value: '2x XP / Coins' },
                ].map((stat) => (
                  <div key={stat.label} className="snaplink-worldcup-stat rounded-[24px] border border-white/10 bg-white/10 px-4 py-4 backdrop-blur-sm">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/65">{stat.label}</div>
                    <div className="mt-2 text-2xl font-black">{stat.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {canPreviewWorldCup && (
          <div className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
            <section className="snaplink-worldcup-panel rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-emerald-500/12 p-3 text-emerald-600 dark:text-emerald-300">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Opening schedule</p>
                  <h3 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">Featured matchdays</h3>
                </div>
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {WORLD_CUP_2026_FIXTURE_DAYS.map((day) => (
                  <div key={day.date} className="snaplink-worldcup-matchday rounded-[26px] border border-emerald-100 bg-[linear-gradient(180deg,#ffffff,#f5fffa)] p-4 dark:border-emerald-400/10 dark:bg-[linear-gradient(180deg,#052e27,#08111f)]">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-300">{day.label}</div>
                        <div className="mt-1 text-lg font-black text-slate-950 dark:text-white">
                          {new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Sarajevo', dateStyle: 'medium' }).format(new Date(day.date))}
                        </div>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-300">
                        {day.matches.length} matches
                      </span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {day.matches.map((match) => (
                        <div key={`${day.date}-${match.fixture}`} className="rounded-2xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-950">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-xs font-black uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-300">Group {match.group}</div>
                              <div className="mt-1 text-sm font-bold text-slate-950 dark:text-white">{match.fixture}</div>
                            </div>
                            <div className="text-right text-xs text-slate-500 dark:text-slate-400">{match.venue}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-6">
              <div className="snaplink-worldcup-panel rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-blue-500/12 p-3 text-blue-600 dark:text-blue-300">
                    <Globe2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Host map</p>
                    <h3 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">Cities on the route</h3>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {WORLD_CUP_2026_HOST_CITIES.map((city) => (
                    <span key={city} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                      {city}
                    </span>
                  ))}
                </div>
              </div>

              <div className="snaplink-worldcup-panel rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-amber-500/12 p-3 text-amber-600 dark:text-amber-300">
                    <Zap className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Event rewards</p>
                    <h3 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">What unlocks</h3>
                  </div>
                </div>
                <div className="mt-5 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                    2x XP, 2x SnapCoins, boosted challenge steps, and supporter drops across the shop.
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                    Country matchday hats, event wallpapers, and World Cup profile themes appear only during the event window or your private admin preview.
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {canPreviewWorldCup && (
          <section className="snaplink-worldcup-panel rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-500/12 p-3 text-emerald-600 dark:text-emerald-300">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Groups board</p>
                <h3 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">The tournament field</h3>
              </div>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {WORLD_CUP_2026_GROUPS.map((group) => (
                <div key={group.id} className="snaplink-worldcup-group rounded-[24px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-300">{group.id}</div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{group.featuredVenue}</div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {group.teams.map((team) => (
                      <span key={team.slug} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                        {team.code} - {team.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {canSeeDoomsday && (
          <section className="rounded-[28px] border border-red-200 bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.18),rgba(255,255,255,0.98)_42%),linear-gradient(135deg,#7f1d1d,#0f172a)] p-5 text-white shadow-xl dark:border-red-400/20 dark:bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.15),rgba(2,6,23,0.96)_42%),linear-gradient(135deg,#450a0a,#020617)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-white/85">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Doomsday event
                </div>
                <h3 className="mt-4 text-3xl font-black tracking-tight">Short-burst chaos mode</h3>
                <p className="mt-3 text-sm leading-7 text-white/75">
                  Doomsday now lasts 20 minutes, starts on 19 April 2026 for the launch burst, and the next scheduled drop is on 10 June 2026 before it moves into the 3-month cycle.
                </p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/10 px-5 py-4 backdrop-blur-sm">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/65">Active boosts</div>
                <div className="mt-3 space-y-2 text-sm font-semibold text-white/85">
                  <div>2x challenge progress</div>
                  <div>2x XP rewards</div>
                  <div>2x SnapCoins</div>
                </div>
              </div>
            </div>
            <div className="mt-5 rounded-[24px] border border-white/10 bg-black/15 p-4 text-sm leading-7 text-white/75">
              Meteor drops, reward windows, and emergency event styling all flow through the same event engine now, and admins can still preview this privately before pushing it global.
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
