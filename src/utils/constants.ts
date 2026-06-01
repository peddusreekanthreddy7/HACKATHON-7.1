/** App-wide constants tied directly to the hackathon hard constraints. */
export const APP_NAME = 'DatalakeFaceAuth';

/**
 * Face embedding dimensionality. The bundled MobileFaceNet (MCarlomagno,
 * Apache-2.0) outputs 192-D — a standard MobileFaceNet embedding size.
 * (The brief suggested 512-D; 192-D is what this real, downloadable model
 * produces. Cosine matching is dimension-agnostic.)
 */
export const EMBEDDING_DIM = 192;

/** Hard constraint #2 — total bundled model footprint must stay at/under this. */
export const MODEL_FOOTPRINT_BUDGET_MB = 20;

/** Hard constraint #3 — passive recognition+liveness wall-clock budget. */
export const TARGET_E2E_LATENCY_MS = 1000;

/** BlazeFace short-range input side length. */
export const DETECTOR_INPUT_SIZE = 128;

/** Detection runs at most this many times/sec (throttle for 3 GB devices). */
export const DETECTOR_TARGET_FPS = 8;

/** AWS DynamoDB/S3 table + bucket names (placeholders; finalised in Phase 6). */
export const SYNC_TABLE = 'datalake-attendance';
