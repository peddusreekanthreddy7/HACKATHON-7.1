/**
 * Canonical MediaPipe Face Mesh (468-point) landmark indices used for liveness.
 * Reference: the MediaPipe face-mesh topology.
 */

/** 6 points per eye in EAR order [p1,p2,p3,p4,p5,p6]: p1/p4 = corners (horizontal). */
export const LEFT_EYE_EAR: readonly number[] = [33, 160, 158, 133, 153, 144];
export const RIGHT_EYE_EAR: readonly number[] = [362, 385, 387, 263, 373, 380];

/** Mouth: outer corners (horizontal) + inner lip top/bottom (vertical). */
export const MOUTH = { left: 61, right: 291, top: 13, bottom: 14 } as const;

/** Reference points for the landmark-geometry head-pose proxy. */
export const POSE = {
  noseTip: 1,
  leftEyeOuter: 33,
  rightEyeOuter: 263,
  chin: 152,
  leftCheek: 234,
  rightCheek: 454,
} as const;

export const NUM_LANDMARKS = 468;
