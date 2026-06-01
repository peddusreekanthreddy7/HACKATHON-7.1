import {
  softmax,
  scoreAntiSpoof,
  DEFAULT_ANTISPOOF,
  expandedCropRect,
} from '../src/ai/antispoof';

describe('softmax', () => {
  it('produces a probability distribution', () => {
    const p = softmax([1, 2, 3]);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    expect(p[2]).toBeGreaterThan(p[0]);
  });
});

describe('scoreAntiSpoof', () => {
  it('marks real when the real class dominates', () => {
    const r = scoreAntiSpoof([0, 5, 0], DEFAULT_ANTISPOOF);
    expect(r.real).toBe(true);
    expect(r.realScore).toBeGreaterThan(0.6);
  });
  it('marks spoof when the real class is weak', () => {
    const r = scoreAntiSpoof([5, 0, 0], DEFAULT_ANTISPOOF);
    expect(r.real).toBe(false);
  });
});

describe('expandedCropRect', () => {
  it('returns a square crop, expanded beyond the raw box, clamped to frame', () => {
    const rect = expandedCropRect(
      { x: 0.4, y: 0.4, width: 0.2, height: 0.2 },
      1000,
      1000,
      2.7,
    );
    expect(rect.width).toBe(rect.height);
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(1000);
    expect(rect.width).toBeGreaterThan(200); // raw box was 200px
  });

  it('never exceeds the frame for an oversized box', () => {
    const rect = expandedCropRect({ x: 0, y: 0, width: 1, height: 1 }, 640, 480, 2.7);
    expect(rect.width).toBeLessThanOrEqual(480);
    expect(rect.height).toBeLessThanOrEqual(480);
  });
});
