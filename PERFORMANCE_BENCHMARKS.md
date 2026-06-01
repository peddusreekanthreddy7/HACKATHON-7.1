# Performance Benchmarks

Running log for grading (Feasibility + Scalability + Presentation). **No invented
numbers** — anything needing hardware is tagged **MEASURE ON DEVICE**. Targets
below are *design budgets*, explicitly distinguished from *measurements*.

_Last updated: Phase 4 — MobileFaceNet embedding + SQLCipher enrollment wired.
All latency figures are MEASURE ON DEVICE (sandbox loopback blocks the native build).
Latency breakdowns are logged to console at runtime via `src/utils/latency.ts`
and printed in the format below — paste measured values into this table._

## 1. Model footprint — hard constraint #2 (≤ 20 MB)

Run `npm run verify:models` to compute the live total.

| Model | Quant | On-disk (measured) | Notes |
|-------|-------|---------------------|-------|
| BlazeFace short-range | FP16 | **0.23 MB** ✓ | real model, bundled |
| Face Mesh (468 landmarks) | FP16 | **1.24 MB** ✓ | real model, bundled |
| MobileFaceNet | FP32 | **5.23 MB** ✓ | real model, bundled (192-D) |
| MiniFASNet V2 | INT8 | placeholder (run `convert_minifasnet.py`) | ~1.7 MB expected after quantisation |
| **Total (real models)** | | **6.71 MB / 20 MB** ✓ | well within budget |

**Compression (Phase 6):** the open-source pipeline in `ml/` (INT8 PTQ + optional
pruning/distillation) drops MobileFaceNet **5.23 MB → < 2 MB** — see
[docs/COMPRESSION_REPORT.md](docs/COMPRESSION_REPORT.md). Run `ml/quantize.py` to
regenerate; the current build ships the FP32 model (within budget either way).

## 2. End-to-end latency — hard constraint #3 (< 1 s passive)

Target device: mid-range, **3 GB RAM, no high-end GPU**.

Latency is stamped per-frame in `useRecognition` (JS Date.now() — not the nanosecond
VisionCamera timestamp, which requires the native build). Replace `MEASURE ON DEVICE`
with real values from the console log once the native build runs.

| Stage | Budget (target) | Measured |
|-------|-----------------|----------|
| Frame acquire + preprocess | ~20 ms | MEASURE ON DEVICE |
| Face detect (BlazeFace) | ~10 ms | MEASURE ON DEVICE |
| Landmarks (Face Mesh 468-pt) | ~10 ms | MEASURE ON DEVICE |
| 5-pt alignment (Umeyama warp) | ~2 ms | MEASURE ON DEVICE |
| Embedding (MobileFaceNet INT8) | ~25 ms | MEASURE ON DEVICE |
| Anti-spoof (MiniFASNet INT8) | ~25 ms | MEASURE ON DEVICE |
| 1:N cosine match (N ≤ 500) | ~5 ms | MEASURE ON DEVICE |
| **Passive total** | **< 1000 ms** | **MEASURE ON DEVICE** |

How to capture: run the app, complete a liveness+recognition session, filter
`adb logcat` for the `[Latency]` tag emitted by `useRecognition`.

Active challenge (blink / smile / turn) is human-paced UX time — not inference
latency; reported separately.

## 3. Accuracy — hard constraint #5 (> 95%)

| Metric | Target | Status |
|--------|--------|--------|
| Cosine threshold for ~95% TAR | 0.6 | Design decision — calibrate on device (Phase 7) |
| Verification accuracy (TAR @ FAR) | > 95% | MEASURE ON DEVICE (Phase 7) |
| Robustness: harsh sun / low light | no >X% drop | MEASURE ON DEVICE (Phase 7) |
| Liveness spoof-rejection (print/replay) | high | Passive MiniFASNet gate + active challenges |

**5-point alignment benefit:** the Umeyama similarity warp corrects for in-plane
rotation and scale variance, which is the dominant source of false-reject on
tilted heads.  Expected improvement over unaligned crops: ~3–5% TAR at FAR 0.01
(literature figure — confirm on device with Indian demographic samples).

## 4. Enrollment & match performance

| Operation | Input | Complexity | Notes |
|-----------|-------|------------|-------|
| Enroll | 7 frames × embed | O(7) | Runs once; averaged embedding stored in SQLCipher |
| 1:N match | 1 embed vs gallery | O(N · dim) = O(512N) | Linear scan; up to N=500 before sub-linear index needed |
| SQLCipher read latency | full gallery | ~5 ms (est.) | WAL mode; MEASURE ON DEVICE |

## 5. Device test matrix (to be filled in Phase 7)

| Device | RAM | OS | Cold start | Passive E2E | Notes |
|--------|-----|----|-----------|-------------|-------|
| _mid-range Android_ | 3 GB | Android 8–13 | TBD | TBD | MEASURE ON DEVICE |
| _budget Android_ | 2–3 GB | Android 10+ | TBD | TBD | MEASURE ON DEVICE |
| _iPhone (≥ 15.1)_ | — | iOS 15.1+ | TBD | TBD | MEASURE ON DEVICE |

## 6. Methodology (locked)

- Latency = median of N≥50 runs after a warm-up (JS `Date.now()` for Phase 4;
  replace with VisionCamera's frame timestamp in Phase 5 for sub-millisecond accuracy).
- Footprint = on-disk bytes of bundled model assets (`npm run verify:models`).
- Accuracy = held-out eval set, never used for threshold tuning.
- All thresholds (EAR, MAR, yaw, cosine) are in `DEFAULT_LIVENESS_CONFIG` and
  `DEFAULT_EMBEDDING_CONFIG` — configurable without code changes.
