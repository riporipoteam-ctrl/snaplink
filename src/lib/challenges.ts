import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { getEventBoostForUser } from './events';

export type ChallengeEvent =
  | 'post_create'
  | 'post_like'
  | 'comment_create'
  | 'follow_user'
  | 'group_join'
  | 'message_send';

export interface ChallengeRewards {
  coins?: number;
  xp?: number;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  rewards: ChallengeRewards;
  type: 'daily' | 'weekly';
  progress: number;
  target: number;
  completed: boolean;
  event: ChallengeEvent;
}

interface ChallengeTemplate extends Omit<Challenge, 'progress' | 'completed'> {}

export const CHALLENGE_VERSION = 3;

const DAILY_CHALLENGE_POOL: ChallengeTemplate[] = [
  { id: 'daily_post_spark', title: 'Morning Spark', description: 'Create 1 post today', rewards: { coins: 45, xp: 20 }, type: 'daily', target: 1, event: 'post_create' },
  { id: 'daily_post_push', title: 'Content Push', description: 'Create 2 posts today', rewards: { coins: 80, xp: 35 }, type: 'daily', target: 2, event: 'post_create' },
  { id: 'daily_post_showcase', title: 'Showcase Drop', description: 'Create 3 posts today', rewards: { coins: 110, xp: 48 }, type: 'daily', target: 3, event: 'post_create' },
  { id: 'daily_like_wave', title: 'Hype Wave', description: 'Like 5 posts today', rewards: { coins: 25, xp: 10 }, type: 'daily', target: 5, event: 'post_like' },
  { id: 'daily_like_rush', title: 'Reaction Rush', description: 'Like 10 posts today', rewards: { coins: 50, xp: 18 }, type: 'daily', target: 10, event: 'post_like' },
  { id: 'daily_like_storm', title: 'Like Storm', description: 'Like 15 posts today', rewards: { coins: 75, xp: 28 }, type: 'daily', target: 15, event: 'post_like' },
  { id: 'daily_comment_starter', title: 'Conversation Starter', description: 'Comment on 3 posts today', rewards: { coins: 35, xp: 18 }, type: 'daily', target: 3, event: 'comment_create' },
  { id: 'daily_comment_chain', title: 'Reply Chain', description: 'Comment on 5 posts today', rewards: { coins: 60, xp: 28 }, type: 'daily', target: 5, event: 'comment_create' },
  { id: 'daily_comment_huddle', title: 'Comment Huddle', description: 'Comment on 7 posts today', rewards: { coins: 88, xp: 36 }, type: 'daily', target: 7, event: 'comment_create' },
  { id: 'daily_follow_friend', title: 'New Connection', description: 'Follow 1 person today', rewards: { coins: 22, xp: 12 }, type: 'daily', target: 1, event: 'follow_user' },
  { id: 'daily_follow_circle', title: 'Circle Builder', description: 'Follow 2 people today', rewards: { coins: 44, xp: 20 }, type: 'daily', target: 2, event: 'follow_user' },
  { id: 'daily_group_hopper', title: 'Group Hopper', description: 'Join 1 group today', rewards: { coins: 40, xp: 24 }, type: 'daily', target: 1, event: 'group_join' },
  { id: 'daily_group_gather', title: 'Crew Gatherer', description: 'Join 2 groups today', rewards: { coins: 72, xp: 34 }, type: 'daily', target: 2, event: 'group_join' },
  { id: 'daily_dm_warmup', title: 'Check In', description: 'Send 3 messages today', rewards: { coins: 25, xp: 10 }, type: 'daily', target: 3, event: 'message_send' },
  { id: 'daily_dm_streak', title: 'Message Streak', description: 'Send 6 messages today', rewards: { coins: 55, xp: 22 }, type: 'daily', target: 6, event: 'message_send' },
  { id: 'daily_dm_blitz', title: 'Inbox Blitz', description: 'Send 10 messages today', rewards: { coins: 92, xp: 38 }, type: 'daily', target: 10, event: 'message_send' },
];

const WEEKEND_CHALLENGE_POOL: ChallengeTemplate[] = [
  { id: 'weekend_creator_marathon', title: 'Weekend Creator', description: 'Create 4 posts this weekend', rewards: { coins: 170, xp: 70 }, type: 'weekly', target: 4, event: 'post_create' },
  { id: 'weekend_comment_camp', title: 'Community Camp', description: 'Comment on 8 posts this weekend', rewards: { coins: 150, xp: 58 }, type: 'weekly', target: 8, event: 'comment_create' },
  { id: 'weekend_reaction_party', title: 'Reaction Party', description: 'Like 18 posts this weekend', rewards: { coins: 165, xp: 54 }, type: 'weekly', target: 18, event: 'post_like' },
  { id: 'weekend_networker', title: 'Weekend Networker', description: 'Follow 3 people this weekend', rewards: { coins: 130, xp: 48 }, type: 'weekly', target: 3, event: 'follow_user' },
  { id: 'weekend_chat_marathon', title: 'Late Night Chat', description: 'Send 12 messages this weekend', rewards: { coins: 155, xp: 55 }, type: 'weekly', target: 12, event: 'message_send' },
  { id: 'weekend_group_run', title: 'Crew Finder', description: 'Join 2 groups this weekend', rewards: { coins: 140, xp: 50 }, type: 'weekly', target: 2, event: 'group_join' },
  { id: 'weekend_creator_showdown', title: 'Creator Showdown', description: 'Create 6 posts this weekend', rewards: { coins: 220, xp: 92 }, type: 'weekly', target: 6, event: 'post_create' },
  { id: 'weekend_comment_wave', title: 'Community Wave', description: 'Comment on 12 posts this weekend', rewards: { coins: 205, xp: 80 }, type: 'weekly', target: 12, event: 'comment_create' },
  { id: 'weekend_like_drive', title: 'Like Drive', description: 'Like 25 posts this weekend', rewards: { coins: 210, xp: 78 }, type: 'weekly', target: 25, event: 'post_like' },
  { id: 'weekend_social_map', title: 'Social Map', description: 'Follow 5 people this weekend', rewards: { coins: 190, xp: 68 }, type: 'weekly', target: 5, event: 'follow_user' },
  { id: 'weekend_message_push', title: 'Message Push', description: 'Send 18 messages this weekend', rewards: { coins: 215, xp: 82 }, type: 'weekly', target: 18, event: 'message_send' },
  { id: 'weekend_group_tour', title: 'Group Tour', description: 'Join 3 groups this weekend', rewards: { coins: 185, xp: 72 }, type: 'weekly', target: 3, event: 'group_join' },
];

