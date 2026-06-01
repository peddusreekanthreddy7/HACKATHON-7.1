import { computeBackoff } from './backoff';
import type { AttendancePayload, PushDeps, SyncAck, SyncConfig } from './types';
import type { AttendanceRecord } from '../db/attendance';

/** A 4xx (non-429) response — the request will never succeed, so don't retry. */
export class PermanentSyncError extends Error {}

/** Strip local-only fields (synced, createdAt) to form the wire payload. */
export function recordToPayload(rec: AttendanceRecord): AttendancePayload {
  return {
    id: rec.id,
    personId: rec.personId,
    deviceId: rec.deviceId,
    capturedAt: rec.capturedAt,
    latitude: rec.latitude,
    longitude: rec.longitude,
    livenessPassed: rec.livenessPassed,
    antiSpoofScore: rec.antiSpoofScore,
    matchScore: rec.matchScore,
  };
}

/**
 * Push one record with retry + exponential backoff + an idempotency key.
 *
 * Retries on: network error, timeout, 5xx, 429.
 * Does NOT retry on: 4xx (except 429) — those are permanent and throw.
 * Returns the server ACK on a 200 {ok:true}. The idempotency key (the record
 * id) makes a replayed push safe: the server returns {duplicate:true}, still ok.
 */
export async function pushRecord(
  payload: AttendancePayload,
  config: SyncConfig,
  deps: PushDeps = {},
): Promise<SyncAck> {
  const fetchFn = deps.fetchFn ?? fetch;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>(r => setTimeout(r, ms)));
  const rng = deps.rng ?? Math.random;

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    if (attempt > 0) {
      await sleep(computeBackoff(attempt - 1, config.baseDelayMs, config.maxDelayMs, rng));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const res = await fetchFn(config.endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': payload.id,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (res.status === 200) {
        const ack = (await res.json()) as Partial<SyncAck>;
        if (ack && ack.ok) {
          return { ok: true, id: payload.id, duplicate: Boolean(ack.duplicate) };
        }
        throw new Error('200 response without ok ack');
      }

      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        throw new PermanentSyncError(`server responded ${res.status}`);
      }

      // 5xx or 429 → retryable.
      lastError = new Error(`server responded ${res.status}`);
    } catch (e) {
      if (e instanceof PermanentSyncError) throw e;
      lastError = e; // network / timeout / abort → retryable
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('sync failed');
}
