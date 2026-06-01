import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrameProcessor, runAtTargetFps } from 'react-native-vision-camera';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { useRunOnJS, useSharedValue } from 'react-native-worklets-core';

import {
  generateAnchors,
  decodeFaces,
  DEFAULT_DECODE_OPTIONS,
  type DetectedFace,
} from '../ai/blazeface';
import {
  enhanceForDetection,
  DEFAULT_ENHANCE_OPTIONS,
  computeBrightness,
  classifyLighting,
} from '../ai/preprocessing';
import { DETECTOR_INPUT_SIZE, DETECTOR_TARGET_FPS } from '../utils/constants';

export type ModelState = 'loading' | 'loaded' | 'error';

export interface FaceScanResult {
  /** Most prominent face in normalized [0,1] coords, or null if none. */
  face: DetectedFace | null;
  /** Mean frame brightness, 0–1 (post-resize, pre-enhancement — honest reading). */
  brightness: number;
  lighting: 'dark' | 'good' | 'bright';
}

export interface FaceDetector {
  frameProcessor: ReturnType<typeof useFrameProcessor>;
  result: FaceScanResult;
  /** Measured camera throughput (frames/sec the processor sees). */
  fps: number;
  modelState: ModelState;
}

const EMPTY: FaceScanResult = { face: null, brightness: 0, lighting: 'good' };

/**
 * The live on-device face-detection pipeline:
 *   frame → resize 128² (RGB) → CLAHE enhance → BlazeFace TFLite → decode → JS
 *
 * Detection is throttled with `runAtTargetFps` to keep CPU sane on 3 GB
 * devices; every frame is still counted for an honest FPS readout.
 *
 * FIX (Phase 7): models are held in useSharedValue, NOT in useFrameProcessor deps.
 * Putting a Nitro HybridObject (TensorflowModel) directly in useFrameProcessor deps
 * causes vision-camera to call setFrameProcessor while Nitro serialises the closure;
 * that serialisation accesses .outputs/.inputs before NativeState is ready → crash.
 * SharedValues are the cross-runtime container that avoids this path entirely.
 */
export function useFaceDetector(): FaceDetector {
  const model = useTensorflowModel(require('../../models/blazeface.tflite'), []);

  // ─── SharedValue holds the loaded model so it is NEVER in useFrameProcessor deps ───
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modelSV = useSharedValue<any>(null);
  useEffect(() => {
    modelSV.value = model.state === 'loaded' ? (model.model ?? null) : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.state, model.model]);

  const anchors = useMemo(() => generateAnchors(), []);
  const { resize } = useResizePlugin();

  const [result, setResult] = useState<FaceScanResult>(EMPTY);
  const [fps, setFps] = useState(0);

  const frameCount = useSharedValue(0);
  const onResult = useRunOnJS((r: FaceScanResult) => setResult(r), []);

  // Sample the frame counter once a second on the JS thread → camera FPS.
  const lastCount = useRef(0);
  useEffect(() => {
    const id = setInterval(() => {
      const current = frameCount.value;
      setFps(current - lastCount.current);
      lastCount.current = current;
    }, 1000);
    return () => clearInterval(id);
  }, [frameCount]);

  const frameProcessor = useFrameProcessor(
    frame => {
      'worklet';
      frameCount.value += 1;

      runAtTargetFps(DETECTOR_TARGET_FPS, () => {
        'worklet';
        const size = DETECTOR_INPUT_SIZE;
        const rgb = resize(frame, {
          scale: { width: size, height: size },
          pixelFormat: 'rgb',
          dataType: 'uint8',
        });

        const stats = computeBrightness(rgb);

        let face: DetectedFace | null = null;
        // Read model from SharedValue — safe on the worklet thread.
        const m = modelSV.value;
        if (m != null) {
          // Lighting normalization for harsh sun / low light / shadows.
          const enhanced = enhanceForDetection(rgb, size, size, DEFAULT_ENHANCE_OPTIONS);
          // BlazeFace short-range expects float32 normalized to [-1, 1].
          const input = new Float32Array(enhanced.length);
          for (let i = 0; i < enhanced.length; i++) {
            input[i] = enhanced[i] / 127.5 - 1;
          }
          const outputs = m.runSync([input.buffer]);
          if (outputs.length >= 2) {
            const a = new Float32Array(outputs[0]);
            const b = new Float32Array(outputs[1]);
            const regressors = a.length >= b.length ? a : b;
            const scores = a.length >= b.length ? b : a;
            const faces = decodeFaces(regressors, scores, anchors, DEFAULT_DECODE_OPTIONS);
            if (faces.length > 0) face = faces[0];
          }
        }

        onResult({
          face,
          brightness: stats.normalized,
          lighting: classifyLighting(stats.normalized),
        });
      });
    },
    // modelSV is a stable SharedValue reference — its identity never changes,
    // so setFrameProcessor is called ONCE and stays installed.
    [modelSV, anchors, resize, onResult, frameCount],
  );

  return { frameProcessor, result, fps, modelState: model.state };
}
