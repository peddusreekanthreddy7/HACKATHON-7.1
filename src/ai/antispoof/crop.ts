export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NormalizedBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Square face crop expanded by `scale` around the detected box, clamped to the
 * frame. MiniFASNet was trained on context-padded crops (the "2.7" in the model
 * name), so feeding a tight box hurts accuracy — this reproduces that padding.
 * Pure + 'worklet' → used in the frame processor and unit-tested.
 */
export function expandedCropRect(
  bbox: NormalizedBox,
  frameWidth: number,
  frameHeight: number,
  scale: number,
): CropRect {
  'worklet';
  const cx = (bbox.x + bbox.width / 2) * frameWidth;
  const cy = (bbox.y + bbox.height / 2) * frameHeight;
  let size = Math.max(bbox.width * frameWidth, bbox.height * frameHeight) * scale;
  // Can't be larger than the frame.
  size = Math.min(size, frameWidth, frameHeight);
  let x = cx - size / 2;
  let y = cy - size / 2;
  // Keep the square fully inside the frame.
  x = Math.max(0, Math.min(x, frameWidth - size));
  y = Math.max(0, Math.min(y, frameHeight - size));
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(size),
    height: Math.round(size),
  };
}
