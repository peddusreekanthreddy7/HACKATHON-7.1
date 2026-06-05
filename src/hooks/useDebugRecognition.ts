import { useCallback, useMemo, useRef, useState } from 'react';
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
  DEFAULT_EMBEDDING_CONFIG,
  type EnrolledRecord,
} from '../ai/embedding';
import { getDb, getAllEnrollments } from '../db';
import { DETECTOR_INPUT_SIZE, EMBEDDING_DIM } from '../utils/constants';

const DEV_KEY = 'dev-placeholder-key-phase5-will-rotate';

export interface DebugRecResult {
  /** Raw best cosine score against the gallery (no pass/fail), or null. */
  score: number | null;
  /** Best-matching enrolled name, or null. */
  name: string | null;
  galleryCount: number;
}

export interface UseDebugRecognition {
  frameProcessor: ReturnType<typeof useFrameProcessor>;
  result: DebugRecResult;
  /** Reload the gallery from the DB (call when the camera opens). */
  refresh: () => void;
}

// Module-level gallery the worklet reads. Embeddings are plain number[] so the
// data survives capture into the worklet (a Float32Array would arrive as zeros).
let debugGallery: EnrolledRecord[] = [];

/**
 * Debug-only continuous face recognizer for the Admin Debug Panel.
 *
 * Self-contained: it reuses the pure AI modules (detect → mesh → align → embed
 * → match) and does NOT touch the production `useRecognition`/`useLiveness`
 * services. It is liveness-free and reports the RAW best cosine score every
 * frame so the operator can hold up faces/photos and calibrate the threshold.
 */
export function useDebugRecognition(): UseDebugRecognition {
  const detector = useTensorflowModel(require('../../models/blazeface.tflite'));
  const mesh = useTensorflowModel(require('../../models/face_landmark.tflite'));
  const embedder = useTensorflowModel(require('../../models/mobilefacenet.tflite'));

  const detModel = detector.state === 'loaded' ? detector.model : undefined;
  const meshModel = mesh.state === 'loaded' ? mesh.model : undefined;
  const embedModel = embedder.state === 'loaded' ? embedder.model : undefined;

  const anchors = useMemo(() => generateAnchors(), []);
  const { resize } = useResizePlugin();

  const [result, setResult] = useState<DebugRecResult>({
    score: null,
    name: null,
    galleryCount: 0,
  });

  const refresh = useCallback(() => {
    try {
      const db = getDb(DEV_KEY);
      debugGallery = getAllEnrollments(db).map(r => ({
        personId: r.personId,
        displayName: r.displayName,
        embedding: Array.from(r.embedding), // number[] survives the worklet boundary
      }));
    } catch {
      debugGallery = [];
    }
    setResult(r => ({ ...r, galleryCount: debugGallery.length }));
  }, []);

  const onScore = useRunOnJS((score: number, name: string, count: number) => {
    setResult({ score, name: name || null, galleryCount: count });
  }, []);

  const frameProcessor = useFrameProcessor(
    frame => {
      'worklet';
      runAtTargetFps(2, () => {
        'worklet';
        if (detModel == null || meshModel == null || embedModel == null) return;

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

        const pts5 = extract5Points(lm);
        const pixPts5 = pts5.map(p => ({
          x: meshCrop.x + p.x * meshCrop.width,
          y: meshCrop.y + p.y * meshCrop.height,
        }));
        const crop = alignedCropParams(pixPts5, frame.width, frame.height);

        const embedSmall = resize(frame, {
          crop: { x: crop.x, y: crop.y, width: crop.width, height: crop.height },
          scale: { width: MOBILEFACENET_INPUT_SIZE, height: MOBILEFACENET_INPUT_SIZE },
          pixelFormat: 'rgb',
          dataType: 'uint8',
        });
        const embedInput = new Float32Array(embedSmall.length);
        for (let i = 0; i < embedSmall.length; i++) embedInput[i] = (embedSmall[i] - 128) / 128;
        const embedOut = embedModel.runSync([embedInput]) as Float32Array[];
        const query = decodeEmbedding(embedOut[0], {
          ...DEFAULT_EMBEDDING_CONFIG,
          dim: EMBEDDING_DIM,
        });

        const gallery = debugGallery;
        const match = findBestMatch(query, gallery, {
          ...DEFAULT_EMBEDDING_CONFIG,
          dim: EMBEDDING_DIM,
        });
        if (match) onScore(match.score, match.displayName, gallery.length);
        else onScore(-1, '', gallery.length);
      });
    },
    [detModel, meshModel, embedModel, anchors, resize, onScore],
  );

  return { frameProcessor, result, refresh };
}
