import type { DB } from '@op-engineering/op-sqlite';
import { randomId, randomDeviceId } from '../utils/ids';

/** A row in the local attendance queue (mirrors the sync payload). */
export interface AttendanceRecord {
  id: string;
  personId: string;
  deviceId: string;
  capturedAt: number;
  latitude: number | null;
  longitude: number | null;
  livenessPassed: boolean;
  antiSpoofScore: number | null;
  matchScore: number | null;
  synced: boolean;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// sync_meta helpers (device id + lifetime counters survive record purges)
// ---------------------------------------------------------------------------

function getMeta(db: DB, key: string): string | null {
  const r = db.executeSync('SELECT value FROM sync_meta WHERE key = ?', [key]);
  const v = r.rows[0]?.value;
  return v == null ? null : String(v);
}

function setMeta(db: DB, key: string, value: string): void {
  db.executeSync(
    'INSERT INTO sync_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  );
}

/** Get the stable per-install device id, creating it on first use. */
export function getDeviceId(db: DB): string {
  let id = getMeta(db, 'device_id');
  if (id == null) {
    id = randomDeviceId();
    setMeta(db, 'device_id', id);
  }
  return id;
}

export interface SyncMeta {
  syncedTotal: number;
  lastSyncAt: number | null;
}

export function getSyncMeta(db: DB): SyncMeta {
  const last = getMeta(db, 'last_sync_at');
  return {
    syncedTotal: Number(getMeta(db, 'synced_total') ?? '0'),
    lastSyncAt: last ? Number(last) : null,
  };
}

/** Increment the lifetime synced counter + stamp last_sync_at. */
export function bumpSyncedTotal(db: DB, by: number, at: number): void {
  const cur = Number(getMeta(db, 'synced_total') ?? '0');
  setMeta(db, 'synced_total', String(cur + by));
  setMeta(db, 'last_sync_at', String(at));
}

// ---------------------------------------------------------------------------
// Attendance records
// ---------------------------------------------------------------------------

export interface NewAttendanceInput {
  personId: string;
  livenessPassed: boolean;
  matchScore?: number | null;
  antiSpoofScore?: number | null;
  latitude?: number | null;
  longitude?: number | null;
}

/**
 * Record a successful verification. Generates the id (= idempotency key) and
 * resolves the device id. Returns the inserted row.
 */
export function recordAttendance(db: DB, input: NewAttendanceInput): AttendanceRecord {
  const now = Date.now();
  const rec: AttendanceRecord = {
    id: randomId('att'),
    personId: input.personId,
    deviceId: getDeviceId(db),
    capturedAt: now,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    livenessPassed: input.livenessPassed,
    antiSpoofScore: input.antiSpoofScore ?? null,
    matchScore: input.matchScore ?? null,
    synced: false,
    createdAt: now,
  };
  db.executeSync(
    `INSERT INTO attendance_queue
       (id, person_id, device_id, captured_at, latitude, longitude,
        liveness_passed, anti_spoof_score, match_score, synced, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [
      rec.id, rec.personId, rec.deviceId, rec.capturedAt,
      rec.latitude, rec.longitude,
      rec.livenessPassed ? 1 : 0, rec.antiSpoofScore, rec.matchScore,
      rec.createdAt,
    ],
  );
  return rec;
}

function rowToRecord(r: Record<string, unknown>): AttendanceRecord {
  return {
    id: String(r.id),
    personId: String(r.person_id),
    deviceId: String(r.device_id),
    capturedAt: Number(r.captured_at),
    latitude: r.latitude == null ? null : Number(r.latitude),
    longitude: r.longitude == null ? null : Number(r.longitude),
    livenessPassed: Number(r.liveness_passed) === 1,
    antiSpoofScore: r.anti_spoof_score == null ? null : Number(r.anti_spoof_score),
    matchScore: r.match_score == null ? null : Number(r.match_score),
    synced: Number(r.synced) === 1,
    createdAt: Number(r.created_at),
  };
}

/** Oldest-first list of records still awaiting sync. */
export function getUnsynced(db: DB, limit = 100): AttendanceRecord[] {
  const r = db.executeSync(
    'SELECT * FROM attendance_queue WHERE synced = 0 ORDER BY created_at ASC LIMIT ?',
    [limit],
  );
  return r.rows.map(rowToRecord);
}

export function countUnsynced(db: DB): number {
  const r = db.executeSync('SELECT COUNT(*) AS n FROM attendance_queue WHERE synced = 0');
  return Number(r.rows[0]?.n ?? 0);
}

/**
 * The purge step: a confirmed-synced record is DELETED locally (no orphaned
 * PII), and the lifetime synced counter is bumped.
 */
export function purgeSynced(db: DB, id: string): void {
  db.executeSync('DELETE FROM attendance_queue WHERE id = ?', [id]);
  bumpSyncedTotal(db, 1, Date.now());
}
