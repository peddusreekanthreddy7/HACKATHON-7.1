import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrameProcessor, runAtTargetFps } from 'react-native-vision-camera';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { useRunOnJS, useSharedValue } from 'react-native-worklets-core';

import { generateAnchors, decodeFaces, DEFAULT_DECODE_OPTIONS } from '../ai/blazeface';
import { enhanceForDetection, DEFAULT_ENHANCE_OPTIONS } from '../ai/preprocessing';
import {
  decodeLandmarks,
  averageEAR,
  smileRatio,
  estimateHeadPose,
  FACEMESH_INPUT_SIZE,
} from '../ai/facemesh';
import {
  expandedCropRect,
  scoreAntiSpoof,
  ANTISPOOF_INPUT_SIZE,
  ANTISPOOF_CROP_SCALE,
} from '../ai/antispoof';
import {
  initLiveness,
  advanceLiveness,
  pickChallenges,
  DEFAULT_LIVENESS_CONFIG,
  CHALLENGE_PROMPT,
  type LivenessConfig,
  type LivenessState,
  type LivenessFrame,
} from '../liveness';
import { DETECTOR_INPUT_SIZE } from '../utils/constants';

/** Crop padding around the detected box when feeding Face Mesh. */
const MESH_CROP_SCALE = 1.5;

/** Throttle the 3-model pipeline to keep CPU sane on 3 GB devices. */
const LIVENESS_FPS = 8;

interface Metrics {
  facePresent: boolean;
  ear: number;
  smileRatio: number;
  yawDeg: number;
  antiSpoofReal: boolean | null;
}

type ModelPhase = 'loading' | 'loaded' | 'error';

export interface UseLiveness {
  frameProcessor: ReturnType<typeof useFrameProcessor>;
  liveness: LivenessState;
  prompt: string;
  reset: () => void;
  models: { detector: ModelPhase; mesh: ModelPhase; antiSpoof: ModelPhase };
}

/**
 * End-to-end offline liveness:
 *   frame → BlazeFace → Face Mesh (EAR/MAR/yaw) → MiniFASNet (passive anti-spoof)
 *        → metrics → JS thread → liveness FSM (gate + challenges)
 *
 * FIX (Phase 7): TensorflowModel (Nitro HybridObject) must NOT appear in
 * useFrameProcessor deps. Putting one there causes vision-camera to call
 * setFrameProcessor while Nitro serialises the closure for the worklet runtime;
 * that serialisation accesses .outputs/.inputs before NativeState is ready.
 * Solution: store each model in a useSharedValue. SharedValues are cross-runtime
 * containers — their reference is stable (no setFrameProcessor re-call) and
 * their .value is safely readable on the worklet thread.
 */
