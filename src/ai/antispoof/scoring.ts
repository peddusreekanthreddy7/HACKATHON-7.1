import type { AntiSpoofConfig, AntiSpoofResult } from './types';

/** MiniFASNet input side length (Silent-Face models are 80x80). */
export const ANTISPOOF_INPUT_SIZE = 80;

/** Face-crop scale used by MiniFASNet (model name "2.7_80x80" → 2.7). */
export const ANTISPOOF_CROP_SCALE = 2.7;

export const DEFAULT_ANTISPOOF: AntiSpoofConfig = {
  realClassIndex: 1,
  realThreshold: 0.6,
};

/** Numerically-stable softmax. Accepts a typed array or number[]. */
export function softmax(logits: ArrayLike<number>): number[] {
  'worklet';
  let max = -Infinity;
  for (let i = 0; i < logits.length; i++) {
    if (logits[i] > max) max = logits[i];
  }
  let sum = 0;
  const probs: number[] = [];
  for (let i = 0; i < logits.length; i++) {
    const e = Math.exp(logits[i] - max);
    probs.push(e);
    sum += e;
  }
  if (sum === 0) return probs;
  for (let i = 0; i < probs.length; i++) probs[i] /= sum;
  return probs;
}

/**
 * Interpret raw MiniFASNet logits as a liveness verdict: the face is "real"
 * only if the argmax class is the real class AND its probability clears the
 * threshold. (Silent-Face fuses two models; with one model we threshold its
 * real-class probability — tune on device.)
 */
export function scoreAntiSpoof(
  logits: ArrayLike<number>,
  config: AntiSpoofConfig,
): AntiSpoofResult {
  'worklet';
  const probs = softmax(logits);
  let argmax = 0;
  for (let i = 1; i < probs.length; i++) {
    if (probs[i] > probs[argmax]) argmax = i;
  }
  const realScore = probs[config.realClassIndex] ?? 0;
  return {
    real: argmax === config.realClassIndex && realScore >= config.realThreshold,
    realScore,
  };
}
