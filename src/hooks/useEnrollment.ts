import { useCallback, useRef, useState } from 'react';
import { useFrameProcessor, runAtTargetFps } from 'react-native-vision-camera';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { useRunOnJS } from 'react-native-worklets-core';

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
  embeddingToBuffer,
  DEFAULT_EMBEDDING_CONFIG,
  type Embedding,
} from '../ai/embedding';
import { getDb, insertEnrollment, countEnrollments } from '../db';
import { DETECTOR_INPUT_SIZE, EMBEDDING_DIM } from '../utils/constants';

/** How many frames to average into one enrollment embedding. */
const ENROLLMENT_FRAMES = 7;
/** Dev-only placeholder encryption key — Phase 5 replaces with Keystore secret. */
const DEV_KEY = 'dev-placeholder-key-phase5-will-rotate';
/** Embedding model version tag stored alongside each enrollment row. */
const MODEL_VERSION = 'mobilefacenet-int8-v1';

export type EnrollmentPhase = 'idle' | 'capturing' | 'saving' | 'done' | 'error';

export interface UseEnrollment {
  frameProcessor: ReturnType<typeof useFrameProcessor>;
  phase: EnrollmentPhase;
  captured: number;
  total: number;
  /** Start a new enrollment session for the given person. */
  start: (personId: string, displayName: string) => void;
  /** Abort and reset. */
  reset: () => void;
  error: string | null;
}

interface Session {
  personId: string;
  displayName: string;
}

export function useEnrollment(): UseEnrollment {
  const detector = useTensorflowModel(require('../../models/blazeface.tflite'));
  const mesh = useTensorflowModel(require('../../models/face_landmark.tflite'));
  const embedder = useTensorflowModel(require('../../models/mobilefacenet.tflite'));

  const detModel = detector.state === 'loaded' ? detector.model : undefined;
  const meshModel = mesh.state === 'loaded' ? mesh.model : undefined;
  const embedModel = embedder.state === 'loaded' ? embedder.model : undefined;

  const anchors = generateAnchors();
  const { resize } = useResizePlugin();

  const sessionRef = useRef<Session | null>(null);
  const embeddingsRef = useRef<Embedding[]>([]);

  const [phase, setPhase] = useState<EnrollmentPhase>('idle');
  const [captured, setCaptured] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    sessionRef.current = null;
    embeddingsRef.current = [];
    setPhase('idle');
    setCaptured(0);
    setError(null);
  }, []);

  const start = useCallback((personId: string, displayName: string) => {
    embeddingsRef.current = [];
    sessionRef.current = { personId, displayName };
    setPhase('capturing');
    setCaptured(0);
    setError(null);
  }, []);

  /** Called on JS thread when we have a new embedding from the worklet. */
  const onEmbedding = useRunOnJS((embedding: number[], workletNorm: number) => {
    const session = sessionRef.current;
    if (!session) return;

    const vec = new Float32Array(embedding);
    let n = 0;
    for (let i = 0; i < vec.length; i++) n += vec[i] * vec[i];
    // workletNorm = norm computed INSIDE the worklet (before the bridge).
    // jsNorm = norm AFTER crossing the worklet→JS bridge.
    // If workletNorm≈1 but jsNorm≈0, the bridge serialisation dropped the data.
    console.log(
      `[Enroll] frame len=${vec.length} workletNorm=${workletNorm.toFixed(4)} jsNorm=${Math.sqrt(n).toFixed(4)}`,
    );
    embeddingsRef.current.push(vec);
    const count = embeddingsRef.current.length;
    setCaptured(count);

    if (count < ENROLLMENT_FRAMES) return;

    // Enough frames collected — average, store, done.
    setPhase('saving');
    try {
      const avgEmbedding = averageEmbeddings(embeddingsRef.current);
      let an = 0;
      for (let i = 0; i < avgEmbedding.length; i++) an += avgEmbedding[i] * avgEmbedding[i];
      console.log(
        `[Enroll] AVG len=${avgEmbedding.length} norm=${Math.sqrt(an).toFixed(4)} — storing now`,
      );
      const db = getDb(DEV_KEY);
      insertEnrollment(db, {
        id: `${session.personId}-${Date.now()}`,
        personId: session.personId,
        displayName: session.displayName,
        embedding: avgEmbedding,
        modelVersion: MODEL_VERSION,
      });
      // Fix E — registration verification logging.
      console.log('✅ Face saved:', session.personId);
      console.log('📐 Embedding size:', avgEmbedding.length);
      console.log('💾 DB row count:', countEnrollments(db));
      sessionRef.current = null;
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
        if (detModel == null || meshModel == null || embedModel == null) return;

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
        const detOut = detModel.runSync([detInput]) as Float32Array[];
        if (detOut.length < 2) return;

        const a = new Float32Array(detOut[0]);
        const b = new Float32Array(detOut[1]);
        const reg = a.length >= b.length ? a : b;
        const sc = a.length >= b.length ? b : a;
        const faces = decodeFaces(reg, sc, anchors, DEFAULT_DECODE_OPTIONS);
        if (faces.length === 0) return;
        const face = faces[0];

        // 2. Run Face Mesh to get 5 alignment landmarks.
        const meshCrop = {
          x: Math.round(face.bbox.x * frame.width),
          y: Math.round(face.bbox.y * frame.height),
          width: Math.round(face.bbox.width * frame.width),
          height: Math.round(face.bbox.height * frame.height),
        };
        const meshIn = resize(frame, {
          crop: meshCrop,
          scale: { width: FACEMESH_INPUT_SIZE, height: FACEMESH_INPUT_SIZE },
          pixelFormat: 'rgb',
          dataType: 'float32',
        });
        const meshOut = meshModel.runSync([meshIn]) as Float32Array[];
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

        // 4. Crop + resize to MobileFaceNet input (112x112), normalise to
        //    [-1,1] exactly as the model expects: (px - 128) / 128.
        const embedSmall = resize(frame, {
          crop: { x: crop.x, y: crop.y, width: crop.width, height: crop.height },
          scale: { width: MOBILEFACENET_INPUT_SIZE, height: MOBILEFACENET_INPUT_SIZE },
          pixelFormat: 'rgb',
          dataType: 'uint8',
        });
        const embedInput = new Float32Array(embedSmall.length);
        for (let i = 0; i < embedSmall.length; i++) embedInput[i] = (embedSmall[i] - 128) / 128;

        // 5. Run embedding model.
        const embedOut = embedModel.runSync([embedInput]) as Float32Array[];
        const embedding = decodeEmbedding(embedOut[0], {
          ...DEFAULT_EMBEDDING_CONFIG,
          dim: EMBEDDING_DIM,
        });

        // Pass back to JS thread as a plain number[] (worklet-serialisable).
        // IMPORTANT: build the array with an explicit loop. `Array.from()` is
        // NOT reliable inside react-native-worklets-core — it can yield an
        // empty/zero array, which is exactly how an all-zero embedding gets
        // stored (g0Norm=0 → "No match · 0%"). Also compute the norm here, in
        // the worklet, so we can prove the embedding was good pre-bridge.
        const out = [];
        let wn = 0;
        for (let i = 0; i < embedding.length; i++) {
          out.push(embedding[i]);
          wn += embedding[i] * embedding[i];
        }
        onEmbedding(out, Math.sqrt(wn));
      });
    },
    [detModel, meshModel, embedModel, anchors, resize, onEmbedding],
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
