/** The wire payload pushed to the server (mirrors a local attendance row). */
export interface AttendancePayload {
  id: string; // also the Idempotency-Key
  personId: string;
  deviceId: string;
  capturedAt: number;
  latitude: number | null;
  longitude: number | null;
  livenessPassed: boolean;
  antiSpoofScore: number | null;
  matchScore: number | null;
}

/** Server acknowledgement of a single record. */
export interface SyncAck {
  ok: boolean;
  id: string;
  /** True when the server already had this id (idempotent replay). */
  duplicate: boolean;
}

export interface SyncConfig {
  /** POST endpoint. Android emulator → host = http://10.0.2.2:PORT. */
  endpointUrl: string;
  /** Max RETRIES after the first attempt (so total tries = maxRetries + 1). */
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  /** Per-request abort timeout. */
  timeoutMs: number;
}

export interface SyncSummary {
  attempted: number;
  synced: number;
  failed: number;
}

/** Injectable dependencies (so the retry/backoff loop is unit-testable). */
export interface PushDeps {
  fetchFn?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  rng?: () => number;
}
