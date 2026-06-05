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

/**
 * Demo config: skips the passive anti-spoof gate so the challenges + recognition
 * work before the real MiniFASNet model is converted.
 * Use this in LivenessCamera/AttendanceScreen while minifasnet.tflite is still a
 * placeholder. Switch back to DEFAULT_LIVENESS_CONFIG once the model is real.
 */
export const DEMO_LIVENESS_CONFIG: LivenessConfig = {
  ear:   { closed: 0.22, open: 0.24 },   // easier blink: smaller gap needed
  smile: { ratioThreshold: 0.45, holdMs: 200 }, // easier smile: lower ratio, shorter hold
  yaw:   { turnDegrees: 12, invert: false },     // turn threshold 12° (Fix B)
  antiSpoof: { required: false, requiredFrames: 5, realThreshold: 0.6, realClassIndex: 1 },
  challengeTimeoutMs: 8000,   // 8s per challenge incl. turnLeft/turnRight (Fix B)
  challengeCount: 2,
  yawScale:   90,
  pitchScale: 90,
};

export const DEFAULT_LIVENESS_CONFIG: LivenessConfig = {
  ear: { closed: 0.18, open: 0.28 },
  smile: { ratioThreshold: 0.6, holdMs: 350 },
  yaw: { turnDegrees: 12, invert: false }, // 12° (Fix B)
  antiSpoof: { required: true, requiredFrames: 5, realThreshold: 0.6, realClassIndex: 1 },
  challengeTimeoutMs: 8000, // 8s per challenge incl. turnLeft/turnRight (Fix B)
  challengeCount: 2,
  yawScale: 90,
  pitchScale: 90,
};
