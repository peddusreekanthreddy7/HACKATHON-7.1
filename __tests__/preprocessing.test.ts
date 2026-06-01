import {
  enhanceForDetection,
  DEFAULT_ENHANCE_OPTIONS,
} from '../src/ai/preprocessing/enhance';
import {
  computeBrightness,
  classifyLighting,
} from '../src/ai/preprocessing/imageStats';

function uniformRgb(w: number, h: number, value: number): Uint8Array {
  const a = new Uint8Array(w * h * 3);
  a.fill(value);
  return a;
}

describe('computeBrightness', () => {
  it('measures mean luminance of a uniform image', () => {
    const stats = computeBrightness(uniformRgb(8, 8, 128));
    expect(stats.mean).toBeCloseTo(128, 0);
    expect(stats.normalized).toBeCloseTo(128 / 255, 3);
  });
});

describe('classifyLighting', () => {
  it('labels dark / good / bright bands', () => {
    expect(classifyLighting(0.1)).toBe('dark');
    expect(classifyLighting(0.5)).toBe('good');
    expect(classifyLighting(0.9)).toBe('bright');
  });
});

describe('CLAHE enhanceForDetection', () => {
  const W = 32;
  const H = 32;

  it('returns a same-length RGB buffer within [0,255]', () => {
    const img = uniformRgb(W, H, 90);
    const out = enhanceForDetection(img, W, H, DEFAULT_ENHANCE_OPTIONS);
    expect(out).toHaveLength(img.length);
    for (let i = 0; i < out.length; i++) {
      expect(out[i]).toBeGreaterThanOrEqual(0);
      expect(out[i]).toBeLessThanOrEqual(255);
    }
  });

  it('lifts a dark image toward mid-brightness', () => {
    const img = new Uint8Array(W * H * 3);
    for (let p = 0; p < W * H; p++) {
      const v = Math.floor((p / (W * H)) * 60); // dark gradient 0..60
      img[p * 3] = v;
      img[p * 3 + 1] = v;
      img[p * 3 + 2] = v;
    }
    const before = computeBrightness(img).mean;
    const after = computeBrightness(
      enhanceForDetection(img, W, H, DEFAULT_ENHANCE_OPTIONS),
    ).mean;
    expect(after).toBeGreaterThan(before);
  });
});
