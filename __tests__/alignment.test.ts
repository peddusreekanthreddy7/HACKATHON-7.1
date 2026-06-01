import {
  umeyama2D,
  transformPoint,
  invertAffine,
  alignedCropParams,
  CANONICAL_112,
  MOBILEFACENET_INPUT_SIZE,
} from '../src/ai/facemesh/alignment';
import type { Point2D } from '../src/ai/facemesh/alignment';

describe('umeyama2D — pure translation', () => {
  it('recovers (tx=10, ty=20) from shifted point pairs', () => {
    const src: Point2D[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 },
                             { x: 1, y: 1 }, { x: 0.5, y: 0.5 }];
    const dst = src.map(p => ({ x: p.x + 10, y: p.y + 20 }));
    const m = umeyama2D(src, dst);
    expect(m.a).toBeCloseTo(1, 4);
    expect(m.b).toBeCloseTo(0, 4);
    expect(m.tx).toBeCloseTo(10, 3);
    expect(m.ty).toBeCloseTo(20, 3);
  });
});

describe('umeyama2D — pure uniform scale', () => {
  it('recovers scale factor 2', () => {
    const src: Point2D[] = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 },
                             { x: 0, y: -1 }, { x: 1, y: 1 }];
    const dst = src.map(p => ({ x: p.x * 2, y: p.y * 2 }));
    const m = umeyama2D(src, dst);
    const scale = Math.sqrt(m.a * m.a + m.b * m.b);
    expect(scale).toBeCloseTo(2, 3);
    expect(m.b).toBeCloseTo(0, 3);
  });
});

describe('umeyama2D — 90-degree rotation', () => {
  it('reconstructs a 90° CCW rotation matrix', () => {
    const src: Point2D[] = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 },
                             { x: 0, y: -1 }, { x: 1, y: 1 }];
    // 90° CCW: (x,y) → (-y, x)
    const dst = src.map(p => ({ x: -p.y, y: p.x }));
    const m = umeyama2D(src, dst);
    expect(m.a).toBeCloseTo(0, 3);   // cos(90°) = 0
    expect(m.b).toBeCloseTo(1, 3);   // sin(90°) = 1
  });
});

describe('transformPoint', () => {
  it('applies the matrix correctly', () => {
    const m = { a: 1, b: 0, tx: 5, ty: 10 };
    const p = transformPoint(m, { x: 3, y: 4 });
    expect(p.x).toBeCloseTo(8);
    expect(p.y).toBeCloseTo(14);
  });
});

describe('invertAffine', () => {
  it('forward then inverse returns the original point', () => {
    const m = umeyama2D(
      [{ x: 38, y: 51 }, { x: 73, y: 51 }, { x: 56, y: 71 }, { x: 41, y: 92 }, { x: 70, y: 92 }],
      CANONICAL_112 as Point2D[],
    );
    const inv = invertAffine(m);
    const src = { x: 55, y: 65 };
    const fwd = transformPoint(m, src);
    const back = transformPoint(inv, fwd);
    expect(back.x).toBeCloseTo(src.x, 2);
    expect(back.y).toBeCloseTo(src.y, 2);
  });
});

describe('alignedCropParams', () => {
  it('returns a non-empty crop clamped to the frame', () => {
    // Landmarks roughly in a 640×480 front-camera frame.
    const lm5: Point2D[] = [
      { x: 260, y: 200 },
      { x: 380, y: 200 },
      { x: 320, y: 260 },
      { x: 280, y: 320 },
      { x: 360, y: 320 },
    ];
    const crop = alignedCropParams(lm5, 640, 480);
    expect(crop.x).toBeGreaterThanOrEqual(0);
    expect(crop.y).toBeGreaterThanOrEqual(0);
    expect(crop.x + crop.width).toBeLessThanOrEqual(640);
    expect(crop.y + crop.height).toBeLessThanOrEqual(480);
    expect(crop.width).toBeGreaterThan(0);
    expect(crop.height).toBeGreaterThan(0);
  });
});
