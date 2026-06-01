import {
  pickChallenges,
  initLiveness,
  advanceLiveness,
} from '../src/liveness/challengeMachine';
import { DEFAULT_LIVENESS_CONFIG } from '../src/liveness/config';
import type { LivenessFrame, LivenessState } from '../src/liveness/types';

const cfg = DEFAULT_LIVENESS_CONFIG;

function frame(p: Partial<LivenessFrame> = {}): LivenessFrame {
  return {
    now: 1000,
    facePresent: true,
    ear: 0.3,
    smileRatio: 0.4,
    yawDeg: 0,
    antiSpoofReal: true,
    ...p,
  };
}

function clearGate(state: LivenessState): LivenessState {
  for (let i = 0; i < cfg.antiSpoof.requiredFrames; i++) {
    state = advanceLiveness(state, frame({ now: 1000 + i * 50, antiSpoofReal: true }), cfg);
  }
  return state;
}

describe('pickChallenges', () => {
  it('returns the requested count of distinct challenges', () => {
    const c = pickChallenges(() => 0, 2);
    expect(c).toHaveLength(2);
    expect(new Set(c).size).toBe(2);
  });
});

describe('passive anti-spoof gate', () => {
  it('rejects a detected spoof immediately', () => {
    const s = advanceLiveness(
      initLiveness(['blink', 'smile']),
      frame({ antiSpoofReal: false }),
      cfg,
    );
    expect(s.phase).toBe('failed');
    expect(s.reason).toBe('spoof-detected');
  });

  it('fails closed (waits) when the model is unavailable', () => {
    const s = advanceLiveness(
      initLiveness(['blink', 'smile']),
      frame({ antiSpoofReal: null }),
      cfg,
    );
    expect(s.phase).toBe('antispoof');
  });

  it('opens the first challenge only after enough real frames', () => {
    const s = clearGate(initLiveness(['blink', 'turnRight']));
    expect(s.phase).toBe('running');
    expect(s.challenges[0].status).toBe('active');
  });
});

describe('full liveness pass (passive AND active)', () => {
  it('passes after anti-spoof + blink + right-turn', () => {
    let s = clearGate(initLiveness(['blink', 'turnRight']));
    let t = 2000;
    s = advanceLiveness(s, frame({ now: t, ear: 0.1 }), cfg); // eyes close
    t += 50;
    s = advanceLiveness(s, frame({ now: t, ear: 0.35 }), cfg); // eyes reopen → blink done
    expect(s.challenges[0].status).toBe('passed');
    expect(s.currentIndex).toBe(1);

    t += 50;
    s = advanceLiveness(s, frame({ now: t, yawDeg: 30 }), cfg); // turn right
    expect(s.phase).toBe('passed');
  });
});

describe('challenge timeout', () => {
  it('fails when a challenge exceeds its time limit', () => {
    let s = clearGate(initLiveness(['blink', 'smile']));
    const startedAt = s.challenges[0].startedAt as number;
    s = advanceLiveness(
      s,
      frame({ now: startedAt + cfg.challengeTimeoutMs + 1, ear: 0.3 }),
      cfg,
    );
    expect(s.phase).toBe('failed');
    expect(s.reason).toContain('timeout');
  });
});
