import type { FaceLandmarks } from './types';
import { LEFT_EYE_EAR, RIGHT_EYE_EAR, MOUTH, POSE } from './landmarks';

/**
 * 5-point face alignment for MobileFaceNet (112×112 input).
 *
 * Algorithm: 2D similarity transform (Umeyama least-squares, 4 DOF: scale,
 * rotation, tx, ty). Given the 5 detected landmarks and the canonical target
 * positions, we compute the transform that best maps detected → canonical.
 * The inverse maps canonical 112×112 pixels back to source-frame pixels,
 * so we know exactly which region of the original frame to sample.
 *
 * All functions are pure + 'worklet' so they run in the frame processor.
 */

export interface Point2D {
  x: number;
  y: number;
}

/**
 * 2×3 row-major affine (similarity) transform.
 *   [u]   [a  -b  tx] [x]
 *   [v] = [b   a  ty] [y]
 *                     [1]
 */
export interface AffineMatrix {
  a: number;
  b: number;
  tx: number;
  ty: number;
}

/**
 * Canonical 5-point positions for a 112×112 ArcFace/MobileFaceNet input
 * (InsightFace reference — left/right from the SUBJECT's perspective).
 */
export const CANONICAL_112: readonly Point2D[] = [
  { x: 38.29, y: 51.70 }, // left eye centre
  { x: 73.53, y: 51.50 }, // right eye centre
  { x: 56.02, y: 71.74 }, // nose tip
  { x: 41.55, y: 92.37 }, // mouth left corner
  { x: 70.73, y: 92.20 }, // mouth right corner
];

/** MobileFaceNet input side length. */
export const MOBILEFACENET_INPUT_SIZE = 112;

// ---------------------------------------------------------------------------
// 5-point extraction from Face Mesh
// ---------------------------------------------------------------------------

/** Mean of an array of indices from the landmark set. */
function meanPoint(lm: FaceLandmarks, indices: readonly number[]): Point2D {
  'worklet';
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < indices.length; i++) {
    sx += lm[indices[i]].x;
    sy += lm[indices[i]].y;
  }
  return { x: sx / indices.length, y: sy / indices.length };
}

/**
 * Extract the 5 alignment landmarks from Face Mesh in crop-local [0,1] coords.
 * They are returned in the same order as CANONICAL_112.
 */
export function extract5Points(lm: FaceLandmarks): [Point2D, Point2D, Point2D, Point2D, Point2D] {
  'worklet';
  // Eye centres: mean of all 6 EAR ring points (inner + outer + upper + lower).
  const leftEye = meanPoint(lm, LEFT_EYE_EAR);
  const rightEye = meanPoint(lm, RIGHT_EYE_EAR);
  const noseTip = { x: lm[POSE.noseTip].x, y: lm[POSE.noseTip].y };
  const mouthLeft = { x: lm[MOUTH.left].x, y: lm[MOUTH.left].y };
  const mouthRight = { x: lm[MOUTH.right].x, y: lm[MOUTH.right].y };
  return [leftEye, rightEye, noseTip, mouthLeft, mouthRight];
}

// ---------------------------------------------------------------------------
// 2D similarity transform (Umeyama least-squares)
// ---------------------------------------------------------------------------

/**
 * Compute the similarity transform that maps `src` → `dst` in least-squares
 * sense. Both arrays must have the same length (≥ 2 non-coincident points).
 *
 * Closed form (centroid-normalised):
 *   a = sum(x̂·û + ŷ·v̂) / sum(x̂²+ŷ²)
 *   b = sum(x̂·v̂ - ŷ·û) / sum(x̂²+ŷ²)
 *   tx = ū - a·x̄ + b·ȳ
 *   ty = v̄ - b·x̄ - a·ȳ
 */
export function umeyama2D(src: readonly Point2D[], dst: readonly Point2D[]): AffineMatrix {
  'worklet';
  const n = src.length;
  let sx = 0;
  let sy = 0;
  let du = 0;
  let dv = 0;
  for (let i = 0; i < n; i++) {
    sx += src[i].x;
    sy += src[i].y;
    du += dst[i].x;
    dv += dst[i].y;
  }
  const mx = sx / n;
  const my = sy / n;
  const mu = du / n;
  const mv = dv / n;

  let numA = 0;
  let numB = 0;
  let denom = 0;
  for (let i = 0; i < n; i++) {
    const x = src[i].x - mx;
    const y = src[i].y - my;
    const u = dst[i].x - mu;
    const v = dst[i].y - mv;
    numA += x * u + y * v;
    numB += x * v - y * u;
    denom += x * x + y * y;
  }

  if (denom === 0) {
    // Degenerate: all source points coincide → identity + translate.
    return { a: 1, b: 0, tx: mu - mx, ty: mv - my };
  }

  const a = numA / denom;
  const b = numB / denom;
  return {
    a,
    b,
    tx: mu - a * mx + b * my,
    ty: mv - b * mx - a * my,
  };
}

