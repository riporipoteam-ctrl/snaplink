import fs from 'node:fs/promises';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
const SOURCE_DATABASE_ID = process.env.FIREBASE_SOURCE_DATABASE_ID || 'ai-studio-a03748cc-4acb-4705-a200-cc7a8e64a31b';
const ROOT_COLLECTIONS = [
  'users',
  'posts',
  'likes',
  'comments',
  'follows',
  'user_challenges',
  'notifications',
  'account_switchers',
  'groups',
  'chats',
  'livestreams',
  'hashtags',
  'admin_tasks',
  'meeting_schedules',
  'meeting_rooms',
  'attendance',
  'badges',
  'calls',
  'makespace_rooms',
  'reports',
  'login_tokens',
  'sessions',
  'announcements',
  'user_reward_boxes',
  'game_positions',
  'game_chat',
];

if (!SERVICE_ACCOUNT_PATH) {
  throw new Error('Set FIREBASE_SERVICE_ACCOUNT_PATH before running this migration.');
}

const serviceAccount = JSON.parse(await fs.readFile(SERVICE_ACCOUNT_PATH, 'utf8'));
const app =
  getApps().find((candidate) => candidate.name === 'snaplink-migrate-default') ||
  initializeApp(
    {
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    },
    'snaplink-migrate-default'
  );

const sourceDb = getFirestore(app, SOURCE_DATABASE_ID);
const targetDb = getFirestore(app);

const summary = {
  sourceDatabaseId: SOURCE_DATABASE_ID,
  copiedDocuments: 0,
  copiedCollections: new Map(),
};

async function copyCollection(sourceCollectionRef, targetCollectionRef) {
  const snapshot = await sourceCollectionRef.get();

  for (const sourceDoc of snapshot.docs) {
    const data = sourceDoc.data();
    await targetCollectionRef.doc(sourceDoc.id).set(data, { merge: true });

    summary.copiedDocuments += 1;
    const collectionName = sourceCollectionRef.id;
    summary.copiedCollections.set(collectionName, (summary.copiedCollections.get(collectionName) || 0) + 1);

    const nestedCollections = await sourceDoc.ref.listCollections();
    for (const nestedCollection of nestedCollections) {
      await copyCollection(nestedCollection, targetCollectionRef.doc(sourceDoc.id).collection(nestedCollection.id));
    }
  }
}

for (const collectionName of ROOT_COLLECTIONS) {
  await copyCollection(sourceDb.collection(collectionName), targetDb.collection(collectionName));
}

console.log(
  JSON.stringify(
    {
      sourceDatabaseId: summary.sourceDatabaseId,
      copiedDocuments: summary.copiedDocuments,
      copiedCollections: Object.fromEntries([...summary.copiedCollections.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
    },
    null,
    2
  )
);
