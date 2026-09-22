import * as SQLite from 'expo-sqlite';

const DB_NAME = 'nardeli_offline.db';

let dbPromise = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS offline_cache (
  cache_key         TEXT PRIMARY KEY,
  url               TEXT NOT NULL,
  entity_type       TEXT,
  entity_id         TEXT,
  response_json     TEXT NOT NULL,
  updated_at_remote TEXT,
  fetched_at        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cache_entity ON offline_cache(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS offline_queue (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at         INTEGER NOT NULL,
  method             TEXT NOT NULL,
  url                TEXT NOT NULL,
  body_json          TEXT,
  entity_type        TEXT NOT NULL,
  entity_id          TEXT NOT NULL,
  base_updated_at    TEXT,
  status             TEXT NOT NULL DEFAULT 'pending',
  attempt_count      INTEGER NOT NULL DEFAULT 0,
  last_error         TEXT,
  client_op_id       TEXT NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS idx_queue_entity ON offline_queue(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_queue_status ON offline_queue(status);

CREATE TABLE IF NOT EXISTS offline_conflicts (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  queue_id               INTEGER NOT NULL,
  entity_type            TEXT NOT NULL,
  entity_id              TEXT NOT NULL,
  local_payload_json     TEXT NOT NULL,
  server_payload_json    TEXT,
  local_base_updated_at  TEXT,
  server_updated_at      TEXT,
  detected_at            INTEGER NOT NULL,
  resolution             TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS idx_conflicts_resolution ON offline_conflicts(resolution);
`;

// Abre (o reutiliza) la conexión a la base offline. Idempotente: llamar
// varias veces desde distintos módulos siempre resuelve a la misma conexión.
export function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
      await db.execAsync('PRAGMA journal_mode = WAL;');
      await db.execAsync(SCHEMA);
      return db;
    });
  }
  return dbPromise;
}
