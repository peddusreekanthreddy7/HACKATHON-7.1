import type { ModelSpec } from './types';

/**
 * The four on-device models. `sizeMb` is null until the quantized files are
 * dropped into /models (Phase 2+). `scripts/verify_model_sizes` enforces the
 * ≤ 20 MB total budget (hard constraint #2) in CI once they exist.
 *
 * Licenses are recorded here AND in LICENSES.md and must be re-verified against
 * the exact weights we ship (hard constraint #6).
 */
export const MODELS: Record<string, ModelSpec> = {
  faceDetector: {
    key: 'faceDetector',
    file: 'blazeface.tflite',
    purpose: 'Face detection (BlazeFace / MediaPipe)',
    sizeMb: null,
    license: 'Apache-2.0',
    source: 'https://github.com/google-ai-edge/mediapipe',
    quantization: 'FP16',
  },
  faceMesh: {
    key: 'faceMesh',
    file: 'face_mesh.tflite',
    purpose: '468 landmarks for liveness (EAR / MAR / head-pose)',
    sizeMb: null,
    license: 'Apache-2.0',
    source: 'https://github.com/google-ai-edge/mediapipe',
    quantization: 'FP16',
  },
  faceEmbedder: {
    key: 'faceEmbedder',
    file: 'mobilefacenet_int8.tflite',
    purpose: '512-D face embedding (MobileFaceNet)',
    sizeMb: null,
    license: 'MIT (confirm per chosen weights — Phase 2)',
    source: 'https://github.com/sirius-ai/MobileFaceNet_TF',
    quantization: 'INT8',
  },
  antiSpoof: {
    key: 'antiSpoof',
    file: 'minifasnet_int8.tflite',
    purpose: 'Passive texture anti-spoof (MiniFASNet / Silent-Face)',
    sizeMb: null,
    license: 'Apache-2.0',
    source: 'https://github.com/minivision-ai/Silent-Face-Anti-Spoofing',
    quantization: 'INT8',
  },
};

/**
 * Loads a TFLite model via react-native-fast-tflite. Intentionally a stub in
 * Phase 1 so the JS bundle never `require()`s a model file that doesn't exist
 * yet. Wired for real in Phase 2 with `loadTensorflowModel(require(...))`.
 */
export async function loadModel(_key: keyof typeof MODELS): Promise<never> {
  throw new Error(
    'Model loading is wired in Phase 2 (react-native-fast-tflite).',
  );
}
