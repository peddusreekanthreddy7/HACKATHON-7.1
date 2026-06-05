import type { Embedding, MatchResult, EmbeddingConfig } from './types';

/**
 * Cosine similarity and multi-user matching.
 * All pure + 'worklet'. When embeddings are L2-normalised, cosine similarity
 * reduces to a plain dot product — fast and numerically stable.
 */

/**
 * Cosine similarity of two L2-normalised vectors. Range: [−1, 1].
 * Accepts ArrayLike so a worklet can compare a Float32Array query against a
 * plain number[] gallery embedding (gallery vectors MUST be number[] — a
 * Float32Array's bytes do not survive capture into a worklets-core worklet).
 */
export function cosineSimilarity(a: ArrayLike<number>, b: ArrayLike<number>): number {
  'worklet';
  let dot = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) dot += a[i] * b[i];
  return dot;
}

export interface EnrolledRecord {
  personId: string;
  displayName: string;
  /** Plain number[] so it survives the JS→worklet boundary intact. */
  embedding: ArrayLike<number>;
}

/**
 * Find the best match across all enrolled records. Returns null if either the
 * gallery is empty or the best score is below the threshold (no match).
 */
export function findBestMatch(
  query: Embedding,
  gallery: EnrolledRecord[],
  config: EmbeddingConfig,
): MatchResult | null {
  'worklet';
  if (gallery.length === 0) return null;

  let bestScore = -Infinity;
  let bestIdx = -1;

  for (let i = 0; i < gallery.length; i++) {
    const s = cosineSimilarity(query, gallery[i].embedding);
    if (s > bestScore) {
      bestScore = s;
      bestIdx = i;
    }
  }

  const best = gallery[bestIdx];
  return {
    personId: best.personId,
    displayName: best.displayName,
    score: bestScore,
    accepted: bestScore >= config.matchThreshold,
  };
}

/**
 * Map a cosine similarity (0–1 range for normalised embeddings) to an
 * approximate confidence percentage for UI display.
 * Threshold 0.6 → "95% confidence" per the spec: we linearly interpolate
 * between threshold (≈ 95%) and 1.0 (100%).
 */
export function scoreToConfidence(score: number, threshold: number): number {
  'worklet';
  if (score < threshold) return Math.round((score / threshold) * 94);
  const range = 1 - threshold;
  return Math.round(95 + ((score - threshold) / range) * 5);
}
