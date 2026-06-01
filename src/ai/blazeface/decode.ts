import type { Anchor, DecodeOptions, DetectedFace } from './types';

/**
 * Decodes raw BlazeFace output tensors into faces. Every function here carries
 * the `'worklet'` directive so it can run INSIDE the vision-camera frame
 * processor (off the JS thread) — and, because the directive is a no-op string
 * in plain JS, the exact same code is unit-testable under Jest.
 *
 * Box layout follows MediaPipe short-range with reverse_output_order=true:
 * regressors are [x, y, w, h, ...6 keypoints] per anchor (16 floats). Decode is
 * written to spec; thresholds + normalization are tuned/verified ON DEVICE.
 */

export const DEFAULT_DECODE_OPTIONS: DecodeOptions = {
  inputSize: 128,
  scoreThreshold: 0.6,
  iouThreshold: 0.3,
  maxFaces: 1,
};

const COORDS_PER_ANCHOR = 16; // 4 box + 6 keypoints * 2

function sigmoid(x: number): number {
  'worklet';
  return 1 / (1 + Math.exp(-x));
}

function iou(a: DetectedFace, b: DetectedFace): number {
  'worklet';
  const ax2 = a.bbox.x + a.bbox.width;
  const ay2 = a.bbox.y + a.bbox.height;
  const bx2 = b.bbox.x + b.bbox.width;
  const by2 = b.bbox.y + b.bbox.height;

  const interX1 = Math.max(a.bbox.x, b.bbox.x);
  const interY1 = Math.max(a.bbox.y, b.bbox.y);
  const interX2 = Math.min(ax2, bx2);
  const interY2 = Math.min(ay2, by2);

  const interW = Math.max(0, interX2 - interX1);
  const interH = Math.max(0, interY2 - interY1);
  const interArea = interW * interH;

  const union = a.bbox.width * a.bbox.height + b.bbox.width * b.bbox.height - interArea;
  return union <= 0 ? 0 : interArea / union;
}

/** Greedy non-max suppression, highest score first. */
export function nonMaxSuppression(
  faces: DetectedFace[],
  iouThreshold: number,
  maxFaces: number,
): DetectedFace[] {
  'worklet';
  const sorted = faces.slice().sort((p, q) => q.score - p.score);
  const kept: DetectedFace[] = [];
  for (let i = 0; i < sorted.length && kept.length < maxFaces; i++) {
    const candidate = sorted[i];
    let overlaps = false;
    for (let j = 0; j < kept.length; j++) {
      if (iou(candidate, kept[j]) > iouThreshold) {
        overlaps = true;
        break;
      }
    }
    if (!overlaps) kept.push(candidate);
  }
  return kept;
}

/**
 * Decode regressor + score tensors into faces in normalized [0,1] coordinates.
 * @param regressors Float32 array of length anchors*16.
 * @param scores Float32 array of length anchors (raw logits).
 */
export function decodeFaces(
  regressors: Float32Array,
  scores: Float32Array,
  anchors: Anchor[],
  options: DecodeOptions,
): DetectedFace[] {
  'worklet';
  const candidates: DetectedFace[] = [];
  const scale = options.inputSize;

  for (let i = 0; i < anchors.length; i++) {
    const score = sigmoid(scores[i]);
    if (score < options.scoreThreshold) continue;

    const anchor = anchors[i];
    const offset = i * COORDS_PER_ANCHOR;

    // Center/size are predicted relative to the anchor, in input-pixel units.
    const cx = regressors[offset] / scale + anchor.xCenter;
    const cy = regressors[offset + 1] / scale + anchor.yCenter;
    const w = regressors[offset + 2] / scale;
    const h = regressors[offset + 3] / scale;

    candidates.push({
      bbox: { x: cx - w / 2, y: cy - h / 2, width: w, height: h },
      score,
    });
  }

  return nonMaxSuppression(candidates, options.iouThreshold, options.maxFaces);
}
