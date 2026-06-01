import {
  eyeAspectRatio,
  smileRatio,
  mouthAspectRatio,
  headYawNorm,
} from '../src/ai/facemesh/geometry';
import { LEFT_EYE_EAR, MOUTH, POSE } from '../src/ai/facemesh/landmarks';
import type { Landmark } from '../src/ai/facemesh/types';

function face(): Landmark[] {
  return Array.from({ length: 468 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
}
function put(lm: Landmark[], i: number, x: number, y: number) {
  lm[i] = { x, y, z: 0 };
}

function setEye(lm: Landmark[], idx: readonly number[], gap: number) {
  put(lm, idx[0], 0.0, 0.5); // p1 left corner
  put(lm, idx[3], 0.2, 0.5); // p4 right corner
  put(lm, idx[1], 0.07, 0.5 - gap); // p2 top
  put(lm, idx[2], 0.13, 0.5 - gap); // p3 top
  put(lm, idx[4], 0.13, 0.5 + gap); // p5 bottom
  put(lm, idx[5], 0.07, 0.5 + gap); // p6 bottom
}

describe('Eye Aspect Ratio (blink)', () => {
  it('is high for open eyes and near zero when closed', () => {
    const open = face();
    setEye(open, LEFT_EYE_EAR, 0.1);
    const closed = face();
    setEye(closed, LEFT_EYE_EAR, 0.0);

    const earOpen = eyeAspectRatio(open, LEFT_EYE_EAR);
    const earClosed = eyeAspectRatio(closed, LEFT_EYE_EAR);

    expect(earOpen).toBeGreaterThan(0.3);
    expect(earClosed).toBeLessThan(0.1);
    expect(earOpen).toBeGreaterThan(earClosed);
  });
});

describe('Smile (lip-corner / eye-width ratio)', () => {
  it('rises when the mouth widens', () => {
    const neutral = face();
    put(neutral, POSE.leftEyeOuter, 0.3, 0.4);
    put(neutral, POSE.rightEyeOuter, 0.7, 0.4);
    put(neutral, MOUTH.left, 0.42, 0.7);
    put(neutral, MOUTH.right, 0.58, 0.7);

    const smile = face();
    put(smile, POSE.leftEyeOuter, 0.3, 0.4);
    put(smile, POSE.rightEyeOuter, 0.7, 0.4);
    put(smile, MOUTH.left, 0.35, 0.7);
    put(smile, MOUTH.right, 0.65, 0.7);

    expect(smileRatio(smile)).toBeGreaterThan(smileRatio(neutral));
    expect(smileRatio(smile)).toBeGreaterThan(0.6); // default threshold
    expect(smileRatio(neutral)).toBeLessThan(0.6);
  });
});

describe('Mouth Aspect Ratio', () => {
  it('rises when the mouth opens', () => {
    const closed = face();
    put(closed, MOUTH.left, 0.4, 0.7);
    put(closed, MOUTH.right, 0.6, 0.7);
    put(closed, MOUTH.top, 0.5, 0.69);
    put(closed, MOUTH.bottom, 0.5, 0.71);

    const open = face();
    put(open, MOUTH.left, 0.4, 0.7);
    put(open, MOUTH.right, 0.6, 0.7);
    put(open, MOUTH.top, 0.5, 0.6);
    put(open, MOUTH.bottom, 0.5, 0.8);

    expect(mouthAspectRatio(open)).toBeGreaterThan(mouthAspectRatio(closed));
  });
});

describe('Head yaw (turn)', () => {
  it('is ~0 facing forward and positive when the nose shifts right', () => {
    const forward = face();
    put(forward, POSE.leftEyeOuter, 0.3, 0.5);
    put(forward, POSE.rightEyeOuter, 0.7, 0.5);
    put(forward, POSE.noseTip, 0.5, 0.6);
    expect(Math.abs(headYawNorm(forward))).toBeLessThan(0.05);

    const turned = face();
    put(turned, POSE.leftEyeOuter, 0.3, 0.5);
    put(turned, POSE.rightEyeOuter, 0.7, 0.5);
    put(turned, POSE.noseTip, 0.62, 0.6);
    expect(headYawNorm(turned)).toBeGreaterThan(0.2);
  });
});
