import type { FaceLandmarks, Landmark } from './types';

/**
 * Decode the Face Mesh model's raw landmark tensor.
 * face_landmark.tflite emits 468*3 floats (x,y,z) in INPUT-pixel space
 * (0..inputSize). We divide by inputSize to get crop-local [0,1] coords — all
 * downstream geometry uses scale-invariant ratios, so that's sufficient.
 */
export function decodeLandmarks(
  raw: Float32Array,
  inputSize: number,
): FaceLandmarks {
  'worklet';
  const count = Math.floor(raw.length / 3);
  const out: Landmark[] = [];
  for (let i = 0; i < count; i++) {
    const o = i * 3;
    out.push({ x: raw[o] / inputSize, y: raw[o + 1] / inputSize, z: raw[o + 2] / inputSize });
  }
  return out;
}

/** Sigmoid of the model's face-presence logit (the length-1 output tensor). */
export function facePresenceScore(raw: Float32Array): number {
  'worklet';
  return 1 / (1 + Math.exp(-raw[0]));
}

export const FACEMESH_INPUT_SIZE = 192;
export const FACEMESH_LANDMARK_COUNT = 468;