/** Apply the forward transform to a single point. */
export function transformPoint(m: AffineMatrix, p: Point2D): Point2D {
  'worklet';
  return {
    x: m.a * p.x - m.b * p.y + m.tx,
    y: m.b * p.x + m.a * p.y + m.ty,
  };
}

/** Invert a similarity transform. */
/**
 * Invert a 2D similarity transform.
 *
 * Forward: [[a,-b];[b,a]] · p + t
 * Inverse: (1/s²) · [[a,b];[-b,a]] · (q - t)
 *
 * In AffineMatrix form {a', b', tx', ty'} where u = a'x - b'y + tx':
 *   a'  =  a/s²
 *   b'  = -b/s²        ← sign is NEGATIVE (the row-swap flips the rotation)
 *   tx' = -(a·tx + b·ty)/s²
 *   ty' =  (b·tx - a·ty)/s²
 */
export function invertAffine(m: AffineMatrix): AffineMatrix {
  'worklet';
  const s2 = m.a * m.a + m.b * m.b;
  if (s2 === 0) return { a: 1, b: 0, tx: 0, ty: 0 };
  return {
    a: m.a / s2,
    b: -m.b / s2,
    tx: (-m.a * m.tx - m.b * m.ty) / s2,
    ty: (m.b * m.tx - m.a * m.ty) / s2,
  };
}

// ---------------------------------------------------------------------------
// Crop-region helper for the resize plugin
// ---------------------------------------------------------------------------

export interface AlignedCrop {
  /** Pixel-space bounding box in the SOURCE frame to crop (for resize plugin). */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Clockwise rotation in degrees applied AFTER cropping to further align the face. */
  rotationDeg: number;
  /** The full inverse 2×3 affine for a true per-pixel warp (Skia in Phase 5). */
  invAffine: AffineMatrix;
}

/**
 * Compute the source-frame crop that approximates the canonical aligned face.
 * The resize plugin handles the crop + scale to 112×112; the returned
 * `rotationDeg` corrects in-plane rotation.  For a true affine warp (required
 * for high-accuracy recognition), use `invAffine` with Skia's canvas in Phase 5.
 *
 * `landmarks5` is in pixel coords of the source frame (not normalised).
 */
export function alignedCropParams(
  landmarks5: readonly Point2D[],
  frameWidth: number,
  frameHeight: number,
): AlignedCrop {
  'worklet';
  // Map canonical → source (inverse of the detected→canonical transform).
  const fwd = umeyama2D(landmarks5, CANONICAL_112);
  const inv = invertAffine(fwd);

  // The four corners of the canonical 112×112 output in source-frame space.
  const corners: Point2D[] = [
    { x: 0, y: 0 },
    { x: MOBILEFACENET_INPUT_SIZE, y: 0 },
    { x: MOBILEFACENET_INPUT_SIZE, y: MOBILEFACENET_INPUT_SIZE },
    { x: 0, y: MOBILEFACENET_INPUT_SIZE },
  ].map(c => transformPoint(inv, c));

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of corners) {
    if (c.x < minX) minX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.x > maxX) maxX = c.x;
    if (c.y > maxY) maxY = c.y;
  }

  // Clamp to frame.
  minX = Math.max(0, Math.round(minX));
  minY = Math.max(0, Math.round(minY));
  maxX = Math.min(frameWidth, Math.round(maxX));
  maxY = Math.min(frameHeight, Math.round(maxY));

  // Clockwise rotation angle from the eye line (approximation for in-plane tilt).
  const leftEye = landmarks5[0];
  const rightEye = landmarks5[1];
  const dx = rightEye.x - leftEye.x;
  const dy = rightEye.y - leftEye.y;
  const rotationDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    rotationDeg,
    invAffine: inv,
  };
}
