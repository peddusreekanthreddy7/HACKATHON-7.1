/**
 * ID helpers. Used for attendance record IDs (which double as sync idempotency
 * keys) and the per-install device ID.
 *
 * Note: Math.random is sufficient here — collision risk of a 8-char base36
 * suffix combined with a millisecond timestamp is negligible for attendance
 * volumes. Swap to expo-crypto/getRandomValues if a cryptographic guarantee is
 * ever required.
 */
export function randomId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${rand}`;
}

export function randomDeviceId(): string {
  const rand =
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 6);
  return `dev-${rand}`;
}
