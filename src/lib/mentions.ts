import { collection, getDocs, query, where } from 'firebase/firestore';
import type { UserProfile } from '../contexts/AuthContext';
import { db } from './firebase';
import { RIPOAI_PROFILE } from './ripoai';
import { normalizeUserSearchQuery } from './userSearch';

export type MentionCandidate = UserProfile & {
  isVirtual?: boolean;
};

function getDisplayLabel(user: Partial<UserProfile>) {
  return normalizeUserSearchQuery(`${user.displayName || ''} ${user.username || ''}`);
}

function sortCandidates(left: MentionCandidate, right: MentionCandidate) {
  if (left.uid === RIPOAI_PROFILE.uid) return -1;
  if (right.uid === RIPOAI_PROFILE.uid) return 1;
  return (left.displayName || left.username || '').localeCompare(right.displayName || right.username || '', undefined, {
    sensitivity: 'base',
  });
}

export async function getMentionCandidates(
  viewer: Pick<UserProfile, 'uid'> | null | undefined,
  rawQuery: string
) {
  const normalizedQuery = normalizeUserSearchQuery(rawQuery);
  const queryLength = normalizedQuery.replace(/\s+/g, '').length;

  const [usersSnapshot, followingSnapshot, followerSnapshot] = await Promise.all([
    getDocs(collection(db, 'users')),
    viewer?.uid
      ? getDocs(query(collection(db, 'follows'), where('followerId', '==', viewer.uid)))
      : Promise.resolve(null),
    viewer?.uid
      ? getDocs(query(collection(db, 'follows'), where('followingId', '==', viewer.uid)))
      : Promise.resolve(null),
  ]);

  const followingIds = new Set((followingSnapshot?.docs || []).map((followDoc) => String(followDoc.data().followingId || '')));
  const followerIds = new Set((followerSnapshot?.docs || []).map((followDoc) => String(followDoc.data().followerId || '')));

  const users = usersSnapshot.docs
    .map((userDoc) => userDoc.data() as UserProfile)
    .filter((user) => user.uid !== viewer?.uid);

  const connectedUsers = users.filter((user) => followingIds.has(user.uid) || followerIds.has(user.uid));
  const disconnectedUsers = users.filter((user) => !followingIds.has(user.uid) && !followerIds.has(user.uid));

  const matchesConnected = connectedUsers.filter((user) => {
    if (!normalizedQuery) return true;
    return getDisplayLabel(user).includes(normalizedQuery);
  });

  const matchesDisconnected = disconnectedUsers.filter((user) => {
    if (!normalizedQuery || queryLength < 3) return false;
    const username = normalizeUserSearchQuery(user.username).replace(/\s+/g, '');
    const display = getDisplayLabel(user);
    const minimumQueryLength = Math.max(3, Math.ceil(Math.max(username.length, 1) / 2));
    return (
      normalizedQuery.length >= minimumQueryLength &&
      (username.includes(normalizedQuery.replace(/\s+/g, '')) || display.includes(normalizedQuery))
    );
  });

  const shouldIncludeRipoAI =
    !normalizedQuery ||
    'ripoai'.startsWith(normalizedQuery.replace(/\s+/g, '')) ||
    normalizeUserSearchQuery(RIPOAI_PROFILE.displayName).includes(normalizedQuery);

  const merged = [
    ...(shouldIncludeRipoAI ? [{ ...RIPOAI_PROFILE, isVirtual: true } as MentionCandidate] : []),
    ...matchesConnected,
    ...matchesDisconnected,
  ]
    .filter((candidate, index, array) => array.findIndex((entry) => entry.uid === candidate.uid) === index)
    .sort(sortCandidates)
    .slice(0, 8);

  return merged;
}
