import { create } from 'zustand';

/**
 * Debug / calibration settings store (Admin → Debug Panel).
 *
 * NEW, additive store — it does NOT modify any existing screen or service.
 * It holds tunable thresholds plus the most-recent measured values so the
 * Debug Panel can display them. The Debug Panel's own "Test Recognition Score"
 * tool reads `similarityThreshold` live for calibration.
 *
 * NOTE: to also drive the LIVE AttendanceScreen recognition/liveness from these
 * sliders, `useRecognition`/`useLiveness` would need to read this store — that
 * is intentionally NOT wired here to honour the "don't change other services"
 * constraint. See the Debug Panel findings.
 */
export interface DebugSettings {
  /** Cosine-similarity match threshold. Range 0.30–0.70 (default 0.40). */
  similarityThreshold: number;
  /** Head-turn yaw threshold in degrees. Range 8–25 (default 12). */
  yawThresholdDeg: number;
  /** Per-challenge timeout in ms. Range 3000–10000 (default 8000). */
  challengeTimeoutMs: number;
}

export const DEBUG_DEFAULTS: DebugSettings = {
  similarityThreshold: 0.4,
  yawThresholdDeg: 12,
  challengeTimeoutMs: 8000,
};

interface DebugState extends DebugSettings {
  /** Last raw cosine score measured by the Test Recognition tool (or null). */
  lastScore: number | null;
  /** Last liveness pass/fail observed (or null if none recorded). */
  lastLivenessPassed: boolean | null;
  /** Last challenge type observed (blink/smile/turnLeft/turnRight or null). */
  lastChallengeType: string | null;

  setSimilarityThreshold: (v: number) => void;
  setYawThresholdDeg: (v: number) => void;
  setChallengeTimeoutMs: (v: number) => void;
  setLastScore: (v: number) => void;
  setLastLiveness: (passed: boolean | null, challenge: string | null) => void;
  resetSettings: () => void;
}

export const useDebugStore = create<DebugState>(set => ({
  ...DEBUG_DEFAULTS,
  lastScore: null,
  lastLivenessPassed: null,
  lastChallengeType: null,

  setSimilarityThreshold: v => set({ similarityThreshold: v }),
  setYawThresholdDeg: v => set({ yawThresholdDeg: v }),
  setChallengeTimeoutMs: v => set({ challengeTimeoutMs: v }),
  setLastScore: v => set({ lastScore: v }),
  setLastLiveness: (passed, challenge) =>
    set({ lastLivenessPassed: passed, lastChallengeType: challenge }),
  resetSettings: () => set({ ...DEBUG_DEFAULTS }),
}));
