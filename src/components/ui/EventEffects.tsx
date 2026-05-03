import React from 'react';
import { Sparkles, Trophy, Zap } from 'lucide-react';
import type { SnapLinkEventRecord } from '../../lib/events';
import { WORLD_CUP_2026_FIXTURE_DAYS } from '../../lib/worldCup2026';

export function EventEffects({ event }: { event: SnapLinkEventRecord | null }) {
  if (!event) return null;

  if (event.type === 'world_cup_2026') {
    const featuredMatches = WORLD_CUP_2026_FIXTURE_DAYS.slice(0, 3)
      .flatMap((day) => day.matches.slice(0, 2).map((match) => `${match.fixture} · ${day.label}`))
      .slice(0, 5);

    return (
      <>
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="sl-event-orb sl-event-orb-left" />
          <div className="sl-event-orb sl-event-orb-right" />
          <div className="sl-event-ball sl-event-ball-a">⚽</div>
          <div className="sl-event-ball sl-event-ball-b">⚽</div>
          <div className="sl-event-ball sl-event-ball-c">⚽</div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[5]">
          <div className="sl-event-ribbon">
            <div className="sl-event-ribbon-track">
              {featuredMatches.map((item, index) => (
                <span key={`${item}-${index}`} className="sl-event-ribbon-item">
                  <Trophy className="h-3.5 w-3.5" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </>
    );
  }

  if (event.type === 'doomsday') {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="sl-doomsday-glow sl-doomsday-glow-a" />
        <div className="sl-doomsday-glow sl-doomsday-glow-b" />
        <div className="sl-doomsday-badge">
          <Zap className="h-4 w-4" />
          Doomsday burst live
          <Sparkles className="h-4 w-4" />
        </div>
      </div>
    );
  }

  return null;
}
