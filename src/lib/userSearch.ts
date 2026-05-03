import { collection, getDocs } from 'firebase/firestore';
import type { UserProfile } from '../contexts/AuthContext';
import { db } from './firebase';

function normalizeFragment(value: string | undefined | null) {
  return (value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function compactFragment(value: string | undefined | null) {
  return normalizeFragment(value).replace(/\s+/g, '');
}

export function normalizeUserSearchQuery(value: string) {
  return normalizeFragment(value);
}

function buildUserSearchParts(user: Partial<UserProfile>) {
  const displayName = normalizeFragment(user.displayName);
  const username = normalizeFragment(user.username);
  const bio = normalizeFragment(user.bio);
  const uid = normalizeFragment(user.uid);

  const parts = [
    displayName,
    username,
    bio,
    uid,
    compactFragment(user.displayName),
    compactFragment(user.username),
  ].filter(Boolean);

  return [...new Set(parts)];
}

function getUserMatchScore(user: Partial<UserProfile>, rawQuery: string) {
  const query = normalizeFragment(rawQuery);
  if (!query) return 1;

  const compactQuery = compactFragment(rawQuery);
  const parts = buildUserSearchParts(user);
  const queryTokens = query.split(/\s+/).filter(Boolean);

  let score = 0;
  for (const part of parts) {
    if (part === query || part === compactQuery) score = Math.max(score, 120);
    else if (part.startsWith(query) || part.startsWith(compactQuery)) score = Math.max(score, 90);
    else if (queryTokens.every((token) => part.includes(token))) score = Math.max(score, 65);
    else if (part.includes(query) || (compactQuery && part.includes(compactQuery))) score = Math.max(score, 50);
  }

  if (normalizeFragment(user.username) === query) score += 18;
  if (normalizeFragment(user.displayName) === query) score += 12;
  if (compactFragment(user.displayName) === compactQuery && compactQuery) score += 10;

  return score;
}

export function matchesUserSearch(user: Partial<UserProfile>, rawQuery: string) {
  return getUserMatchScore(user, rawQuery) > 0;
}

type SearchOptions = {
  excludeUserIds?: string[];
  includeRoles?: Array<UserProfile['role']>;
  includeBanned?: boolean;
  limit?: number;
};

export async function searchUsersByQuery(rawQuery: string, options: SearchOptions = {}) {
  const {
    excludeUserIds = [],
    includeRoles,
    includeBanned = true,
    limit = 12,
  } = options;

  const snapshot = await getDocs(collection(db, 'users'));
  const users = snapshot.docs
    .map((userDoc) => userDoc.data() as UserProfile)
    .filter((user) => !excludeUserIds.includes(user.uid))
    .filter((user) => includeBanned || !user.isBanned)
    .filter((user) => !includeRoles || includeRoles.includes(user.role));

  return users
    .map((user) => ({ user, score: getUserMatchScore(user, rawQuery) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return (left.user.displayName || left.user.username || '').localeCompare(
        right.user.displayName || right.user.username || '',
        undefined,
        { sensitivity: 'base' }
      );
    })
    .slice(0, limit)
    .map(({ user }) => user);
}
