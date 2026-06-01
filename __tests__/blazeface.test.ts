import {
  generateAnchors,
  SHORT_RANGE_ANCHOR_COUNT,
} from '../src/ai/blazeface/anchors';
import {
  decodeFaces,
  nonMaxSuppression,
  DEFAULT_DECODE_OPTIONS,
} from '../src/ai/blazeface/decode';
import type { Anchor, DetectedFace } from '../src/ai/blazeface/types';

describe('BlazeFace anchors', () => {
  const anchors = generateAnchors();

  it('generates exactly 896 short-range anchors', () => {
    expect(anchors).toHaveLength(SHORT_RANGE_ANCHOR_COUNT);
  });

  it('keeps every anchor centre within [0,1]', () => {
    for (const a of anchors) {
      expect(a.xCenter).toBeGreaterThanOrEqual(0);
      expect(a.xCenter).toBeLessThanOrEqual(1);
      expect(a.yCenter).toBeGreaterThanOrEqual(0);
      expect(a.yCenter).toBeLessThanOrEqual(1);
    }
  });
});

describe('non-max suppression', () => {
  it('drops overlapping boxes, keeping the highest score', () => {
    const strong: DetectedFace = {
      bbox: { x: 0.1, y: 0.1, width: 0.3, height: 0.3 },
      score: 0.9,
    };
    const weakOverlap: DetectedFace = {
      bbox: { x: 0.12, y: 0.12, width: 0.3, height: 0.3 },
      score: 0.7,
    };
    const separate: DetectedFace = {
      bbox: { x: 0.7, y: 0.7, width: 0.2, height: 0.2 },
      score: 0.8,
    };

    const kept = nonMaxSuppression([strong, weakOverlap, separate], 0.3, 10);

    expect(kept).toHaveLength(2);
    expect(kept[0].score).toBe(0.9);
    expect(kept.find(f => f.score === 0.7)).toBeUndefined();
  });

  it('honours maxFaces', () => {
    const faces: DetectedFace[] = [
      { bbox: { x: 0, y: 0, width: 0.1, height: 0.1 }, score: 0.9 },
      { bbox: { x: 0.5, y: 0.5, width: 0.1, height: 0.1 }, score: 0.8 },
    ];
    expect(nonMaxSuppression(faces, 0.3, 1)).toHaveLength(1);
  });
});

describe('decodeFaces', () => {
  it('keeps detections above threshold and decodes the box geometry', () => {
    const anchors: Anchor[] = [
      { xCenter: 0.5, yCenter: 0.5, w: 1, h: 1 },
      { xCenter: 0.2, yCenter: 0.2, w: 1, h: 1 },
    ];
    const regressors = new Float32Array(anchors.length * 16);
    regressors[2] = 25.6; // width  → 25.6/128 = 0.2
    regressors[3] = 25.6; // height → 0.2
    const scores = new Float32Array(anchors.length);
    scores[0] = 12; // sigmoid ≈ 1 → kept
    scores[1] = -12; // sigmoid ≈ 0 → dropped

    const faces = decodeFaces(regressors, scores, anchors, {
      ...DEFAULT_DECODE_OPTIONS,
      maxFaces: 10,
    });

    expect(faces).toHaveLength(1);
    expect(faces[0].score).toBeGreaterThan(0.99);
    expect(faces[0].bbox.width).toBeCloseTo(0.2, 4);
    expect(faces[0].bbox.x).toBeCloseTo(0.4, 4); // centred on 0.5, half-width 0.1
  });
});