const LEGACY_EVENT_BY_ID: Record<string, ChallengeEvent> = {
  post_1: 'post_create',
  weekend_warrior: 'post_create',
  like_5: 'post_like',
  comment_3: 'comment_create',
  social_butterfly: 'comment_create',
};

function createSeed(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function shuffleWithSeed<T>(items: T[], seedKey: string) {
  const shuffled = [...items];
  let seed = createSeed(seedKey);

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    seed = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    seed ^= seed + Math.imul(seed ^ (seed >>> 7), 61 | seed);
    const random = ((seed ^ (seed >>> 14)) >>> 0) / 4294967296;
    const swapIndex = Math.floor(random * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function buildChallenge(template: ChallengeTemplate): Challenge {
  return {
    ...template,
    progress: 0,
    completed: false,
  };
}

function getChallengeDate(date = new Date()) {
  return date.toISOString().split('T')[0];
}

function getChallengesForDate(userId: string, dateStr: string, isWeekend: boolean) {
  const daily = shuffleWithSeed(DAILY_CHALLENGE_POOL, `${userId}:${dateStr}:daily`)
    .slice(0, 4)
    .map(buildChallenge);

  if (!isWeekend) return daily;

  const weekend = shuffleWithSeed(WEEKEND_CHALLENGE_POOL, `${userId}:${dateStr}:weekend`)
    .slice(0, 2)
    .map(buildChallenge);

  return [...daily, ...weekend];
}

function normalizeChallenge(challenge: any): Challenge {
  return {
    ...challenge,
    rewards: challenge.rewards || {
      coins: typeof challenge.reward === 'number' ? challenge.reward : 0,
      xp: 0,
    },
    event: challenge.event || LEGACY_EVENT_BY_ID[challenge.id] || 'post_create',
    progress: challenge.progress || 0,
    completed: Boolean(challenge.completed),
  };
}

function normalizeChallenges(challenges: Challenge[]) {
  return challenges.map(normalizeChallenge);
}

export async function getUserChallenges(userId: string, date = new Date()) {
  const dateStr = getChallengeDate(date);
  const challengeRef = doc(db, 'user_challenges', `${userId}_${dateStr}`);
  const challengeSnap = await getDoc(challengeRef);
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;

  if (challengeSnap.exists()) {
    const data = challengeSnap.data() as { challenges?: Challenge[]; version?: number };
    if (data.version === CHALLENGE_VERSION && Array.isArray(data.challenges)) {
      return normalizeChallenges(data.challenges);
    }
  }

  const freshChallenges = getChallengesForDate(userId, dateStr, isWeekend);
  await setDoc(challengeRef, {
    challenges: freshChallenges,
    date: dateStr,
    version: CHALLENGE_VERSION,
  });

  return freshChallenges;
}

export async function updateChallengeProgress(userId: string, eventOrLegacyId: ChallengeEvent | string) {
  if (!userId) return;

  const today = new Date();
  const dateStr = getChallengeDate(today);
  const challengeRef = doc(db, 'user_challenges', `${userId}_${dateStr}`);
  const event = (LEGACY_EVENT_BY_ID[eventOrLegacyId] || eventOrLegacyId) as ChallengeEvent;
  const eventBoost = await getEventBoostForUser(userId);
  const challengeStep = Math.max(1, Math.floor(eventBoost.challengeStep || 1));

  try {
    const challengeSnap = await getDoc(challengeRef);
    const isWeekend = today.getDay() === 0 || today.getDay() === 6;

    let challenges: Challenge[];
    let version = CHALLENGE_VERSION;

    if (challengeSnap.exists()) {
      const data = challengeSnap.data() as { challenges?: Challenge[]; version?: number };
      if (data.version === CHALLENGE_VERSION && Array.isArray(data.challenges)) {
        challenges = normalizeChallenges(data.challenges);
      } else {
        challenges = getChallengesForDate(userId, dateStr, isWeekend);
      }
      version = data.version || CHALLENGE_VERSION;
    } else {
      challenges = getChallengesForDate(userId, dateStr, isWeekend);
      await setDoc(challengeRef, { challenges, date: dateStr, version: CHALLENGE_VERSION });
      version = CHALLENGE_VERSION;
    }

    const updatedChallenges = challenges.map((challenge) => {
      if (challenge.event !== event || challenge.completed) {
        return challenge;
      }

      return {
        ...challenge,
        progress: Math.min(challenge.progress + challengeStep, challenge.target),
      };
    });

    await updateDoc(challengeRef, { challenges: updatedChallenges, version });
  } catch (error) {
    console.error('Error updating challenge:', error);
  }
}
