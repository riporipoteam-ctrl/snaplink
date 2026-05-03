import fs from 'node:fs/promises';
import path from 'node:path';

const requiredCollections = [
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
  'game_chat'
];

async function main() {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!serviceAccountPath) {
    throw new Error('Set FIREBASE_SERVICE_ACCOUNT_PATH to a Firebase Admin JSON file before exporting.');
  }

  const outputPath = process.env.SNAPLINK_FIRESTORE_EXPORT_PATH || path.resolve('cloudflare', 'tmp', 'firestore-export.json');
  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');

  const serviceAccount = JSON.parse(await fs.readFile(serviceAccountPath, 'utf8'));
  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  const documents = [];

  async function exportCollection(collectionRef, parentPath = null) {
    const snapshot = await collectionRef.get();
    for (const documentSnapshot of snapshot.docs) {
      const pathValue = documentSnapshot.ref.path;
      const payload = documentSnapshot.data();
      const collectionName = documentSnapshot.ref.parent.id;
      const ownerId =
        payload.authorId ||
        payload.creatorId ||
        payload.userId ||
        payload.uid ||
        payload.targetUserId ||
        null;

      documents.push({
        path: pathValue,
        collectionName,
        docId: documentSnapshot.id,
        parentPath,
        ownerId,
        createdAt: payload.createdAt || payload.updatedAt || null,
        payload,
      });

      for (const nestedCollection of await documentSnapshot.ref.listCollections()) {
        await exportCollection(nestedCollection, pathValue);
      }
    }
  }

  for (const collectionName of requiredCollections) {
    await exportCollection(db.collection(collectionName));
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify({ exportedAt: new Date().toISOString(), documents }, null, 2));
  console.log(`Exported ${documents.length} documents to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
