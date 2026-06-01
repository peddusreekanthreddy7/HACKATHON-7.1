export type ChallengeType = 'blink' | 'smile' | 'turnLeft' | 'turnRight';

export type ChallengeStatus = 'pending' | 'active' | 'passed' | 'failed';

export type LivenessPhase = 'antispoof' | 'running' | 'passed' | 'failed';

export interface ChallengeState {
  type: ChallengeType;
  status: ChallengeStatus;
  startedAt: number | null;
}

export interface LivenessState {
  phase: LivenessPhase;
  challenges: ChallengeState[];
  currentIndex: number;
  /** Consecutive "real" frames accumulated during the anti-spoof gate. */
  antiSpoofFrames: number;
  /** Blink sub-state: have we seen the eyes close yet this challenge? */
  blinkClosed: boolean;
  /** Smile sub-state: when the smile started being held (epoch ms) or null. */
  smileHeldSince: number | null;
  /** Human-readable terminal reason (for UI / logging). */
  reason: string | null;
}

/** Per-frame measurements fed into the FSM. `now` is stamped on the JS thread. */
export interface LivenessFrame {
  now: number;
  facePresent: boolean;
  ear: number;
  smileRatio: number;
  yawDeg: number;
  /** Passive verdict: true=real, false=spoof, null=model unavailable/not scored. */
  antiSpoofReal: boolean | null;
}

/** Prompt text shown to the operator for each challenge. */
export const CHALLENGE_PROMPT: Record<ChallengeType, string> = {
  blink: 'Blink your eyes',
  smile: 'Smile',
  turnLeft: 'Turn your head left',
  turnRight: 'Turn your head right',
};
