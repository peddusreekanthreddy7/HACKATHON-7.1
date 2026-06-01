import { useCallback, useEffect, useRef, useState } from 'react';
import { useFrameProcessor, runAtTargetFps } from 'react-native-vision-camera';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { useRunOnJS, useSharedValue } from 'react-native-worklets-core';

import { generateAnchors, decodeFaces, DEFAULT_DECODE_OPTIONS } from '../ai/blazeface';
import { enhanceForDetection, DEFAULT_ENHANCE_OPTIONS } from '../ai/preprocessing';
import {
  decodeLandmarks,
  extract5Points,
  alignedCropParams,
  MOBILEFACENET_INPUT_SIZE,
  FACEMESH_INPUT_SIZE,
} from '../ai/facemesh';
import {
  decodeEmbedding,
  averageEmbeddings,
  DEFAULT_EMBEDDING_CONFIG,
  type Embedding,
} from '../ai/embedding';
import { getDb, insertEnrollment } from '../db';
import { DETECTOR_INPUT_SIZE, EMBEDDING_DIM } from '../utils/constants';

/** How many frames to average into one enrollment embedding. */
const ENROLLMENT_FRAMES = 7;
/** Dev-only placeholder encryption key — swap for Keystore secret in production. */
const DEV_KEY = 'dev-placeholder-key-phase5-will-rotate';
/** Embedding model version tag stored alongside each enrollment row. */
const MODEL_VERSION = 'mobilefacenet-int8-v1';

export type EnrollmentPhase = 'idle' | 'capturing' | 'saving' | 'done' | 'error';

export interface UseEnrollment {
  frameProcessor: ReturnType<typeof useFrameProcessor>;
  phase: EnrollmentPhase;
  captured: number;
  total: number;
  start: (personId: string, displayName: string) => void;
  reset: () => void;
  error: string | null;
}

interface Session {
  personId: string;
  displayName: string;
}

/**
 * FIX (Phase 7): TensorflowModel (Nitro HybridObject) must NOT appear in
 * useFrameProcessor deps — see useFaceDetector for the full explanation.
 * All three models are stored in useSharedValue and read inside the worklet.
 */
