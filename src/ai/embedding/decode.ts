import type { Embedding, EmbeddingConfig } from './types';

/**
 * Decode a raw INT8 model output to a float32 embedding and L2-normalise it.
 * All pure + 'worklet'.
 */

/** Dequantise INT8 bytes to float32. */
export function dequantiseInt8(
  raw: Int8Array,
  scale: number,
  zeroPoint: number,
): Float32Array {
  'worklet';
  const out = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    out[i] = (raw[i] - zeroPoint) * scale;
  }
  return out;
}

/** L2-normalise a float32 vector in-place. Returns the same array. */
export function l2Normalize(v: Float32Array): Float32Array {
  'worklet';
  let norm = 0;
  for (let i = 0; i < v.length; i++) norm += v[i] * v[i];
  norm = Math.sqrt(norm);
  if (norm === 0) return v;
  for (let i = 0; i < v.length; i++) v[i] /= norm;
  return v;
}

/**
 * Decode a raw TFLite output buffer (INT8 or float32) to an L2-normalised
 * float32 embedding. The model's output tensor is passed as ArrayBuffer.
 */
export function decodeEmbedding(
  raw: ArrayBuffer | ArrayBufferView,
  config: EmbeddingConfig,
): Embedding {
  'worklet';
  // fast-tflite v2 hands back a real TypedArray whose element type tells us how
  // to read it — trust that directly and DO NOT silently fall back to a zero
  // vector on a size quirk. A phantom all-zero embedding scores 0% against
  // everything (and, since enroll + verify share this code, poisons the gallery
  // too), which surfaced as "No match · 0% confidence".
  if (raw instanceof Float32Array) {
    // FP32 model output — use every element regardless of the declared dim.
    return l2Normalize(new Float32Array(raw));
  }
  if (raw instanceof Int8Array) {
    return l2Normalize(
      dequantiseInt8(raw, config.int8.scale, config.int8.zeroPoint),
    );
  }
  if (raw instanceof Uint8Array) {
    // Most delegates that hand back bytes are really float32 buffers.
    const ab = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
    if (raw.byteLength % 4 === 0) return l2Normalize(new Float32Array(ab));
    return l2Normalize(
      dequantiseInt8(new Int8Array(ab), config.int8.scale, config.int8.zeroPoint),
    );
  }

  // Legacy ArrayBuffer path (fast-tflite v3 returned these).
  const rawBuf: ArrayBuffer = ArrayBuffer.isView(raw)
    ? (raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer)
    : raw;
  const byteLen = rawBuf.byteLength;

  if (byteLen === config.dim) {
    // INT8: 1 byte per value.
    return l2Normalize(
      dequantiseInt8(new Int8Array(rawBuf), config.int8.scale, config.int8.zeroPoint),
    );
  }
  if (byteLen % 4 === 0) {
    // Any float32 buffer (192-D = 768 bytes is the expected case).
    return l2Normalize(new Float32Array(rawBuf.slice(0)));
  }
  // Genuinely unreadable — make it loud rather than silently returning zeros.
  console.warn('[decodeEmbedding] unexpected output byteLength=' + byteLen);
  return l2Normalize(new Float32Array(config.dim));
}

/** Average N embeddings and re-normalise (for multi-frame enrollment). */
export function averageEmbeddings(embeddings: Embedding[]): Embedding {
  'worklet';
  if (embeddings.length === 0) return new Float32Array(0);
  const dim = embeddings[0].length;
  const avg = new Float32Array(dim);
  for (const e of embeddings) {
    for (let i = 0; i < dim; i++) avg[i] += e[i];
  }
  for (let i = 0; i < dim; i++) avg[i] /= embeddings.length;
  return l2Normalize(avg);
}

/** Serialise a float32 embedding to a Buffer for SQLite BLOB storage. */
export function embeddingToBuffer(e: Embedding): Uint8Array {
  return new Uint8Array(e.buffer.slice(e.byteOffset, e.byteOffset + e.byteLength));
}

/** Deserialise a BLOB column back to a Float32Array embedding. */
export function bufferToEmbedding(buf: Uint8Array | ArrayBuffer): Embedding {
  const ab = buf instanceof Uint8Array ? buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) : buf;
  return new Float32Array(ab);
}
