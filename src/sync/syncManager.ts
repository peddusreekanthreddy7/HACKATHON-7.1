import { getDb } from '../db';
import { syncAll } from './syncService';
import { DEFAULT_SYNC_CONFIG } from './config';
import type { PushDeps, SyncConfig, SyncSummary } from './types';

// Dev-only DB key — Phase 6 replaces with a device-Keystore-derived secret.
const DEV_KEY = 'dev-placeholder-key-phase5-will-rotate';

/**
 * App-level one-call sync-and-purge (hard constraint #8):
 *   1. Read unsynced rows from attendance_queue.
 *   2. POST each to the endpoint with retry/backoff + idempotency key.
 *   3. On a 200 ACK, mark synced + DELETE locally (purge).
 *   4. Never delete an unconfirmed row — no data loss, no orphan PII.
 */
export async function runSync(
  config: SyncConfig = DEFAULT_SYNC_CONFIG,
  deps: PushDeps = {},
): Promise<SyncSummary> {
  return syncAll(getDb(DEV_KEY), config, deps);
}
