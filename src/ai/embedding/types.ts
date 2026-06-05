/** A 512-D face embedding (L2-normalised float32 vector). */
export type Embedding = Float32Array;

export interface MatchResult {
  /** person_id from the enrollment row. */
  personId: string;
  displayName: string;
  /** Cosine similarity score 0–1 (higher = more similar). */
  score: number;
  /** True if `score` exceeds the configured threshold. */
  accepted: boolean;
}

export interface EmbeddingConfig {
  /** Dimension of the embedding vector (must match the model). */
  dim: number;
  /**
   * INT8 dequantisation parameters (from the TFLite model's quantization
   * parameters). Ignored when the model outputs float32 directly.
   */
  int8: { scale: number; zeroPoint: number };
  /** Minimum cosine similarity to accept as a match (e.g. 0.6 for ~95% confidence). */
  matchThreshold: number;
}

export const DEFAULT_EMBEDDING_CONFIG: EmbeddingConfig = {
  dim: 192, // bundled MobileFaceNet outputs 192-D (see utils/constants EMBEDDING_DIM)
  // These quantization params are model-specific; calibrate from the real model.
  // For InsightFace/ArcFace INT8, typical scale ≈ 0.0078, zeroPoint ≈ 0.
  int8: { scale: 0.0078125, zeroPoint: 0 },
  matchThreshold: 0.4, // 0.40 — lowered from 0.6 to cut false "no match" (Fix A)
};
