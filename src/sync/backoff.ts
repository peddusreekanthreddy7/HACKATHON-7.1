/**
 * Exponential backoff with full jitter (the AWS-recommended strategy).
 *
 *   delay = random(0, min(maxMs, baseMs * 2^attempt))
 *
 * `attempt` is 0-based (0 = the delay before the first retry). Full jitter
 * spreads retries across the window so a fleet of devices reconnecting after an
 * outage doesn't thundering-herd the endpoint.
 */
export function computeBackoff(
  attempt: number,
  baseMs: number,
  maxMs: number,
  rng: () => number = Math.random,
): number {
  const ceiling = Math.min(maxMs, baseMs * Math.pow(2, attempt));
  return Math.floor(rng() * ceiling);
}
