PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS documents (
  path TEXT PRIMARY KEY,
  collection_name TEXT NOT NULL,
  doc_id TEXT NOT NULL,
  parent_path TEXT,
  owner_id TEXT,
  created_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  payload TEXT NOT NULL CHECK (json_valid(payload))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_collection_doc_parent
  ON documents (collection_name, doc_id, ifnull(parent_path, ''));

CREATE INDEX IF NOT EXISTS idx_documents_collection_created
  ON documents (collection_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_documents_parent_collection_created
  ON documents (parent_path, collection_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_documents_owner_collection_created
  ON documents (owner_id, collection_name, created_at DESC);

CREATE TABLE IF NOT EXISTS migration_runs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  details TEXT NOT NULL CHECK (json_valid(details))
);
