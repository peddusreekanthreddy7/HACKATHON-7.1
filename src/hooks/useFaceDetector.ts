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
 */
export function useFaceDetector(): FaceDetector {
  // CPU delegate for a guaranteed load on every device. The 'android-gpu' /
  // 'core-ml' delegates are the latency win and get enabled + verified in
  // Phase 3 once measured on device.
  const model = useTensorflowModel(require('../../models/blazeface.tflite'));
  const actualModel = model.state === 'loaded' ? model.model : undefined;

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
        if (actualModel != null) {
          // Lighting normalization for harsh sun / low light / shadows.
          const enhanced = enhanceForDetection(
            rgb,
            size,
            size,
            DEFAULT_ENHANCE_OPTIONS,
          );
          // BlazeFace short-range expects float32 normalized to [-1, 1].
          const input = new Float32Array(enhanced.length);
          for (let i = 0; i < enhanced.length; i++) {
            input[i] = enhanced[i] / 127.5 - 1;
          }
          const outputs = actualModel.runSync([input]) as Float32Array[];
          if (outputs.length >= 2) {
            // Regressors tensor is the longer one (anchors*16); scores is anchors.
            const a = new Float32Array(outputs[0]);
            const b = new Float32Array(outputs[1]);
            const regressors = a.length >= b.length ? a : b;
            const scores = a.length >= b.length ? b : a;
            const faces = decodeFaces(
              regressors,
              scores,
              anchors,
              DEFAULT_DECODE_OPTIONS,
            );
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
    [actualModel, anchors, resize, onResult, frameCount],
  );

  return { frameProcessor, result, fps, modelState: model.state };
}
