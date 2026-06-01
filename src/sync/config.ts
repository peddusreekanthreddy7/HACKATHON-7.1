import type { SyncConfig } from './types';

/**
 * Default sync configuration — all values tunable.
 *
 * endpointUrl: point at the local mock server during development
 *   (`node mock-server/server.mjs`, default port 8787). From the Android
 *   emulator the host machine is reachable at 10.0.2.2; on a physical device
 *   use your machine's LAN IP. Swap for the real API Gateway URL in production.
 */
export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  endpointUrl: 'http://10.0.2.2:8787/attendance',
  maxRetries: 5,
  baseDelayMs: 500,
  maxDelayMs: 30000,
  timeoutMs: 10000,
};
