import { useCallback, useRef, useState } from 'react';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { useRunOnJS } from 'react-native-worklets-core';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { useFrameProcessor, runAtTargetFps } from 'react-native-vision-camera';

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
  findBestMatch,
  scoreToConfidence,
  bufferToEmbedding,
  DEFAULT_EMBEDDING_CONFIG,
  type MatchResult,
  type EnrolledRecord,
} from '../ai/embedding';
import { getDb, getAllEnrollments } from '../db';
import {
  calcLatency,
  RunningStats,
  formatBenchmarkRow,
  type LatencyStamps,
} from '../utils/latency';
import { DETECTOR_INPUT_SIZE, EMBEDDING_DIM } from '../utils/constants';
import { DEFAULT_LIVENESS_CONFIG } from '../liveness';
import type { LivenessState } from '../liveness';

const DEV_KEY = 'dev-placeholder-key-phase5-will-rotate';

export type RecognitionPhase = 'waiting-liveness' | 'running' | 'done' | 'no-match' | 'error';

export interface RecognitionResult {
  match: MatchResult | null;
  confidence: number | null;
  latencyMs: number | null;
}

export interface UseRecognition {
  frameProcessor: ReturnType<typeof useFrameProcessor>;
  phase: RecognitionPhase;
  result: RecognitionResult;
  /** Call this with the updated liveness state on every render. */
  onLivenessUpdate: (s: LivenessState) => void;
  reset: () => void;
}

/**
 * Liveness-gated face recognition.
 * The recognition pipeline fires ONCE when liveness.phase transitions to
 * 'passed'. It embeds the live face, matches it against the encrypted gallery,
 * and reports the best match + latency breakdown.
 */
