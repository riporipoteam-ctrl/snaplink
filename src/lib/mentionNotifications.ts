import { collection, getDocs } from 'firebase/firestore';
import type { UserProfile } from '../contexts/AuthContext';
import { db } from './firebase';
import { createNotificationForUsers } from './notifications';
import { normalizeUserSearchQuery } from './userSearch';

function getMentionedUsernames(text: string) {
  const matches = [...text.matchAll(/(^|\s)@([a-zA-Z0-9_]+)/g)];
  return [...new Set(matches.map((match) => match[2].toLowerCase()).filter((handle) => handle !== 'ripoai'))];
}

async function resolveMentionedUsers(handles: string[]) {
  if (!handles.length) return [];
  const snapshot = await getDocs(collection(db, 'users'));
  const handleSet = new Set(handles.map((handle) => normalizeUserSearchQuery(handle)));
  return snapshot.docs
    .map((userDoc) => userDoc.data() as UserProfile)
    .filter((user) => handleSet.has(normalizeUserSearchQuery(user.username)));
}

type MentionNotificationInput = {
  text: string;
  sourceUserId: string;
  sourceUser: {
    displayName: string;
    photoURL: string | null;
  };
  postId?: string;
  linkTo?: string;
  excludeUserIds?: string[];
  message?: string;
  title?: string;
};

export async function createMentionNotifications(input: MentionNotificationInput) {
  const handles = getMentionedUsernames(input.text);
  if (!handles.length) return [];

  const mentionedUsers = await resolveMentionedUsers(handles);
  const targetUserIds = mentionedUsers
    .map((user) => user.uid)
    .filter((uid) => uid !== input.sourceUserId)
    .filter((uid) => !(input.excludeUserIds || []).includes(uid));

  if (!targetUserIds.length) return [];

  await createNotificationForUsers(targetUserIds, {
    type: 'mention',
    title: input.title || 'You were mentioned on SnapLink',
    message: input.message,
    sourceUserId: input.sourceUserId,
    sourceUser: input.sourceUser,
    postId: input.postId,
    linkTo: input.linkTo,
  });

  return targetUserIds;
}
