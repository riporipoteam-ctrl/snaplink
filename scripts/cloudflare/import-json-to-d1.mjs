import fs from 'node:fs/promises';
import path from 'node:path';

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID || '075c5530-7af3-46e0-80a9-51f60c51a79a';
const inputPath = process.env.SNAPLINK_FIRESTORE_EXPORT_PATH || path.resolve('cloudflare', 'tmp', 'firestore-export.json');

if (!accountId || !apiToken) {
  console.error('Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN before importing into D1.');
  process.exit(1);
}

async function queryD1(sql, params = []) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql, params }),
  });

  const payload = await response.json();
  if (!response.ok || payload.success === false) {
    throw new Error(`D1 query failed: ${JSON.stringify(payload)}`);
  }
  return payload;
}

async function main() {
  const parsed = JSON.parse(await fs.readFile(inputPath, 'utf8'));
  const documents = parsed.documents || [];

  for (const documentEntry of documents) {
    await queryD1(
      `INSERT INTO documents (path, collection_name, doc_id, parent_path, owner_id, created_at, updated_at, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(path) DO UPDATE SET
         collection_name = excluded.collection_name,
         doc_id = excluded.doc_id,
         parent_path = excluded.parent_path,
         owner_id = excluded.owner_id,
         created_at = coalesce(documents.created_at, excluded.created_at),
         updated_at = excluded.updated_at,
         payload = excluded.payload`,
      [
        documentEntry.path,
        documentEntry.collectionName,
        documentEntry.docId,
        documentEntry.parentPath || null,
        documentEntry.ownerId || null,
        documentEntry.createdAt || null,
        new Date().toISOString(),
        JSON.stringify(documentEntry.payload),
      ]
    );
  }

  console.log(`Imported ${documents.length} documents into D1 ${databaseId}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
