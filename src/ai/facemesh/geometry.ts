import type { FaceLandmarks } from './types';
import { LEFT_EYE_EAR, RIGHT_EYE_EAR, MOUTH, POSE } from './landmarks';

/**
 * Liveness geometry derived from Face Mesh landmarks. All functions are pure
 * and carry the 'worklet' directive so they run inside the frame processor AND
 * are unit-testable in Node. Inputs are scale-invariant ratios, so they work on
 * crop-local [0,1] coordinates regardless of the face crop size.
 */

function dist(ax: number, ay: number, bx: number, by: number): number {
  'worklet';
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Eye Aspect Ratio for one eye (6-point set). ~0.3 open, ~0.1 closed. */
export function eyeAspectRatio(lm: FaceLandmarks, idx: readonly number[]): number {
  'worklet';
  const p1 = lm[idx[0]];
  const p2 = lm[idx[1]];
  const p3 = lm[idx[2]];
  const p4 = lm[idx[3]];
  const p5 = lm[idx[4]];
  const p6 = lm[idx[5]];
  const horizontal = dist(p1.x, p1.y, p4.x, p4.y);
  if (horizontal === 0) return 0;
  const vertical = dist(p2.x, p2.y, p6.x, p6.y) + dist(p3.x, p3.y, p5.x, p5.y);
  return vertical / (2 * horizontal);
}

/** Mean EAR across both eyes — the blink signal. */
export function averageEAR(lm: FaceLandmarks): number {
  'worklet';
  return (
    (eyeAspectRatio(lm, LEFT_EYE_EAR) + eyeAspectRatio(lm, RIGHT_EYE_EAR)) / 2
  );
}

/** Mouth Aspect Ratio (vertical opening / width). Large when mouth is open. */
export function mouthAspectRatio(lm: FaceLandmarks): number {
  'worklet';
  const width = dist(lm[MOUTH.left].x, lm[MOUTH.left].y, lm[MOUTH.right].x, lm[MOUTH.right].y);
  if (width === 0) return 0;
  return dist(lm[MOUTH.top].x, lm[MOUTH.top].y, lm[MOUTH.bottom].x, lm[MOUTH.bottom].y) / width;
}

/**
 * Smile signal: lip-corner distance normalized by inter-ocular distance.
 * A smile widens the mouth, raising this ratio, without opening it much (which
 * is why we use width rather than MAR for smile detection).
 */
export function smileRatio(lm: FaceLandmarks): number {
  'worklet';
  const eyeWidth = dist(
    lm[POSE.leftEyeOuter].x, lm[POSE.leftEyeOuter].y,
    lm[POSE.rightEyeOuter].x, lm[POSE.rightEyeOuter].y,
  );
  if (eyeWidth === 0) return 0;
  const mouthWidth = dist(lm[MOUTH.left].x, lm[MOUTH.left].y, lm[MOUTH.right].x, lm[MOUTH.right].y);
  return mouthWidth / eyeWidth;
}

/**
 * Signed, normalized yaw proxy from nose position between the eye corners.
 * ~0 facing forward; positive = nose shifted toward the right eye corner.
 * Multiply by a scale to approximate degrees.
 */
export function headYawNorm(lm: FaceLandmarks): number {
  'worklet';
  const L = lm[POSE.leftEyeOuter];
  const R = lm[POSE.rightEyeOuter];
  const N = lm[POSE.noseTip];
  const eyeWidth = R.x - L.x;
  if (eyeWidth === 0) return 0;
  const midX = (L.x + R.x) / 2;
  return (N.x - midX) / Math.abs(eyeWidth);
}

/** Signed, normalized pitch proxy from nose height relative to the eye line. */
export function headPitchNorm(lm: FaceLandmarks): number {
  'worklet';
  const L = lm[POSE.leftEyeOuter];
  const R = lm[POSE.rightEyeOuter];
  const N = lm[POSE.noseTip];
  const C = lm[POSE.chin];
  const midY = (L.y + R.y) / 2;
  const faceHeight = Math.abs(C.y - midY);
  if (faceHeight === 0) return 0;
  return (N.y - midY) / faceHeight;
}

export interface HeadPose {
  yaw: number;
  pitch: number;
}

/** Approximate yaw/pitch in degrees (scales are configurable + tuned on device). */
export function estimateHeadPose(
  lm: FaceLandmarks,
  yawScale: number,
  pitchScale: number,
): HeadPose {
  'worklet';
  return {
    yaw: headYawNorm(lm) * yawScale,
    pitch: headPitchNorm(lm) * pitchScale,
  };
}
