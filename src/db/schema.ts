/**
 * Local SQLite schema (executed against an SQLCipher-encrypted DB).
 *
 * Privacy-by-design: we persist EMBEDDINGS (float32 BLOB) and attendance
 * metadata, NEVER face images. Attendance rows are PURGED after a confirmed
 * server ACK (Phase 5 sync-and-purge).
 */
export const CREATE_TABLES: string[] = [
  `CREATE TABLE IF NOT EXISTS enrollments (
     id            TEXT PRIMARY KEY NOT NULL,
     person_id     TEXT NOT NULL,
     display_name  TEXT NOT NULL,
     embedding     BLOB NOT NULL,        -- float32[192] — a math vector, not an image
     model_version TEXT NOT NULL,
     created_at    INTEGER NOT NULL
   );`,

  `CREATE TABLE IF NOT EXISTS attendance_queue (
     id               TEXT PRIMARY KEY NOT NULL,  -- also the sync idempotency key
     person_id        TEXT NOT NULL,
     device_id        TEXT NOT NULL,
     captured_at      INTEGER NOT NULL,
     latitude         REAL,
     longitude        REAL,
     liveness_passed  INTEGER NOT NULL,            -- 0 / 1
     anti_spoof_score REAL,
     match_score      REAL,
     synced           INTEGER NOT NULL DEFAULT 0,  -- 0 / 1
     created_at       INTEGER NOT NULL
   );`,

  // Fast lookup of rows still awaiting sync (drives sync-and-purge).
  `CREATE INDEX IF NOT EXISTS idx_attendance_unsynced
     ON attendance_queue (synced);`,

  // Small key/value table for sync bookkeeping that must survive purges:
  // device_id, lifetime synced_total, last_sync_at.
  `CREATE TABLE IF NOT EXISTS sync_meta (
     key   TEXT PRIMARY KEY NOT NULL,
     value TEXT NOT NULL
   );`,
];
