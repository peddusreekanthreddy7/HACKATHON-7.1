import type { Anchor } from './types';

/**
 * SSD anchor generation for MediaPipe BlazeFace **short-range** (128x128).
 *
 * Mirrors MediaPipe's `SsdAnchorsCalculator` with the short-range options:
 * strides [8,16,16,16], 4 layers, fixed anchor size, interpolated scale.
 * Produces exactly **896 anchors** (16x16x2 + 8x8x6), matching the model's
 * `[1, 896, *]` output tensors.
 *
 * This runs once on the JS thread; the result is captured by the frame
 * processor worklet (read-only), so it does not need the 'worklet' directive.
 */
const STRIDES = [8, 16, 16, 16];
const INPUT_SIZE = 128;
const ANCHOR_OFFSET = 0.5;
const MIN_SCALE = 0.1484375;
const MAX_SCALE = 0.75;
const INTERPOLATED_SCALE_ASPECT_RATIO = 1.0;

function calculateScale(index: number, numStrides: number): number {
  if (numStrides === 1) return (MIN_SCALE + MAX_SCALE) * 0.5;
  return MIN_SCALE + ((MAX_SCALE - MIN_SCALE) * index) / (numStrides - 1);
}

export function generateAnchors(): Anchor[] {
  const anchors: Anchor[] = [];
  const numLayers = STRIDES.length;
  let layerId = 0;

  while (layerId < numLayers) {
    // Count how many anchors-per-location this stride group produces.
    let anchorsPerLocation = 0;
    let lastSameStride = layerId;
    while (
      lastSameStride < numLayers &&
      STRIDES[lastSameStride] === STRIDES[layerId]
    ) {
      // One anchor for aspect-ratio 1.0 ...
      anchorsPerLocation += 1;
      // ... plus one interpolated-scale anchor (short-range config).
      if (INTERPOLATED_SCALE_ASPECT_RATIO > 0) {
        anchorsPerLocation += 1;
      }
      lastSameStride += 1;
    }

    const stride = STRIDES[layerId];
    const featureMapHeight = Math.ceil(INPUT_SIZE / stride);
    const featureMapWidth = Math.ceil(INPUT_SIZE / stride);

    for (let y = 0; y < featureMapHeight; y++) {
      const yCenter = (y + ANCHOR_OFFSET) / featureMapHeight;
      for (let x = 0; x < featureMapWidth; x++) {
        const xCenter = (x + ANCHOR_OFFSET) / featureMapWidth;
        for (let a = 0; a < anchorsPerLocation; a++) {
          // fixed_anchor_size = true → width = height = 1.0
          anchors.push({ xCenter, yCenter, w: 1.0, h: 1.0 });
        }
      }
    }

    layerId = lastSameStride;
  }

  return anchors;
}

/** Number of anchors the short-range model emits — used as a sanity check. */
export const SHORT_RANGE_ANCHOR_COUNT = 896;

// Referenced so the scale helper isn't flagged unused; kept for fidelity/tuning.
export const SCALE_RANGE = {
  first: calculateScale(0, STRIDES.length),
  last: calculateScale(STRIDES.length - 1, STRIDES.length),
};
