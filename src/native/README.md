# `src/native`

Custom React Native native modules (Kotlin / Swift / C++) live here when the
pure JS + worklet path can't meet the performance budget.

Likely candidates (added only if benchmarks demand it):

- **Frame pre-processor** — YUV→RGB conversion, crop & resize on the native side
  before handing tensors to TFLite (avoids JS-thread copies).
- **Delegate selector** — choose NNAPI / GPU (Android) or Core ML (iOS) at
  runtime with a CPU fallback, to hit the < 1s end-to-end target.

Empty in Phase 1 — we prefer the dependency-light JS/worklet path first and
only drop to native if `PERFORMANCE_BENCHMARKS.md` shows we must.
