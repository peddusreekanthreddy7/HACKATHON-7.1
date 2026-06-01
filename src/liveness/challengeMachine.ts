import type { LivenessConfig } from './config';
import type {
  ChallengeType,
  LivenessFrame,
  LivenessState,
} from './types';

/**
 * Pure, deterministic liveness state machine.
 *
 * Flow:  antispoof gate  →  challenge 1  →  challenge 2  →  passed
 *                    │              │              │
 *                    └─ spoof ──────┴─ timeout ────┴──────────────→ failed
 *
 * The passive anti-spoof model MUST clear the gate before any active challenge
 * runs, and BOTH challenges must succeed — so liveness passes only when passive
 * AND active both succeed. Runs on the JS thread; `frame.now` is JS time.
 */

const ALL_CHALLENGES: ChallengeType[] = ['blink', 'smile', 'turnLeft', 'turnRight'];

/** Pick `count` distinct challenges. RNG is injected (Math.random in app, seeded in tests). */
export function pickChallenges(rng: () => number, count: number): ChallengeType[] {
  const pool = ALL_CHALLENGES.slice();
  const chosen: ChallengeType[] = [];
  while (chosen.length < count && pool.length > 0) {
    const i = Math.floor(rng() * pool.length);
    chosen.push(pool.splice(i, 1)[0]);
  }
  return chosen;
}

export function initLiveness(challenges: ChallengeType[]): LivenessState {
  return {
    phase: 'antispoof',
    challenges: challenges.map(type => ({ type, status: 'pending', startedAt: null })),
    currentIndex: 0,
    antiSpoofFrames: 0,
    blinkClosed: false,
    smileHeldSince: null,
    reason: null,
  };
}

function startChallenge(state: LivenessState, index: number, now: number): LivenessState {
  return {
    ...state,
    phase: 'running',
    currentIndex: index,
    challenges: state.challenges.map((c, i) =>
      i === index ? { ...c, status: 'active', startedAt: now } : c,
    ),
    blinkClosed: false,
    smileHeldSince: null,
  };
}

function passCurrent(state: LivenessState, now: number): LivenessState {
  const idx = state.currentIndex;
  const challenges = state.challenges.map((c, i) =>
    i === idx ? { ...c, status: 'passed' as const } : c,
  );
  const next = idx + 1;
  if (next >= challenges.length) {
    return { ...state, challenges, phase: 'passed', reason: 'all-passed' };
  }
  return startChallenge({ ...state, challenges }, next, now);
}

function fail(state: LivenessState, reason: string): LivenessState {
  const challenges = state.challenges.map((c, i) =>
    i === state.currentIndex && c.status === 'active'
      ? { ...c, status: 'failed' as const }
      : c,
  );
  return { ...state, challenges, phase: 'failed', reason };
}

export function advanceLiveness(
  state: LivenessState,
  frame: LivenessFrame,
  config: LivenessConfig,
): LivenessState {
  if (state.phase === 'passed' || state.phase === 'failed') return state;

  // ---- Passive anti-spoof gate (runs BEFORE any challenge) ----
  if (state.phase === 'antispoof') {
    if (!config.antiSpoof.required) {
      return startChallenge(state, 0, frame.now);
    }
    if (frame.antiSpoofReal === false) {
      return fail(state, 'spoof-detected'); // photo/screen rejected up front
    }
    if (frame.antiSpoofReal === null) {
      return state; // model unavailable → cannot verify → wait (fail-closed)
    }
    const antiSpoofFrames = state.antiSpoofFrames + 1;
    if (antiSpoofFrames >= config.antiSpoof.requiredFrames) {
      return startChallenge({ ...state, antiSpoofFrames }, 0, frame.now);
    }
    return { ...state, antiSpoofFrames };
  }

  // ---- Active challenge in progress ----
  const current = state.challenges[state.currentIndex];

  if (current.startedAt != null && frame.now - current.startedAt > config.challengeTimeoutMs) {
    return fail(state, `timeout:${current.type}`);
  }

  switch (current.type) {
    case 'blink': {
      let blinkClosed = state.blinkClosed;
      if (frame.ear < config.ear.closed) blinkClosed = true;
      if (blinkClosed && frame.ear > config.ear.open) {
        return passCurrent({ ...state, blinkClosed: false }, frame.now);
      }
      return { ...state, blinkClosed };
    }
    case 'smile': {
      if (frame.smileRatio >= config.smile.ratioThreshold) {
        const since = state.smileHeldSince ?? frame.now;
        if (frame.now - since >= config.smile.holdMs) {
          return passCurrent({ ...state, smileHeldSince: null }, frame.now);
        }
        return { ...state, smileHeldSince: since };
      }
      return { ...state, smileHeldSince: null };
    }
    case 'turnLeft': {
      const yaw = config.yaw.invert ? -frame.yawDeg : frame.yawDeg;
      if (yaw <= -config.yaw.turnDegrees) return passCurrent(state, frame.now);
      return state;
    }
    case 'turnRight': {
      const yaw = config.yaw.invert ? -frame.yawDeg : frame.yawDeg;
      if (yaw >= config.yaw.turnDegrees) return passCurrent(state, frame.now);
      return state;
    }
    default:
      return state;
  }
}
