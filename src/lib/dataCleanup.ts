import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { tryDeleteStoragePath } from './storageUploads';

export interface CleanupSummary {
  posts: number;
  comments: number;
  likes: number;
  reposts: number;
  notifications: number;
  sessions: number;
  loginTokens: number;
  storageObjects: number;
  totalDocs: number;
}

interface AdminCleanupOptions {
  postRetentionDays: number;
  notificationRetentionDays: number;
  sessionRetentionDays: number;
  loginTokenRetentionDays: number;
  maxPostsPerRun: number;
  maxNotificationsPerRun: number;
  maxSessionsPerRun: number;
  maxLoginTokensPerRun: number;
}

const EMPTY_SUMMARY: CleanupSummary = {
  posts: 0,
  comments: 0,
  likes: 0,
  reposts: 0,
  notifications: 0,
  sessions: 0,
  loginTokens: 0,
  storageObjects: 0,
  totalDocs: 0,
};

function getCutoffIso(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function addCounts(base: CleanupSummary, next: Partial<CleanupSummary>) {
  const merged: CleanupSummary = {
    posts: base.posts + (next.posts || 0),
    comments: base.comments + (next.comments || 0),
    likes: base.likes + (next.likes || 0),
    reposts: base.reposts + (next.reposts || 0),
    notifications: base.notifications + (next.notifications || 0),
    sessions: base.sessions + (next.sessions || 0),
    loginTokens: base.loginTokens + (next.loginTokens || 0),
    storageObjects: base.storageObjects + (next.storageObjects || 0),
    totalDocs: 0,
  };

  merged.totalDocs =
    merged.posts +
    merged.comments +
    merged.likes +
    merged.reposts +
    merged.notifications +
    merged.sessions +
    merged.loginTokens;

  return merged;
}

async function deleteDocsByField(collectionName: string, field: string, value: string) {
  const snapshot = await getDocs(query(collection(db, collectionName), where(field, '==', value)));
  for (const documentSnapshot of snapshot.docs) {
    await deleteDoc(documentSnapshot.ref);
  }
  return snapshot.size;
}

async function deleteCommentsForPost(postId: string) {
  const snapshot = await getDocs(query(collection(db, 'comments'), where('postId', '==', postId)));
  let deletedComments = 0;
  let deletedStorageObjects = 0;

  for (const commentDoc of snapshot.docs) {
    const commentData = commentDoc.data() as { mediaStoragePath?: string | null };
    if (await tryDeleteStoragePath(commentData.mediaStoragePath)) {
      deletedStorageObjects += 1;
    }
    await deleteDoc(commentDoc.ref);
    deletedComments += 1;
  }

  return {
    comments: deletedComments,
    storageObjects: deletedStorageObjects,
  };
}

export async function deletePostCascade(postInput: { id: string; media?: Array<{ storagePath?: string | null }> } | string) {
  const postRef = typeof postInput === 'string' ? doc(db, 'posts', postInput) : doc(db, 'posts', postInput.id);
  const postSnapshot = typeof postInput === 'string' ? await getDoc(postRef) : null;
  const postData =
    typeof postInput === 'string'
      ? postSnapshot?.exists()
        ? ({ id: postSnapshot.id, ...postSnapshot.data() } as { id: string; media?: Array<{ storagePath?: string | null }> })
        : null
      : postInput;

  if (!postData) {
    return { ...EMPTY_SUMMARY };
  }

  let summary = { ...EMPTY_SUMMARY };

  for (const mediaItem of postData.media || []) {
    if (await tryDeleteStoragePath(mediaItem?.storagePath)) {
      summary.storageObjects += 1;
    }
  }

  summary = addCounts(summary, await deleteCommentsForPost(postData.id));
  summary.likes += await deleteDocsByField('likes', 'postId', postData.id);
  summary.reposts += await deleteDocsByField('reposts', 'postId', postData.id);
  summary.notifications += await deleteDocsByField('notifications', 'postId', postData.id);
  await deleteDoc(postRef);
  summary.posts += 1;

  return addCounts(EMPTY_SUMMARY, summary);
}

async function deleteOldDocs(collectionName: string, cutoffIso: string, limitCount: number) {
  const snapshot = await getDocs(
    query(
      collection(db, collectionName),
      where('createdAt', '<=', cutoffIso),
      orderBy('createdAt', 'asc'),
      limit(limitCount)
    )
  );

  for (const documentSnapshot of snapshot.docs) {
    await deleteDoc(documentSnapshot.ref);
  }

  return snapshot.size;
}

export async function runAdminCleanup(options: Partial<AdminCleanupOptions> = {}) {
  const config: AdminCleanupOptions = {
    postRetentionDays: options.postRetentionDays ?? 90,
    notificationRetentionDays: options.notificationRetentionDays ?? 30,
    sessionRetentionDays: options.sessionRetentionDays ?? 30,
    loginTokenRetentionDays: options.loginTokenRetentionDays ?? 7,
    maxPostsPerRun: options.maxPostsPerRun ?? 10,
    maxNotificationsPerRun: options.maxNotificationsPerRun ?? 200,
    maxSessionsPerRun: options.maxSessionsPerRun ?? 100,
    maxLoginTokensPerRun: options.maxLoginTokensPerRun ?? 100,
  };

  let summary = { ...EMPTY_SUMMARY };

  const postsSnapshot = await getDocs(
    query(
      collection(db, 'posts'),
      where('createdAt', '<=', getCutoffIso(config.postRetentionDays)),
      orderBy('createdAt', 'asc'),
      limit(config.maxPostsPerRun)
    )
  );

  for (const postDoc of postsSnapshot.docs) {
    summary = addCounts(summary, await deletePostCascade({ id: postDoc.id, ...(postDoc.data() as any) }));
  }

  summary = addCounts(summary, {
    notifications: await deleteOldDocs('notifications', getCutoffIso(config.notificationRetentionDays), config.maxNotificationsPerRun),
  });

  summary = addCounts(summary, {
    sessions: await deleteOldDocs('sessions', getCutoffIso(config.sessionRetentionDays), config.maxSessionsPerRun),
  });

  summary = addCounts(summary, {
    loginTokens: await deleteOldDocs('login_tokens', getCutoffIso(config.loginTokenRetentionDays), config.maxLoginTokensPerRun),
  });

  return summary;
}
