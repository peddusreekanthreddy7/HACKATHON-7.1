/**
 * All liveness thresholds in one place — every value is tunable (hard
 * requirement). Defaults are sensible starting points; the EAR/smile/yaw
 * thresholds in particular should be calibrated ON DEVICE per camera.
 */
export interface LivenessConfig {
  /** Blink: EAR drops below `closed`, then rises above `open`. */
  ear: { closed: number; open: number };
  /** Smile: lip-corner/eye-width ratio over `ratioThreshold`, held `holdMs`. */
  smile: { ratioThreshold: number; holdMs: number };
  /** Head turn: |yaw°| beyond `turnDegrees`. `invert` flips L/R for mirroring. */
  yaw: { turnDegrees: number; invert: boolean };
  /** Passive anti-spoof gate. */
  antiSpoof: {
    required: boolean;
    /** Consecutive "real" frames needed to clear the gate. */
    requiredFrames: number;
    /** Min real-class probability to count a frame as "real". */
    realThreshold: number;
    /** Output index of the real/live class (MiniFASNet/Silent-Face = 1). */
    realClassIndex: number;
  };
  /** Per-challenge time limit before it fails. */
  challengeTimeoutMs: number;
  /** How many random challenges to issue in sequence. */
  challengeCount: number;
  /** Scales converting the normalized pose proxy to approx degrees. */
  yawScale: number;
  pitchScale: number;
}

export const DEFAULT_LIVENESS_CONFIG: LivenessConfig = {
  ear: { closed: 0.18, open: 0.28 },
  smile: { ratioThreshold: 0.6, holdMs: 350 },
  yaw: { turnDegrees: 20, invert: false },
  antiSpoof: { required: true, requiredFrames: 5, realThreshold: 0.6, realClassIndex: 1 },
  challengeTimeoutMs: 7000,
  challengeCount: 2,
  yawScale: 90,
  pitchScale: 90,
};