export function useLiveness(
  config: LivenessConfig = DEFAULT_LIVENESS_CONFIG,
): UseLiveness {
  const detector = useTensorflowModel(require('../../models/blazeface.tflite'), []);
  const mesh     = useTensorflowModel(require('../../models/face_landmark.tflite'), []);
  // Placeholder until `python scripts/convert_minifasnet.py` produces the real model.
  // Until then state = 'error' → antiSpoofReal = null → FSM fails closed (secure).
  const antiSpoof = useTensorflowModel(require('../../models/minifasnet.tflite'), []);

  // ─── SharedValues: models stored here, NEVER in useFrameProcessor deps ──────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detModelSV   = useSharedValue<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meshModelSV  = useSharedValue<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const spoofModelSV = useSharedValue<any>(null);

  useEffect(() => {
    detModelSV.value = detector.state === 'loaded' ? (detector.model ?? null) : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detector.state, detector.model]);

  useEffect(() => {
    meshModelSV.value = mesh.state === 'loaded' ? (mesh.model ?? null) : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesh.state, mesh.model]);

  useEffect(() => {
    spoofModelSV.value = antiSpoof.state === 'loaded' ? (antiSpoof.model ?? null) : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [antiSpoof.state, antiSpoof.model]);

  const anchors = useMemo(() => generateAnchors(), []);
  const { resize } = useResizePlugin();

  const [challenges] = useState(() =>
    pickChallenges(Math.random, config.challengeCount),
  );
  const stateRef = useRef<LivenessState>(initLiveness(challenges));
  const [liveness, setLiveness] = useState<LivenessState>(stateRef.current);

  const reset = useCallback(() => {
    const next = initLiveness(pickChallenges(Math.random, config.challengeCount));
    stateRef.current = next;
    setLiveness(next);
  }, [config.challengeCount]);

  // Worklet → JS: stamp time here, advance the FSM, push UI state.
  const onMetrics = useRunOnJS((m: Metrics) => {
    const frame: LivenessFrame = { now: Date.now(), ...m };
    const next = advanceLiveness(stateRef.current, frame, config);
    if (next !== stateRef.current) {
      stateRef.current = next;
      setLiveness(next);
    }
  }, [config]);

  const frameProcessor = useFrameProcessor(
    frame => {
      'worklet';
      runAtTargetFps(LIVENESS_FPS, () => {
        'worklet';
        // Read models from SharedValues — safe on the worklet thread.
        const dm = detModelSV.value;
        const mm = meshModelSV.value;
        const sm = spoofModelSV.value;

        if (dm == null) {
          onMetrics({ facePresent: false, ear: 0, smileRatio: 0, yawDeg: 0, antiSpoofReal: null });
          return;
        }

        // 1) Detect + lighting-normalize for robustness.
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

        let face = null;
        if (detOut.length >= 2) {
          const a = new Float32Array(detOut[0]);
          const b = new Float32Array(detOut[1]);
          const reg = a.length >= b.length ? a : b;
          const sc  = a.length >= b.length ? b : a;
          const faces = decodeFaces(reg, sc, anchors, DEFAULT_DECODE_OPTIONS);
          if (faces.length > 0) face = faces[0];
        }
        if (face == null) {
          onMetrics({ facePresent: false, ear: 0, smileRatio: 0, yawDeg: 0, antiSpoofReal: null });
          return;
        }

        // 2) Face Mesh → blink / smile / turn signals.
        let ear = 0;
        let smile = 0;
        let yaw = 0;
        if (mm != null) {
          const crop = expandedCropRect(face.bbox, frame.width, frame.height, MESH_CROP_SCALE);
          const meshIn = resize(frame, {
            crop,
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
          ear   = averageEAR(lm);
          smile = smileRatio(lm);
          yaw   = estimateHeadPose(lm, config.yawScale, config.pitchScale).yaw;
        }

        // 3) Passive anti-spoof on a context-padded crop.
        let antiSpoofReal: boolean | null = null;
        if (sm != null) {
          const crop = expandedCropRect(face.bbox, frame.width, frame.height, ANTISPOOF_CROP_SCALE);
          const spoofIn = resize(frame, {
            crop,
            scale: { width: ANTISPOOF_INPUT_SIZE, height: ANTISPOOF_INPUT_SIZE },
            pixelFormat: 'rgb',
            dataType: 'float32',
          });
          const spoofOut = sm.runSync([spoofIn.buffer]);
          antiSpoofReal = scoreAntiSpoof(new Float32Array(spoofOut[0]), {
            realClassIndex: config.antiSpoof.realClassIndex,
            realThreshold:  config.antiSpoof.realThreshold,
          }).real;
        }

        onMetrics({ facePresent: true, ear, smileRatio: smile, yawDeg: yaw, antiSpoofReal });
      });
    },
    // Only stable values in deps — SharedValue references never change.
    [detModelSV, meshModelSV, spoofModelSV, anchors, resize, onMetrics, config],
  );

  const current = liveness.challenges[liveness.currentIndex];
  const prompt =
    liveness.phase === 'antispoof'
      ? 'Hold still — checking it\'s really you…'
      : liveness.phase === 'passed'
        ? 'Liveness confirmed ✓'
        : liveness.phase === 'failed'
          ? 'Liveness failed — try again'
          : current
            ? CHALLENGE_PROMPT[current.type]
            : '';

  return {
    frameProcessor,
    liveness,
    prompt,
    reset,
    models: { detector: detector.state, mesh: mesh.state, antiSpoof: antiSpoof.state },
  };
}
