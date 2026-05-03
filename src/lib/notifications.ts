import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import type { UserProfile } from '../contexts/AuthContext';
import { db } from './firebase';

export interface NotificationRecord {
  id: string;
  type: string;
  sourceUserId: string;
  targetUserId: string;
  postId?: string;
  message?: string;
  title?: string;
  createdAt: string;
  read: boolean;
  linkTo?: string;
  chatId?: string;
  dedupeKey?: string;
  sourceUser?: {
    displayName: string;
    photoURL: string | null;
  };
}

interface NotificationCreateInput {
  id?: string;
  type: string;
  sourceUserId: string;
  targetUserId: string;
  postId?: string;
  message?: string;
  title?: string;
  linkTo?: string;
  chatId?: string;
  dedupeKey?: string;
  sourceUser?: {
    displayName: string;
    photoURL: string | null;
  };
}

function buildNotificationDocId(input: NotificationCreateInput) {
  const explicitId = input.id?.trim();
  if (explicitId) return explicitId.replace(/[^\w.-]/g, '_');
  if (!input.dedupeKey) return null;
  return `${input.type}_${input.targetUserId}_${input.dedupeKey}`.replace(/[^\w.-]/g, '_');
}

export async function createNotification(input: NotificationCreateInput) {
  const staticId = buildNotificationDocId(input);
  const notificationRef = staticId ? doc(db, 'notifications', staticId) : doc(collection(db, 'notifications'));
  const { id: _id, dedupeKey: _dedupeKey, ...rest } = input;
  await setDoc(notificationRef, {
    id: notificationRef.id,
    createdAt: new Date().toISOString(),
    read: false,
    ...rest,
  }, { merge: Boolean(staticId) });
  return notificationRef.id;
}

export async function createNotificationForUsers(
  targetUserIds: string[],
  input: Omit<NotificationCreateInput, 'targetUserId'>
) {
  const uniqueUserIds = [...new Set(targetUserIds.filter(Boolean))];
  await Promise.all(
    uniqueUserIds.map((targetUserId) =>
      createNotification({
        ...input,
        targetUserId,
      })
    )
  );
}

export async function getRoleUserIds(roles: Array<UserProfile['role']>) {
  const userSnapshot = await getDocs(query(collection(db, 'users'), where('role', 'in', roles)));
  return userSnapshot.docs.map((userDoc) => userDoc.id);
}

export function describeNotification(notification: Pick<NotificationRecord, 'type' | 'message' | 'sourceUser' | 'title'>) {
  const name = notification.sourceUser?.displayName || 'Someone';

  switch (notification.type) {
    case 'like':
      return `${name} liked your post`;
    case 'follow':
      return `${name} followed you on SnapLink`;
    case 'comment':
      return `${name} replied to your post`;
    case 'mention':
      return `${name} mentioned you`;
    case 'message':
      return notification.title || `${name} sent you a message`;
    case 'call':
      return notification.title || `${name} is calling you`;
    case 'warning':
      return notification.title || 'You received a warning';
    case 'ban':
      return notification.title || 'Your account status changed';
    case 'task':
      return notification.message || `${name} assigned you a task`;
    case 'attendance':
      return notification.message || 'Your attendance was updated';
    case 'meeting':
      return notification.message || 'A meeting update is available';
    case 'announcement':
      return notification.message || 'A new announcement was posted';
    case 'event':
      return notification.message || notification.title || 'A SnapLink event is live';
    case 'story_reaction':
      return notification.message || notification.title || `${name} reacted to your story`;
    case 'business_affiliation':
      return notification.message || notification.title || 'A business affiliation update is waiting';
    default:
      return notification.message || notification.title || 'New notification';
  }
}

export function getNotificationLink(notification: Pick<NotificationRecord, 'type' | 'postId' | 'sourceUserId' | 'linkTo'>) {
  if (notification.linkTo) return notification.linkTo;
  if (notification.type === 'follow') return `/profile/${notification.sourceUserId}`;
  if (notification.type === 'message' || notification.type === 'call') return '/messages';
  if (notification.postId) return `/post/${notification.postId}`;
  if (notification.type === 'warning') return '/admin/warnings';
  if (notification.type === 'ban') return '/admin/bans';
  if (notification.type === 'task') return '/admin/tasks';
  if (notification.type === 'attendance') return '/admin/attendance';
  if (notification.type === 'meeting') return '/admin/meetings';
  if (notification.type === 'announcement') return '/announcements';
  if (notification.type === 'event') return '/events';
  if (notification.type === 'story_reaction') return `/profile/${notification.sourceUserId}`;
  if (notification.type === 'business_affiliation') return '/profile';
  return '/notifications';
}
