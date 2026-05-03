import { collection, doc, getDocs, onSnapshot, orderBy, query, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { createNotificationForUsers } from './notifications';
import { WORLD_CUP_2026_END, WORLD_CUP_2026_START } from './worldCup2026';

export type SnapLinkEventType = 'doomsday' | 'community_boost' | 'world_cup_2026';
export type SnapLinkEventScope = 'global' | 'admin_preview';

export interface SnapLinkEventRecord {
  id: string;
  type: SnapLinkEventType;
  scope: SnapLinkEventScope;
  title: string;
  description: string;
  announcement: string;
  themeKey: 'doomsday' | 'boost' | 'world-cup';
  challengeMultiplier: number;
  xpMultiplier: number;
  coinMultiplier: number;
  startAt: string;
  endAt: string;
  createdAt: string;
  createdBy: string;
  previewForUserId?: string | null;
}

export const SNAPLINK_EVENT_COLLECTION = 'events';
export const DOOMSDAY_DURATION_MS = 20 * 60 * 1000;
export const DOOMSDAY_LAUNCH_DAY = '2026-04-19';
export const DOOMSDAY_RECURRING_ANCHOR = '2026-06-10T18:00:00+02:00';
export const WORLD_CUP_EVENT_DURATION_MS =
  new Date(WORLD_CUP_2026_END).getTime() - new Date(WORLD_CUP_2026_START).getTime();

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function getSarajevoDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Sarajevo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function formatEventId(type: SnapLinkEventType, scope: SnapLinkEventScope, token: string) {
  return `${type}_${scope}_${token}`.replace(/[^\w.-]/g, '_');
}

function getCurrentRecurringDoomsdayWindow(reference = new Date()) {
  let cursor = new Date(DOOMSDAY_RECURRING_ANCHOR);
  while (cursor.getTime() + DOOMSDAY_DURATION_MS <= reference.getTime()) {
    cursor = addMonths(cursor, 3);
  }
  if (reference.getTime() < cursor.getTime() || reference.getTime() >= cursor.getTime() + DOOMSDAY_DURATION_MS) {
    return null;
  }
  return cursor;
}

export function getNextDoomsdayStart(reference = new Date()) {
  const currentWindow = getCurrentRecurringDoomsdayWindow(reference);
  if (currentWindow) {
    return addMonths(currentWindow, 3);
  }

  let cursor = new Date(DOOMSDAY_RECURRING_ANCHOR);
  while (cursor.getTime() <= reference.getTime()) {
    cursor = addMonths(cursor, 3);
  }
  return cursor;
}

export function buildDoomsdayEvent(
  createdBy: string,
  scope: SnapLinkEventScope,
  startAt = new Date(),
  previewForUserId?: string | null,
  idToken?: string
): SnapLinkEventRecord {
  const endAt = new Date(startAt.getTime() + DOOMSDAY_DURATION_MS);

  return {
    id: formatEventId('doomsday', scope, idToken || String(startAt.getTime())),
    type: 'doomsday',
    scope,
    title: 'Doomsday Event',
    description: 'Meteor showers hit SnapLink, rewards surge, and the whole app flips into survival mode for a short burst.',
    announcement: 'Doomsday has started. Catch the drops, hit the boosted challenges, and survive the blast window.',
    themeKey: 'doomsday',
    challengeMultiplier: 2,
    xpMultiplier: 2,
    coinMultiplier: 2,
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    createdAt: new Date().toISOString(),
    createdBy,
    previewForUserId: previewForUserId || null,
  };
}

export function buildWorldCupEvent(
  createdBy: string,
  scope: SnapLinkEventScope,
  previewForUserId?: string | null
): SnapLinkEventRecord {
  return {
    id: formatEventId('world_cup_2026', scope, scope === 'global' ? '2026' : previewForUserId || 'preview'),
    type: 'world_cup_2026',
    scope,
    title: 'World Cup 2026 x SnapLink',
    description: 'SnapLink flips into matchday mode with supporter drops, event challenges, live boards, and football-first styling across the app.',
    announcement: 'World Cup 2026 mode is live on SnapLink. Matchday boards, boosts, supporter drops, and event rewards are now unlocked.',
    themeKey: 'world-cup',
    challengeMultiplier: 2,
    xpMultiplier: 2,
    coinMultiplier: 2,
    startAt: new Date(WORLD_CUP_2026_START).toISOString(),
    endAt: new Date(WORLD_CUP_2026_END).toISOString(),
    createdAt: new Date().toISOString(),
    createdBy,
    previewForUserId: previewForUserId || null,
  };
}

export function isEventActive(event: Pick<SnapLinkEventRecord, 'startAt' | 'endAt'>, now = new Date()) {
  const start = new Date(event.startAt).getTime();
  const end = new Date(event.endAt).getTime();
  return now.getTime() >= start && now.getTime() < end;
}

export function canUserSeeEvent(event: SnapLinkEventRecord, userId?: string | null) {
  if (event.scope === 'global') return true;
  return Boolean(userId && event.previewForUserId === userId);
}

export function getVisibleActiveEvent(events: SnapLinkEventRecord[], userId?: string | null, now = new Date()) {
  const visibleEvents = events.filter((event) => canUserSeeEvent(event, userId));
  const previewEvent =
    visibleEvents
      .filter((event) => event.scope === 'admin_preview')
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0] || null;

  if (previewEvent) {
    return previewEvent;
  }

  return (
    visibleEvents
      .filter((event) => isEventActive(event, now))
      .sort((left, right) => new Date(right.startAt).getTime() - new Date(left.startAt).getTime())[0] || null
  );
}

