import type { DB } from '@op-engineering/op-sqlite';
import { getUnsynced, purgeSynced } from '../db/attendance';
import { pushRecord, recordToPayload } from './pushRecord';
import type { PushDeps, SyncConfig, SyncSummary } from './types';

/**
 * Sync-and-purge: push every unsynced record, and PURGE each one locally ONLY
 * after the server confirms receipt (200 + ack). A failed push leaves the row
 * untouched so it is retried on the next run — no data loss, no duplicates
 * (idempotency key), no orphaned PII (purge on ack).
 */
export async function syncAll(
  db: DB,
  config: SyncConfig,
  deps: PushDeps = {},
): Promise<SyncSummary> {
  const pending = getUnsynced(db);
  let synced = 0;
  let failed = 0;

  for (const rec of pending) {
    try {
      const ack = await pushRecord(recordToPayload(rec), config, deps);
      if (ack.ok) {
        purgeSynced(db, rec.id); // ← purge happens ONLY here, after the ACK
        synced++;
      } else {
        failed++;
      }
    } catch {
      failed++; // keep the row; it retries next time
    }
  }

  return { attempted: pending.length, synced, failed };
}
