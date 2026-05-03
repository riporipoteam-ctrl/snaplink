# SnapLink Cloudflare Migration

This folder is the Cloudflare destination for SnapLink data.

What is ready:

- D1 database name: `snaplink`
- D1 database id: `075c5530-7af3-46e0-80a9-51f60c51a79a`
- Worker name in `wrangler.toml`: `snaplink-data`
- Generic document schema in `schema/0001_documents.sql`
- Worker API shell in `src/index.ts`

Why the schema is generic:

- SnapLink currently stores a large number of Firebase collections and subcollections.
- A generic `documents` table preserves the original Firestore-style paths so we can move data first and normalize later.

Current blocker for a full live migration:

- This workspace does not contain a Firebase Admin service account or another server-side credential that can read the full dataset safely.
- Cloudflare R2 is not enabled on the account yet, so media cannot be moved to Cloudflare storage yet.

Next step once credentials exist:

1. Export Firebase data with `scripts/cloudflare/export-firestore.mjs`
2. Import the generated JSON into D1 with `scripts/cloudflare/import-json-to-d1.mjs`
3. Enable R2 in Cloudflare Dashboard and move media after that
