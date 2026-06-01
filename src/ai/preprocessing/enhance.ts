/**
 * Lighting normalization for robust detection in harsh sun / low light /
 * shadows (hard constraint #5). Implements **CLAHE** — Contrast-Limited
 * Adaptive Histogram Equalization — on the luminance channel with bilinear
 * interpolation between tiles, plus a global brightness pre-gain.
 *
 * Operates on the small (e.g. 128x128) resized tensor, so it's cheap enough to
 * run per throttled frame on a 3 GB device. Worklet-safe + Jest-testable.
 */

export interface EnhanceOptions {
  /** CLAHE tile grid. 8x8 on a 128px tensor = 16px tiles. */
  tilesX: number;
  tilesY: number;
  /** Contrast clip limit (multiple of the average bin height). Higher = stronger. */
  clipLimit: number;
  /** Global brightness target (0–255) applied as a gentle pre-gain. */
  targetMean: number;
}

export const DEFAULT_ENHANCE_OPTIONS: EnhanceOptions = {
  tilesX: 8,
  tilesY: 8,
  clipLimit: 4.0,
  targetMean: 128,
};

function clamp8(v: number): number {
  'worklet';
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/** Build a clipped-histogram CDF mapping (256 entries) for one tile. */
function buildTileMap(
  luma: Uint8Array,
  width: number,
  height: number,
  tx: number,
  ty: number,
  tileW: number,
  tileH: number,
  clipLimit: number,
  maps: Uint8Array,
  mapBase: number,
): void {
  'worklet';
  const x0 = tx * tileW;
  const y0 = ty * tileH;
  const x1 = Math.min(x0 + tileW, width);
  const y1 = Math.min(y0 + tileH, height);

  const hist = new Int32Array(256);
  let count = 0;
  for (let y = y0; y < y1; y++) {
    const row = y * width;
    for (let x = x0; x < x1; x++) {
      hist[luma[row + x]]++;
      count++;
    }
  }
  if (count === 0) return;

  // Clip histogram and redistribute the clipped mass uniformly.
  const limit = Math.max(1, Math.floor((clipLimit * count) / 256));
  let clipped = 0;
  for (let b = 0; b < 256; b++) {
    if (hist[b] > limit) {
      clipped += hist[b] - limit;
      hist[b] = limit;
    }
  }
  const redistribute = Math.floor(clipped / 256);
  const residual = clipped - redistribute * 256;
  for (let b = 0; b < 256; b++) hist[b] += redistribute;
  for (let b = 0; b < residual; b++) hist[b] += 1;

  // CDF → mapping normalized to 0..255.
  let cdf = 0;
  const denom = count > 1 ? count - 1 : 1;
  for (let b = 0; b < 256; b++) {
    cdf += hist[b];
    maps[mapBase + b] = clamp8(Math.round(((cdf - 1) / denom) * 255));
  }
}

/**
 * Returns a NEW enhanced RGB buffer (same packed layout as the input).
 * @param rgb Packed RGB uint8, length = width*height*3.
 */
export function enhanceForDetection(
  rgb: Uint8Array,
  width: number,
  height: number,
  options: EnhanceOptions,
): Uint8Array {
  'worklet';
  const pixelCount = width * height;
  const luma = new Uint8Array(pixelCount);

  // 1. Luminance + mean (for the global brightness pre-gain).
  let sum = 0;
  for (let p = 0; p < pixelCount; p++) {
    const i = p * 3;
    const l = 0.299 * rgb[i] + 0.587 * rgb[i + 1] + 0.114 * rgb[i + 2];
    luma[p] = l | 0;
    sum += l;
  }
  const mean = sum / pixelCount;
  // Gentle, clamped gain toward the target so very dark frames get lifted
  // before CLAHE (and very bright frames pulled down) without overshoot.
  const preGain = Math.min(2.5, Math.max(0.5, options.targetMean / (mean + 1)));

  const { tilesX, tilesY, clipLimit } = options;
  const tileW = Math.ceil(width / tilesX);
  const tileH = Math.ceil(height / tilesY);

  // 2. Per-tile clipped-CDF maps.
  const maps = new Uint8Array(tilesX * tilesY * 256);
  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const base = (ty * tilesX + tx) * 256;
      buildTileMap(luma, width, height, tx, ty, tileW, tileH, clipLimit, maps, base);
    }
  }

  // 3. Apply maps with bilinear interpolation between tile centers, then carry
  //    the luminance change back onto each RGB channel via a ratio.
  const out = new Uint8Array(rgb.length);
  for (let y = 0; y < height; y++) {
    const fy = (y + 0.5) / tileH - 0.5;
    const ty0 = Math.floor(fy);
    const wy = fy - ty0;
    const ty0c = ty0 < 0 ? 0 : ty0 > tilesY - 1 ? tilesY - 1 : ty0;
    const ty1c = ty0 + 1 < 0 ? 0 : ty0 + 1 > tilesY - 1 ? tilesY - 1 : ty0 + 1;

    for (let x = 0; x < width; x++) {
      const fx = (x + 0.5) / tileW - 0.5;
      const tx0 = Math.floor(fx);
      const wx = fx - tx0;
      const tx0c = tx0 < 0 ? 0 : tx0 > tilesX - 1 ? tilesX - 1 : tx0;
      const tx1c = tx0 + 1 < 0 ? 0 : tx0 + 1 > tilesX - 1 ? tilesX - 1 : tx0 + 1;

      const p = y * width + x;
      const lv = luma[p];
      const m00 = maps[(ty0c * tilesX + tx0c) * 256 + lv];
      const m01 = maps[(ty0c * tilesX + tx1c) * 256 + lv];
      const m10 = maps[(ty1c * tilesX + tx0c) * 256 + lv];
      const m11 = maps[(ty1c * tilesX + tx1c) * 256 + lv];

      const top = m00 * (1 - wx) + m01 * wx;
      const bot = m10 * (1 - wx) + m11 * wx;
      const newL = (top * (1 - wy) + bot * wy) * preGain;

      // Preserve colour: scale RGB by the luminance ratio.
      const ratio = newL / (lv + 1);
      const i = p * 3;
      out[i] = clamp8(rgb[i] * ratio);
      out[i + 1] = clamp8(rgb[i + 1] * ratio);
      out[i + 2] = clamp8(rgb[i + 2] * ratio);
    }
  }

  return out;
}
