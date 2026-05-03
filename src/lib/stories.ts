import {
  collection,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import type { UserProfile } from '../contexts/AuthContext';
import { tryDeleteStoragePath } from './storageUploads';
import { createNotification } from './notifications';

export type StoryFontStyle = 'classic' | 'headline' | 'mono';
export type StoryMediaType = 'image' | 'video';
export type StoryReaction = 'heart' | 'fire' | 'wow';

export type StoryTrack = {
  id: string;
  title: string;
  artist: string;
  url: string;
};

export type StoryRecord = {
  id: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorPhotoURL?: string | null;
  createdAt: string;
  expiresAt: string;
  mediaUrl: string;
  mediaType: StoryMediaType;
  mediaStoragePath?: string | null;
  storyGroupId: string;
  storyIndex: number;
  caption?: string;
  captionStyle?: StoryFontStyle;
  musicId?: string | null;
  musicTitle?: string | null;
  musicArtist?: string | null;
  musicUrl?: string | null;
  viewsCount?: number;
  reactionsCount?: number;
  deletedAt?: string | null;
};

export type StoryAuthorGroup = {
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorPhotoURL?: string | null;
  stories: StoryRecord[];
  hasUnseen: boolean;
};

export const STORY_MUSIC_LIBRARY: StoryTrack[] = [
  {
    id: 'midnight-prelude',
    title: 'Midnight Prelude',
    artist: 'Frédéric Chopin (public domain)',
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/FChopinPreludeOp28n4.OGG',
  },
  {
    id: 'berceuse-dream',
    title: 'Berceuse Dream',
    artist: 'Christine Hartley (public domain performance)',
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/1%20Chopin,%20Berceuse%20(piano-Christine%20Hartley).ogg',
  },
  {
    id: 'arabesque-sky',
    title: 'Arabesque Sky',
    artist: 'Claude Debussy (free recording)',
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Claude%20Debussy%20-%202nd%20Arabesque%20(JMC,%20Han).oga',
  },
];

function getStoryTime(value?: string) {
  const parsed = value ? new Date(value).getTime() : 0;
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getViewedStoryStorageKey(viewer?: Pick<UserProfile, 'uid'> | null) {
  return viewer?.uid ? `snaplink_story_views_${viewer.uid}` : 'snaplink_story_views_guest';
}

export function getActiveStories(stories: StoryRecord[], now = new Date()) {
  return stories
    .filter((story) => !story.deletedAt)
    .filter((story) => getStoryTime(story.expiresAt) > now.getTime())
    .sort((left, right) => getStoryTime(left.createdAt) - getStoryTime(right.createdAt));
}

export function subscribeToActiveStories(callback: (stories: StoryRecord[]) => void) {
  return onSnapshot(
    query(collection(db, 'stories'), orderBy('createdAt', 'desc')),
    (snapshot) => {
      const nextStories = getActiveStories(
        snapshot.docs.map((storyDoc) => ({ id: storyDoc.id, ...storyDoc.data() } as StoryRecord))
      );
      callback(nextStories);
    }
  );
}

export function groupStoriesByAuthor(stories: StoryRecord[], viewer?: Pick<UserProfile, 'uid'> | null) {
  const viewedStorageKey = getViewedStoryStorageKey(viewer);
  const viewedIds =
    typeof window === 'undefined'
      ? new Set<string>()
      : new Set<string>(JSON.parse(localStorage.getItem(viewedStorageKey) || '[]'));
  const groups = new Map<string, StoryAuthorGroup>();

  stories.forEach((story) => {
    const current = groups.get(story.authorId);
    if (current) {
      current.stories.push(story);
      current.hasUnseen = current.hasUnseen || !viewedIds.has(story.id);
    } else {
      groups.set(story.authorId, {
        authorId: story.authorId,
        authorName: story.authorName,
        authorUsername: story.authorUsername,
        authorPhotoURL: story.authorPhotoURL || null,
        stories: [story],
        hasUnseen: !viewedIds.has(story.id),
      });
    }
  });

  return [...groups.values()].sort((left, right) => {
    const rightNewest = getStoryTime(right.stories[right.stories.length - 1]?.createdAt);
    const leftNewest = getStoryTime(left.stories[left.stories.length - 1]?.createdAt);
    return rightNewest - leftNewest;
  });
}

export function rememberViewedStory(storyId: string, viewer?: Pick<UserProfile, 'uid'> | null) {
  if (typeof window === 'undefined') return;
  const viewedStorageKey = getViewedStoryStorageKey(viewer);
  const currentIds = new Set<string>(JSON.parse(localStorage.getItem(viewedStorageKey) || '[]'));
  currentIds.add(storyId);
  localStorage.setItem(viewedStorageKey, JSON.stringify([...currentIds]));
}

export async function registerStoryView(story: StoryRecord, viewer?: Pick<UserProfile, 'uid' | 'displayName' | 'photoURL'> | null) {
  if (!viewer?.uid || viewer.uid === story.authorId) return;
  const viewRef = doc(db, `stories/${story.id}/views`, viewer.uid);
  const existingView = await getDoc(viewRef);
  if (existingView.exists()) return;

  await setDoc(viewRef, {
    userId: viewer.uid,
    displayName: viewer.displayName || null,
    photoURL: viewer.photoURL || null,
    createdAt: new Date().toISOString(),
  });
  await updateDoc(doc(db, 'stories', story.id), {
    viewsCount: increment(1),
  });
}

export async function registerStoryReaction(story: StoryRecord, viewer: Pick<UserProfile, 'uid' | 'displayName' | 'photoURL'>, reaction: StoryReaction) {
  const reactionRef = doc(db, `stories/${story.id}/reactions`, viewer.uid);
  const existingReaction = await getDoc(reactionRef);

  await setDoc(reactionRef, {
    userId: viewer.uid,
    reaction,
    displayName: viewer.displayName,
    photoURL: viewer.photoURL || null,
    createdAt: new Date().toISOString(),
  });

  if (!existingReaction.exists()) {
    await updateDoc(doc(db, 'stories', story.id), {
      reactionsCount: increment(1),
    });

    if (viewer.uid !== story.authorId) {
      await createNotification({
        type: 'story_reaction',
        sourceUserId: viewer.uid,
        targetUserId: story.authorId,
        title: `${viewer.displayName} reacted to your story`,
        message: `${viewer.displayName} sent a ${reaction} reaction to your story.`,
        sourceUser: {
          displayName: viewer.displayName,
          photoURL: viewer.photoURL || null,
        },
        linkTo: `/profile/${viewer.uid}`,
        dedupeKey: `story-reaction-${story.id}-${viewer.uid}`,
      });
    }
  }
}

export async function fetchStoryInteractions(storyId: string) {
  const [viewsSnapshot, reactionsSnapshot] = await Promise.all([
    getDocs(collection(db, `stories/${storyId}/views`)),
    getDocs(collection(db, `stories/${storyId}/reactions`)),
  ]);

  return {
    views: viewsSnapshot.docs.map((viewDoc) => viewDoc.data() as { userId: string; displayName?: string; photoURL?: string | null; createdAt: string }),
    reactions: reactionsSnapshot.docs.map((reactionDoc) => reactionDoc.data() as {
      userId: string;
      reaction: StoryReaction;
      displayName?: string;
      photoURL?: string | null;
      createdAt: string;
    }),
  };
}

export async function createStoryReport(story: StoryRecord, reporter: Pick<UserProfile, 'uid' | 'displayName' | 'photoURL'>, reason: string) {
  const reportRef = doc(collection(db, 'reports'));
  await setDoc(reportRef, {
    id: reportRef.id,
    targetId: story.id,
    targetType: 'story',
    reporterId: reporter.uid,
    reporterName: reporter.displayName,
    reporterPhotoURL: reporter.photoURL || null,
    storyAuthorId: story.authorId,
    reason,
    createdAt: new Date().toISOString(),
    status: 'pending',
  });
}

export async function deleteStory(story: Pick<StoryRecord, 'id' | 'mediaStoragePath'>) {
  if (story.mediaStoragePath) {
    await tryDeleteStoragePath(story.mediaStoragePath);
  }
  await updateDoc(doc(db, 'stories', story.id), {
    deletedAt: new Date().toISOString(),
  });
}

export async function deleteStoryCompletely(story: Pick<StoryRecord, 'id' | 'mediaStoragePath'>) {
  if (story.mediaStoragePath) {
    await tryDeleteStoragePath(story.mediaStoragePath);
  }
  await deleteDoc(doc(db, 'stories', story.id));
}

export function getStoryAuthorsByIds(stories: StoryRecord[]) {
  return new Set(stories.map((story) => story.authorId));
}

export function getStoriesForAuthor(stories: StoryRecord[], authorId?: string | null) {
  if (!authorId) return [];
  return stories.filter((story) => story.authorId === authorId);
}