export function useRecognition(): UseRecognition {
  const detector = useTensorflowModel(require('../../models/blazeface.tflite'));
  const mesh = useTensorflowModel(require('../../models/face_landmark.tflite'));
  const embedder = useTensorflowModel(require('../../models/mobilefacenet.tflite'));

  const detModel = detector.state === 'loaded' ? detector.model : undefined;
  const meshModel = mesh.state === 'loaded' ? mesh.model : undefined;
  const embedModel = embedder.state === 'loaded' ? embedder.model : undefined;

  const anchors = generateAnchors();
  const { resize } = useResizePlugin();

  // Whether we should grab the next frame for recognition.
  const triggerRef = useRef(false);
  // Per-session running stats (populated when model runs on device).
  const stats = useRef(new RunningStats());

  const livenessRef = useRef<LivenessState | null>(null);
  const [phase, setPhase] = useState<RecognitionPhase>('waiting-liveness');
  const [result, setResult] = useState<RecognitionResult>({
    match: null,
    confidence: null,
    latencyMs: null,
  });

  const reset = useCallback(() => {
    triggerRef.current = false;
    livenessRef.current = null;
    setPhase('waiting-liveness');
    setResult({ match: null, confidence: null, latencyMs: null });
  }, []);

  const onLivenessUpdate = useCallback((s: LivenessState) => {
    if (s.phase === 'passed' && livenessRef.current?.phase !== 'passed') {
      triggerRef.current = true;
      setPhase('running');
    }
    if (s.phase === 'failed') reset();
    livenessRef.current = s;
  }, [reset]);

  const onRecognitionResult = useRunOnJS(
    (stamps: LatencyStamps, matchJson: string) => {
      const breakdown = calcLatency(stamps);
      stats.current.push(breakdown.totalMs);

      // Log to console for PERFORMANCE_BENCHMARKS.md (MEASURE ON DEVICE).
      console.log('[Latency]', JSON.stringify(breakdown));
      console.log('[Benchmark row]\n' + formatBenchmarkRow(breakdown));

      const match: MatchResult | null = JSON.parse(matchJson);
      if (!match) {
        setPhase('no-match');
        setResult({ match: null, confidence: null, latencyMs: breakdown.totalMs });
        return;
      }
      const confidence = scoreToConfidence(match.score, DEFAULT_EMBEDDING_CONFIG.matchThreshold);
      setPhase('done');
      setResult({ match, confidence, latencyMs: breakdown.totalMs });
    },
    [],
  );

  const frameProcessor = useFrameProcessor(
    frame => {
      'worklet';
      if (!triggerRef.current) return;

      runAtTargetFps(1, () => {
        'worklet';
        triggerRef.current = false; // fire once
        if (detModel == null || meshModel == null || embedModel == null) return;

        const stamps: Partial<LatencyStamps> = {};
        stamps.frameAcquired = Date.now();

        // 1. Detect.
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
        stamps.detectDone = Date.now();

        if (detOut.length < 2) return;
        const a = new Float32Array(detOut[0]);
        const b = new Float32Array(detOut[1]);
        const reg = a.length >= b.length ? a : b;
        const sc = a.length >= b.length ? b : a;
        const faces = decodeFaces(reg, sc, anchors, DEFAULT_DECODE_OPTIONS);
        if (faces.length === 0) return;
        const face = faces[0];

        // 2. Face Mesh landmarks.
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
        stamps.landmarkDone = Date.now();

        // 3. 5-point alignment.
        const pts5 = extract5Points(lm);
        const pixPts5 = pts5.map(p => ({
          x: meshCrop.x + p.x * meshCrop.width,
          y: meshCrop.y + p.y * meshCrop.height,
        }));
        const crop = alignedCropParams(pixPts5, frame.width, frame.height);
        stamps.alignDone = Date.now();

        // 4. Embed — normalise to [-1,1] as (px - 128) / 128.
        const embedSmall = resize(frame, {
          crop: { x: crop.x, y: crop.y, width: crop.width, height: crop.height },
          scale: { width: MOBILEFACENET_INPUT_SIZE, height: MOBILEFACENET_INPUT_SIZE },
          pixelFormat: 'rgb',
          dataType: 'uint8',
        });
        const embedInput = new Float32Array(embedSmall.length);
        for (let i = 0; i < embedSmall.length; i++) embedInput[i] = (embedSmall[i] - 128) / 128;
        const embedOut = embedModel.runSync([embedInput]) as Float32Array[];
        const queryEmbedding = decodeEmbedding(embedOut[0], {
          ...DEFAULT_EMBEDDING_CONFIG,
          dim: EMBEDDING_DIM,
        });
        stamps.embedDone = Date.now();

        // 5. Match against gallery (loaded from DB on JS thread, passed via closure).
        // Gallery is loaded synchronously from the DB below on the JS thread;
        // the worklet closure captures it via `galleryRef`.
        const gallery = galleryRef;
        const match = findBestMatch(queryEmbedding, gallery, {
          ...DEFAULT_EMBEDDING_CONFIG,
          dim: EMBEDDING_DIM,
        });
        stamps.matchDone = Date.now();

        onRecognitionResult(
          stamps as LatencyStamps,
          JSON.stringify(match),
        );
      });
    },
    [detModel, meshModel, embedModel, anchors, resize, onRecognitionResult],
  );

  return { frameProcessor, phase, result, onLivenessUpdate, reset };
}

// ---------------------------------------------------------------------------
// Gallery cache — loaded once per hook mount from the encrypted DB.
// The worklet closure captures this variable directly (Reanimated shared value
// would be heavier; a plain closure ref is fine for a gallery that only changes
// on enrollment, which re-mounts the hook).
// ---------------------------------------------------------------------------
let galleryRef: EnrolledRecord[] = [];

/** Call this once when the hook mounts (or after any enrollment change). */
export function refreshGallery(): void {
  try {
    const db = getDb('dev-placeholder-key-phase5-will-rotate');
    const rows = getAllEnrollments(db);
    galleryRef = rows.map(r => ({
      personId: r.personId,
      displayName: r.displayName,
      embedding: r.embedding,
    }));
  } catch {
    galleryRef = [];
  }
}