export function useEnrollment(): UseEnrollment {
  const detector = useTensorflowModel(require('../../models/blazeface.tflite'), []);
  const mesh     = useTensorflowModel(require('../../models/face_landmark.tflite'), []);
  const embedder = useTensorflowModel(require('../../models/mobilefacenet.tflite'), []);

  // ─── SharedValues: models stored here, NEVER in useFrameProcessor deps ──────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detModelSV   = useSharedValue<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meshModelSV  = useSharedValue<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const embedModelSV = useSharedValue<any>(null);

  useEffect(() => {
    detModelSV.value = detector.state === 'loaded' ? (detector.model ?? null) : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detector.state, detector.model]);

  useEffect(() => {
    meshModelSV.value = mesh.state === 'loaded' ? (mesh.model ?? null) : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesh.state, mesh.model]);

  useEffect(() => {
    embedModelSV.value = embedder.state === 'loaded' ? (embedder.model ?? null) : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedder.state, embedder.model]);

  const anchors = generateAnchors();
  const { resize } = useResizePlugin();

  const sessionRef    = useRef<Session | null>(null);
  const embeddingsRef = useRef<Embedding[]>([]);

  const [phase,    setPhase]    = useState<EnrollmentPhase>('idle');
  const [captured, setCaptured] = useState(0);
  const [error,    setError]    = useState<string | null>(null);

  const reset = useCallback(() => {
    sessionRef.current    = null;
    embeddingsRef.current = [];
    setPhase('idle');
    setCaptured(0);
    setError(null);
  }, []);

  const start = useCallback((personId: string, displayName: string) => {
    embeddingsRef.current = [];
    sessionRef.current    = { personId, displayName };
    setPhase('capturing');
    setCaptured(0);
    setError(null);
  }, []);

  const onEmbedding = useRunOnJS((embedding: number[]) => {
    const session = sessionRef.current;
    if (!session) return;

    const vec = new Float32Array(embedding);
    embeddingsRef.current.push(vec);
    const count = embeddingsRef.current.length;
    setCaptured(count);

    if (count < ENROLLMENT_FRAMES) return;

    setPhase('saving');
    try {
      const avgEmbedding = averageEmbeddings(embeddingsRef.current);
      const db = getDb(DEV_KEY);
      insertEnrollment(db, {
        id: `${session.personId}-${Date.now()}`,
        personId: session.personId,
        displayName: session.displayName,
        embedding: avgEmbedding,
        modelVersion: MODEL_VERSION,
      });
      sessionRef.current    = null;
      embeddingsRef.current = [];
      setPhase('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('error');
    }
  }, []);

  const frameProcessor = useFrameProcessor(
    frame => {
      'worklet';
      if (sessionRef.current === null) return;
      if (embeddingsRef.current.length >= ENROLLMENT_FRAMES) return;

      runAtTargetFps(6, () => {
        'worklet';
        // Read models from SharedValues.
        const dm = detModelSV.value;
        const mm = meshModelSV.value;
        const em = embedModelSV.value;
        if (dm == null || mm == null || em == null) return;

        // 1. Detect face.
        const size = DETECTOR_INPUT_SIZE;
        const small = resize(frame, {
          scale: { width: size, height: size },
          pixelFormat: 'rgb',
          dataType: 'uint8',
        });
        const enhanced = enhanceForDetection(small, size, size, DEFAULT_ENHANCE_OPTIONS);
        const detInput = new Float32Array(enhanced.length);
        for (let i = 0; i < enhanced.length; i++) detInput[i] = enhanced[i] / 127.5 - 1;
        const detOut = dm.runSync([detInput.buffer]);
        if (detOut.length < 2) return;

        const a = new Float32Array(detOut[0]);
        const b = new Float32Array(detOut[1]);
        const reg   = a.length >= b.length ? a : b;
        const sc    = a.length >= b.length ? b : a;
        const faces = decodeFaces(reg, sc, anchors, DEFAULT_DECODE_OPTIONS);
        if (faces.length === 0) return;
        const face = faces[0];

        // 2. Run Face Mesh to get 5 alignment landmarks.
        const meshCrop = {
          x:      Math.round(face.bbox.x      * frame.width),
          y:      Math.round(face.bbox.y      * frame.height),
          width:  Math.round(face.bbox.width  * frame.width),
          height: Math.round(face.bbox.height * frame.height),
        };
        const meshIn = resize(frame, {
          crop:  meshCrop,
          scale: { width: FACEMESH_INPUT_SIZE, height: FACEMESH_INPUT_SIZE },
          pixelFormat: 'rgb',
          dataType: 'float32',
        });
        const meshOut = mm.runSync([meshIn.buffer]);
        let lmBuf = meshOut[0];
        for (let i = 1; i < meshOut.length; i++) {
          if (meshOut[i].byteLength > lmBuf.byteLength) lmBuf = meshOut[i];
        }
        const lm = decodeLandmarks(new Float32Array(lmBuf), FACEMESH_INPUT_SIZE);

        // 3. Compute aligned crop parameters (5-pt similarity transform).
        const pts5 = extract5Points(lm);
        const pixPts5 = pts5.map(p => ({
          x: meshCrop.x + p.x * meshCrop.width,
          y: meshCrop.y + p.y * meshCrop.height,
        }));
        const crop = alignedCropParams(pixPts5, frame.width, frame.height);

        // 4. Crop + resize to 112×112, normalise: (px - 128) / 128.
        const embedSmall = resize(frame, {
          crop:  { x: crop.x, y: crop.y, width: crop.width, height: crop.height },
          scale: { width: MOBILEFACENET_INPUT_SIZE, height: MOBILEFACENET_INPUT_SIZE },
          pixelFormat: 'rgb',
          dataType: 'uint8',
        });
        const embedInput = new Float32Array(embedSmall.length);
        for (let i = 0; i < embedSmall.length; i++) embedInput[i] = (embedSmall[i] - 128) / 128;

        // 5. Run embedding model.
        const embedOut  = em.runSync([embedInput.buffer]);
        const embedding = decodeEmbedding(embedOut[0], {
          ...DEFAULT_EMBEDDING_CONFIG,
          dim: EMBEDDING_DIM,
        });

        onEmbedding(Array.from(embedding));
      });
    },
    // Only stable values in deps — SharedValue references never change.
    [detModelSV, meshModelSV, embedModelSV, anchors, resize, onEmbedding],
  );

  return {
    frameProcessor,
    phase,
    captured,
    total: ENROLLMENT_FRAMES,
    start,
    reset,
    error,
  };
}
