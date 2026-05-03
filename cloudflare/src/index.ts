interface D1PreparedStatement {
  bind(...values: Array<string | number | null>): D1PreparedStatement;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

export interface Env {
  SNAPLINK_DB: D1Database;
}

interface QueryRequest {
  collection?: string;
  parentPath?: string | null;
  ownerId?: string | null;
  limit?: number;
}

interface UpsertRequest {
  path?: string;
  collectionName?: string;
  docId?: string;
  parentPath?: string | null;
  ownerId?: string | null;
  createdAt?: string | null;
  payload?: unknown;
}

function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('access-control-allow-origin', '*');
  headers.set('access-control-allow-methods', 'GET,POST,DELETE,OPTIONS');
  headers.set('access-control-allow-headers', 'content-type,authorization');
  return new Response(JSON.stringify(data), { ...init, headers });
}

function getOwnerId(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  const possibleKeys = ['authorId', 'creatorId', 'userId', 'uid', 'targetUserId'];
  for (const key of possibleKeys) {
    const value = record[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return null;
}

async function queryDocuments(env: Env, body: QueryRequest) {
  const limit = Math.max(1, Math.min(100, body.limit ?? 25));
  const filters: string[] = [];
  const params: Array<string | number | null> = [];

  if (body.collection) {
    filters.push('collection_name = ?');
    params.push(body.collection);
  }
  if (body.parentPath !== undefined) {
    if (body.parentPath === null) {
      filters.push('parent_path IS NULL');
    } else {
      filters.push('parent_path = ?');
      params.push(body.parentPath);
    }
  }
  if (body.ownerId) {
    filters.push('owner_id = ?');
    params.push(body.ownerId);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const statement = env.SNAPLINK_DB.prepare(
    `SELECT path, collection_name, doc_id, parent_path, owner_id, created_at, updated_at, payload
     FROM documents
     ${whereClause}
     ORDER BY created_at DESC, updated_at DESC
     LIMIT ?`
  ).bind(...params, limit);

  const { results } = await statement.all<Record<string, unknown>>();
  return results.map((row) => ({
    ...row,
    payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
  }));
}

async function upsertDocument(env: Env, body: UpsertRequest) {
  if (!body.path || !body.collectionName || !body.docId || body.payload === undefined) {
    return json({ error: 'path, collectionName, docId, and payload are required.' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const payloadJson = JSON.stringify(body.payload);
  const ownerId = body.ownerId ?? getOwnerId(body.payload);
  await env.SNAPLINK_DB.prepare(
    `INSERT INTO documents (path, collection_name, doc_id, parent_path, owner_id, created_at, updated_at, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(path) DO UPDATE SET
       collection_name = excluded.collection_name,
       doc_id = excluded.doc_id,
       parent_path = excluded.parent_path,
       owner_id = excluded.owner_id,
       created_at = coalesce(documents.created_at, excluded.created_at),
       updated_at = excluded.updated_at,
       payload = excluded.payload`
  )
    .bind(
      body.path,
      body.collectionName,
      body.docId,
      body.parentPath ?? null,
      ownerId,
      body.createdAt ?? now,
      now,
      payloadJson
    )
    .run();

  return json({ ok: true, path: body.path });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return json({ ok: true });
    }

    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
      const probe = await env.SNAPLINK_DB.prepare('SELECT COUNT(*) AS total FROM documents').first<{ total: number }>();
      return json({
        ok: true,
        service: 'snaplink-data',
        totalDocuments: probe?.total ?? 0,
        now: new Date().toISOString(),
      });
    }

    if (request.method === 'POST' && url.pathname === '/documents/query') {
      const body = (await request.json()) as QueryRequest;
      return json({ items: await queryDocuments(env, body) });
    }

    if (request.method === 'POST' && url.pathname === '/documents/upsert') {
      const body = (await request.json()) as UpsertRequest;
      return upsertDocument(env, body);
    }

    if (request.method === 'GET' && url.pathname === '/documents/get') {
      const path = url.searchParams.get('path');
      if (!path) {
        return json({ error: 'path is required.' }, { status: 400 });
      }

      const row = await env.SNAPLINK_DB.prepare(
        `SELECT path, collection_name, doc_id, parent_path, owner_id, created_at, updated_at, payload
         FROM documents WHERE path = ?`
      )
        .bind(path)
        .first<Record<string, unknown>>();

      if (!row) {
        return json({ error: 'Not found.' }, { status: 404 });
      }

      return json({
        ...row,
        payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
      });
    }

    if (request.method === 'DELETE' && url.pathname === '/documents/delete') {
      const path = url.searchParams.get('path');
      if (!path) {
        return json({ error: 'path is required.' }, { status: 400 });
      }
      await env.SNAPLINK_DB.prepare('DELETE FROM documents WHERE path = ?').bind(path).run();
      return json({ ok: true, path });
    }

    return json({ error: 'Not found.' }, { status: 404 });
  },
};
