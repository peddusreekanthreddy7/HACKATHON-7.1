export interface AntiSpoofResult {
  /** True when the texture model judges the face as a live, real person. */
  real: boolean;
  /** Probability assigned to the "real/live" class, 0–1. */
  realScore: number;
}

export interface AntiSpoofConfig {
  /** Output class index that means "real/live" (MiniFASNet/Silent-Face = 1). */
  realClassIndex: number;
  /** Minimum real-class probability to accept as live. */
  realThreshold: number;
}
