/**
 * Frame statistics used for lighting adaptation + the debug overlay.
 * Worklet-safe (runs inside the frame processor) and pure (Jest-testable).
 */

/** Rec.601 luma weights. */
const R_W = 0.299;
const G_W = 0.587;
const B_W = 0.114;

export interface BrightnessStats {
  /** Mean luminance, 0–255. */
  mean: number;
  /** 0 = pitch black, 1 = blown-out white; ~0.4–0.6 is well-lit. */
  normalized: number;
}

/** Mean luminance of a packed RGB (3 channels/pixel) uint8 buffer. */
export function computeBrightness(rgb: Uint8Array): BrightnessStats {
  'worklet';
  const pixels = (rgb.length / 3) | 0;
  if (pixels === 0) return { mean: 0, normalized: 0 };

  let sum = 0;
  for (let p = 0; p < pixels; p++) {
    const i = p * 3;
    sum += R_W * rgb[i] + G_W * rgb[i + 1] + B_W * rgb[i + 2];
  }
  const mean = sum / pixels;
  return { mean, normalized: mean / 255 };
}

/** Classify lighting for the UI hint. */
export function classifyLighting(
  normalized: number,
): 'dark' | 'good' | 'bright' {
  'worklet';
  if (normalized < 0.25) return 'dark';
  if (normalized > 0.8) return 'bright';
  return 'good';
}
