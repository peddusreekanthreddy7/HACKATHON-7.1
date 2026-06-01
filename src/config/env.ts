/**
 * Centralised, typed configuration.
 *
 * SECRETS (AWS endpoint, API keys) MUST come from the environment — never
 * hardcode them. A native runtime-env mechanism (react-native-config) is wired
 * in Phase 6; until then these read from build-time `process.env` where Metro
 * inlines it, and fall back to safe, non-secret defaults.
 */
export interface AppConfig {
  /** Base URL of the AWS API Gateway sync endpoint. `null` until configured. */
  awsApiBaseUrl: string | null;
  awsRegion: string;
  /** Cosine-similarity threshold for a positive face match (tuned in Phase 3/7). */
  faceMatchThreshold: number;
  /** Require an active liveness challenge before accepting attendance. */
  livenessRequired: boolean;
  /** Require the passive (texture) anti-spoof check to pass. */
  passiveAntiSpoofRequired: boolean;
  /** Hard constraint #2 — total on-device model footprint budget. */
  modelFootprintBudgetMb: number;
}

// Read build-time env without referencing the bare `process` global (which
// isn't typed in React Native without @types/node). Metro inlines process.env.
type ProcessEnv = Record<string, string | undefined>;
const env: ProcessEnv =
  (globalThis as { process?: { env?: ProcessEnv } }).process?.env ?? {};

export const config: AppConfig = {
  awsApiBaseUrl: env.AWS_API_BASE_URL ?? null,
  awsRegion: env.AWS_REGION ?? 'ap-south-1', // Mumbai — lowest latency for India
  faceMatchThreshold: Number(env.FACE_MATCH_THRESHOLD ?? 0.5),
  livenessRequired: true,
  passiveAntiSpoofRequired: true,
  modelFootprintBudgetMb: 20,
};
