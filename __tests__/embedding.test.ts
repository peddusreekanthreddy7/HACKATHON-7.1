import {
  l2Normalize,
  dequantiseInt8,
  decodeEmbedding,
  averageEmbeddings,
  embeddingToBuffer,
  bufferToEmbedding,
  cosineSimilarity,
  findBestMatch,
  scoreToConfidence,
  DEFAULT_EMBEDDING_CONFIG,
} from '../src/ai/embedding';
import type { EnrolledRecord } from '../src/ai/embedding';

// ---- Helpers ---------------------------------------------------------------
function makeVec(values: number[]): Float32Array { return new Float32Array(values); }

// ---- L2 normalisation ------------------------------------------------------
describe('l2Normalize', () => {
  it('produces a unit vector', () => {
    const v = l2Normalize(makeVec([3, 4]));
    expect(Math.hypot(v[0], v[1])).toBeCloseTo(1, 6);
    expect(v[0]).toBeCloseTo(0.6, 4);
    expect(v[1]).toBeCloseTo(0.8, 4);
  });
  it('handles the zero vector without crashing', () => {
    const v = l2Normalize(makeVec([0, 0, 0]));
    expect(v.every(x => x === 0)).toBe(true);
  });
});

// ---- INT8 dequantisation ---------------------------------------------------
describe('dequantiseInt8', () => {
  it('maps raw INT8 to float via scale + zeroPoint', () => {
    const raw = new Int8Array([0, 64, -128]);
    const out = dequantiseInt8(raw, 0.01, 10);
    expect(out[0]).toBeCloseTo((0 - 10) * 0.01);
    expect(out[1]).toBeCloseTo((64 - 10) * 0.01);
    expect(out[2]).toBeCloseTo((-128 - 10) * 0.01);
  });
});

// ---- decodeEmbedding -------------------------------------------------------
describe('decodeEmbedding', () => {
  it('accepts a float32 buffer and returns a normalised vector', () => {
    const dim = 4;
    const raw = new Float32Array([3, 0, 4, 0]);
    const emb = decodeEmbedding(raw.buffer, { ...DEFAULT_EMBEDDING_CONFIG, dim });
    const norm = Math.sqrt(emb[0] ** 2 + emb[2] ** 2);
    expect(norm).toBeCloseTo(1, 5);
  });
  it('returns a zero vector for an unknown buffer size', () => {
    const buf = new ArrayBuffer(7); // neither dim*1 nor dim*4
    const emb = decodeEmbedding(buf, { ...DEFAULT_EMBEDDING_CONFIG, dim: 512 });
    expect(emb.length).toBe(512);
    expect(emb.every(x => x === 0)).toBe(true);
  });
});

// ---- averageEmbeddings -----------------------------------------------------
describe('averageEmbeddings', () => {
  it('produces a normalised mean of multiple embeddings', () => {
    const e1 = l2Normalize(makeVec([1, 0, 0, 0]));
    const e2 = l2Normalize(makeVec([0, 1, 0, 0]));
    const avg = averageEmbeddings([e1, e2]);
    const norm = Math.sqrt(avg.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 5);
  });
  it('returns empty array for empty input', () => {
    expect(averageEmbeddings([]).length).toBe(0);
  });
});

// ---- round-trip serialisation ----------------------------------------------
describe('embeddingToBuffer / bufferToEmbedding', () => {
  it('survives a round-trip through Uint8Array', () => {
    const orig = l2Normalize(makeVec([0.1, 0.2, 0.3, 0.4]));
    const buf = embeddingToBuffer(orig);
    const back = bufferToEmbedding(buf);
    for (let i = 0; i < orig.length; i++) {
      expect(back[i]).toBeCloseTo(orig[i], 5);
    }
  });
});

// ---- Cosine similarity -----------------------------------------------------
describe('cosineSimilarity', () => {
  it('is 1 for identical normalised vectors', () => {
    const v = l2Normalize(makeVec([1, 2, 3, 4]));
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
  });
  it('is 0 for orthogonal vectors', () => {
    const a = l2Normalize(makeVec([1, 0, 0, 0]));
    const b = l2Normalize(makeVec([0, 1, 0, 0]));
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
  });
  it('is -1 for opposing vectors', () => {
    const a = l2Normalize(makeVec([1, 0]));
    const b = l2Normalize(makeVec([-1, 0]));
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 5);
  });
});

// ---- findBestMatch ---------------------------------------------------------
describe('findBestMatch', () => {
  const cfg = { ...DEFAULT_EMBEDDING_CONFIG, matchThreshold: 0.6 };

  it('returns null for an empty gallery', () => {
    const q = l2Normalize(makeVec([1, 0, 0]));
    expect(findBestMatch(q, [], cfg)).toBeNull();
  });

  it('finds the closest person and accepts when score ≥ threshold', () => {
    const alice = l2Normalize(makeVec([1, 0, 0]));
    const bob = l2Normalize(makeVec([0, 1, 0]));
    const query = l2Normalize(makeVec([0.95, 0.1, 0])); // close to alice

    const gallery: EnrolledRecord[] = [
      { personId: 'alice', displayName: 'Alice', embedding: alice },
      { personId: 'bob',   displayName: 'Bob',   embedding: bob },
    ];
    const result = findBestMatch(query, gallery, cfg);
    expect(result).not.toBeNull();
    expect(result!.personId).toBe('alice');
    expect(result!.accepted).toBe(true);
  });

  it('rejects when best score is below threshold', () => {
    const alice = l2Normalize(makeVec([1, 0, 0]));
    const query = l2Normalize(makeVec([0, 0, 1])); // orthogonal to alice
    const gallery: EnrolledRecord[] = [
      { personId: 'alice', displayName: 'Alice', embedding: alice },
    ];
    const result = findBestMatch(query, gallery, cfg);
    expect(result!.accepted).toBe(false);
  });
});

// ---- scoreToConfidence -----------------------------------------------------
describe('scoreToConfidence', () => {
  it('maps threshold score to 95%', () => {
    expect(scoreToConfidence(0.6, 0.6)).toBe(95);
  });
  it('maps perfect score to 100%', () => {
    expect(scoreToConfidence(1.0, 0.6)).toBe(100);
  });
  it('maps below threshold to < 95%', () => {
    expect(scoreToConfidence(0.3, 0.6)).toBeLessThan(95);
  });
});
