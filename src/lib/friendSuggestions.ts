import { collection, getDocs } from 'firebase/firestore';
import type { UserProfile } from '../contexts/AuthContext';
import { db } from './firebase';

type SuggestionOptions = {
  limit?: number;
};

function getSarajevoDayKey() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Sarajevo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function stringHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function seededFraction(seed: string) {
  return (stringHash(seed) % 1000) / 1000;
}

function isRecentlyActive(user: Partial<UserProfile>) {
  if (!user.lastSeen) return false;
  const lastSeenMs = new Date(user.lastSeen).getTime();
  if (Number.isNaN(lastSeenMs)) return false;
  return Date.now() - lastSeenMs < 1000 * 60 * 60 * 24 * 7;
}

export async function getSuggestedUsersForViewer(viewer: UserProfile, options: SuggestionOptions = {}) {
  const limitCount = options.limit ?? 3;

  const [usersSnap, followsSnap, groupsSnap] = await Promise.all([
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'follows')),
    getDocs(collection(db, 'groups')),
  ]);

  const allUsers = usersSnap.docs.map((userDoc) => userDoc.data() as UserProfile);
  const follows = followsSnap.docs.map((followDoc) => followDoc.data() as { followerId: string; followingId: string });
  const groups = groupsSnap.docs.map((groupDoc) => groupDoc.data() as { members?: string[] });

  const followingIds = new Set(
    follows.filter((follow) => follow.followerId === viewer.uid).map((follow) => follow.followingId)
  );
  const followerIds = new Set(
    follows.filter((follow) => follow.followingId === viewer.uid).map((follow) => follow.followerId)
  );
  const viewerGroups = new Set(
    groups
      .map((group, index) => ({ group, index }))
      .filter(({ group }) => group.members?.includes(viewer.uid))
      .map(({ index }) => index)
  );

  const dayKey = getSarajevoDayKey();

  return allUsers
    .filter((candidate) => candidate.uid !== viewer.uid)
    .filter((candidate) => !candidate.isBanned)
    .filter((candidate) => !followingIds.has(candidate.uid))
    .map((candidate) => {
      const sharedGroups = groups.reduce((count, group, index) => {
        if (!viewerGroups.has(index)) return count;
        return group.members?.includes(candidate.uid) ? count + 1 : count;
      }, 0);

      const candidateFollowers = follows.filter((follow) => follow.followingId === candidate.uid);
      const candidateFollowerIds = new Set(candidateFollowers.map((follow) => follow.followerId));
      const sharedFollowers = Array.from(followerIds).reduce((count, followerId) => {
        return candidateFollowerIds.has(followerId) ? count + 1 : count;
      }, 0);

      let score = 0;
      if (followerIds.has(candidate.uid)) score += 34;
      score += sharedGroups * 22;
      score += sharedFollowers * 10;
      score += Math.min(candidate.followersCount || 0, 20) * 0.3;
      if (candidate.isVerified) score += 5;
      if (candidate.role === 'member') score += 3;
      if (candidate.role === 'admin') score += 1;
      if (candidate.activityStatus === 'online') score += 9;
      if (isRecentlyActive(candidate)) score += 6;

      const seededBoost = seededFraction(`${viewer.uid}:${candidate.uid}:${dayKey}`) * 12;
      return { candidate, score: score + seededBoost };
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return (left.candidate.displayName || left.candidate.username || '').localeCompare(
        right.candidate.displayName || right.candidate.username || '',
        undefined,
        { sensitivity: 'base' }
      );
    })
    .slice(0, limitCount)
    .map(({ candidate }) => candidate);
}