export function getShellActiveEvent(events: SnapLinkEventRecord[], now = new Date()) {
  return (
    events
      .filter((event) => event.scope === 'global' && isEventActive(event, now))
      .sort((left, right) => new Date(right.startAt).getTime() - new Date(left.startAt).getTime())[0] || null
  );
}

export async function fetchAllEvents() {
  const snapshot = await getDocs(query(collection(db, SNAPLINK_EVENT_COLLECTION), orderBy('startAt', 'desc')));
  return snapshot.docs.map((eventDoc) => ({ id: eventDoc.id, ...eventDoc.data() } as SnapLinkEventRecord));
}

export function subscribeToEvents(callback: (events: SnapLinkEventRecord[]) => void) {
  return onSnapshot(query(collection(db, SNAPLINK_EVENT_COLLECTION), orderBy('startAt', 'desc')), (snapshot) => {
    callback(snapshot.docs.map((eventDoc) => ({ id: eventDoc.id, ...eventDoc.data() } as SnapLinkEventRecord)));
  });
}

async function notifyEventAudience(event: SnapLinkEventRecord) {
  const usersSnapshot = await getDocs(collection(db, 'users'));
  const targetUserIds = usersSnapshot.docs
    .map((userDoc) => userDoc.id)
    .filter((uid) => event.scope === 'global' || uid === event.previewForUserId);

  if (targetUserIds.length === 0) return;

  await createNotificationForUsers(targetUserIds, {
    type: 'event',
    sourceUserId: event.createdBy,
    title: event.title,
    message: event.announcement,
    linkTo: '/events',
    dedupeKey: `${event.id}_start`,
  });
}

export async function launchDoomsdayEvent(input: {
  createdBy: string;
  scope: SnapLinkEventScope;
  previewForUserId?: string | null;
  startAt?: Date;
  idToken?: string;
}) {
  const event = buildDoomsdayEvent(
    input.createdBy,
    input.scope,
    input.startAt || new Date(),
    input.previewForUserId,
    input.idToken
  );
  await setDoc(doc(db, SNAPLINK_EVENT_COLLECTION, event.id), event);
  await notifyEventAudience(event);
  return event;
}

export async function launchWorldCupEvent(input: {
  createdBy: string;
  scope: SnapLinkEventScope;
  previewForUserId?: string | null;
}) {
  const event = buildWorldCupEvent(input.createdBy, input.scope, input.previewForUserId);
  await setDoc(doc(db, SNAPLINK_EVENT_COLLECTION, event.id), event);
  await notifyEventAudience(event);
  return event;
}

export async function maybeBootstrapScheduledDoomsday(createdBy: string) {
  const now = new Date();
  const existingEvents = await fetchAllEvents();

  if (getSarajevoDateKey(now) === DOOMSDAY_LAUNCH_DAY) {
    const launchDayId = formatEventId('doomsday', 'global', DOOMSDAY_LAUNCH_DAY);
    const existingLaunch = existingEvents.find((event) => event.id === launchDayId && isEventActive(event, now));
    if (existingLaunch) return existingLaunch;

    return launchDoomsdayEvent({
      createdBy,
      scope: 'global',
      startAt: now,
      idToken: DOOMSDAY_LAUNCH_DAY,
    });
  }

  const currentWindow = getCurrentRecurringDoomsdayWindow(now);
  if (!currentWindow) {
    return null;
  }

  const recurringId = formatEventId('doomsday', 'global', currentWindow.toISOString().slice(0, 16));
  const existing = existingEvents.find((event) => event.id === recurringId);
  if (existing) return existing;

  return launchDoomsdayEvent({
    createdBy,
    scope: 'global',
    startAt: currentWindow,
    idToken: currentWindow.toISOString().slice(0, 16),
  });
}

export async function maybeBootstrapScheduledWorldCup(createdBy: string) {
  const now = new Date();
  const start = new Date(WORLD_CUP_2026_START).getTime();
  const end = new Date(WORLD_CUP_2026_END).getTime();
  if (now.getTime() < start || now.getTime() >= end) return null;

  const existingEvents = await fetchAllEvents();
  const eventId = formatEventId('world_cup_2026', 'global', '2026');
  const existing = existingEvents.find((event) => event.id === eventId);
  if (existing) return existing;

  return launchWorldCupEvent({
    createdBy,
    scope: 'global',
  });
}

export async function maybeBootstrapScheduledEvents(createdBy: string) {
  await Promise.allSettled([
    maybeBootstrapScheduledDoomsday(createdBy),
    maybeBootstrapScheduledWorldCup(createdBy),
  ]);
}

export async function getEventBoostForUser(userId?: string | null) {
  if (!userId) {
    return {
      activeEvent: null as SnapLinkEventRecord | null,
      xpMultiplier: 1,
      coinMultiplier: 1,
      challengeStep: 1,
    };
  }

  const events = await fetchAllEvents();
  const activeEvent = getVisibleActiveEvent(events, userId);

  return {
    activeEvent,
    xpMultiplier: activeEvent?.xpMultiplier || 1,
    coinMultiplier: activeEvent?.coinMultiplier || 1,
    challengeStep: activeEvent?.challengeMultiplier || 1,
  };
}
