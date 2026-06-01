# Architecture — DatalakeFaceAuth

## 1. Goal

Offline, on-device face recognition + liveness for attendance in zero-network
areas, syncing opportunistically to AWS. Privacy-by-design: **embeddings are
stored, raw face images never are.**

## 2. Tech stack (all permissive OSS — see [LICENSES.md](../LICENSES.md))

| Concern | Choice | Version | License |
|---------|--------|---------|---------|
| App | React Native + TypeScript | 0.85.3 / 5.8 | MIT |
| Navigation | React Navigation (bottom-tabs) | 7.x | MIT |
| Camera + frames | react-native-vision-camera | 4.7.3 | MIT |
| Frame resize | vision-camera-resize-plugin | 3.2.0 | MIT |
| Worklets | react-native-worklets-core | 1.6.3 | MIT |
| Inference | react-native-fast-tflite (TFLite) | 3.0.1 | MIT / Apache-2.0 (TFLite) |
| Connectivity | @react-native-community/netinfo | 12.0.1 | MIT |
| Storage | @op-engineering/op-sqlite + SQLCipher | 16.2.0 | MIT / BSD (SQLCipher) |
| State | Zustand | 5.0.14 | MIT |

> **Mermaid diagrams:** system flowchart in
> [../TECHNICAL_DOCUMENTATION.md §1](../TECHNICAL_DOCUMENTATION.md); sync/purge
> sequence diagram in [SYNC.md](SYNC.md).

## 3. Layered architecture

```
┌──────────────────────────── UI (src/screens, src/components) ───────────────┐
│  Enroll        Verify         Sync dashboard        Admin/settings           │
└───────────────┬──────────────────────────────────────────────────┬─────────┘
                │ hooks / store (Zustand)                            │
┌───────────────▼───────────────┐   ┌────────────────────────────────▼────────┐
│  Camera + frame processors     │   │  Services (camera permissions, …)        │
│  (vision-camera + worklets)    │   └──────────────────────────────────────────┘
└───────────────┬───────────────┘
                │ tensors
┌───────────────▼───────────────────────────────────────────────────────────┐
│  AI pipeline (src/ai)  — all offline, models bundled in /models             │
│  BlazeFace ─► Face Mesh ─► MobileFaceNet (embedding) ─► MiniFASNet (spoof)  │
└───────────────┬───────────────────────────────────────────────────────────┘
                │ embedding + liveness verdict
┌───────────────▼───────────────┐   ┌─────────────────────────────────────────┐
│  Encrypted store (src/db)      │   │  Sync-and-purge (src/sync) ─► AWS        │
│  op-sqlite + SQLCipher         │◄──┤  netinfo-gated, ACK-then-purge           │
└────────────────────────────────┘   └─────────────────────────────────────────┘
```

**Why this shape:** UI/services/AI/storage/sync are independent modules so each
phase ships in isolation and the pure-logic pieces (math, liveness FSM in later
phases) stay unit-testable without a device.

## 4. Data flows

- **Enroll:** camera → detect → 5-pt align → MobileFaceNet → **192-D** embedding
  (averaged over 7 frames) → encrypt → `enrollments` table. Image discarded immediately.
- **Verify:** camera → detect → active challenge (blink/smile/turn) + passive
  anti-spoof → embedding → cosine match vs enrollments → write to
  `attendance_queue` (offline-safe).
- **Sync:** when `netinfo` reports online → POST unsynced rows to AWS (idempotent
  by id) → on `200 { acked }` → delete those rows locally. Nothing is purged
  without an ACK.

## 5. On-device AI latency budget (target — MEASURE ON DEVICE in Phase 3/7)

End-to-end **passive** path target **< 1000 ms** on a 3 GB-RAM mid-range device.
The active challenge is human-paced (seconds) and reported separately.

| Stage | Target |
|-------|--------|
| Detect (BlazeFace) | ~10 ms |
| Landmarks (Face Mesh) | ~10 ms |
| Embedding (MobileFaceNet INT8) | ~25 ms |
| Anti-spoof (MiniFASNet INT8) | ~25 ms |
| Match + overhead | ~30 ms |
| **Passive total** | **< 1 s (with NNAPI/Core ML delegate)** |

## 6. Security & privacy

- Only embeddings persist; raw frames never touch disk.
- Local DB encrypted with SQLCipher; key from Android Keystore / iOS Keychain
  (Phase 5), never hardcoded or bundled.
- Secrets via env (`.env`, gitignored); see `.env.example`.
- Sync payloads carry match metadata only — no images, no raw embeddings off-device.

## 7. Platform support & deviations

- **Android:** `minSdk 26` (Android 8.0), `compileSdk/targetSdk 36`, New
  Architecture enabled, Hermes.
- **iOS:** deployment target **15.1**. The brief asked for iOS 12, but RN 0.85
  and vision-camera require ≥ 15.1; iOS 12–14 are unsupported upstream and
  effectively absent in the field by 2026. Recorded as an accepted deviation.
- **Build toolchain:** Android requires **JDK 17** (JDK 25 on PATH will not
  build). iOS requires macOS + Xcode.
- **Path note (resolved):** the project lives at `E:\DatalakeFaceAuth` — an
  ASCII, space-free path. (It was relocated off a OneDrive path containing
  non-ASCII characters that broke the Gradle wrapper.) Keep it on an ASCII path
  for native builds.
- **Camera SDK pin (Phase 2):** `react-native-vision-camera` is pinned to
  **4.7.3**. v5 is a Nitro rewrite that removed the `useFrameProcessor` API the
  plugin ecosystem (fast-tflite, resize-plugin) depends on; v4 is the documented,
  supported real-time frame-processor path. The brief allowed "v3+".
- **Worklets/Babel (Phase 2):** `react-native-worklets-core` 1.6.3's worklet
  transform expects pre-Babel-8 plugin names, so `@babel/preset-typescript`,
  `@babel/plugin-proposal-optional-chaining` and
  `@babel/plugin-proposal-nullish-coalescing-operator` are added as devDeps.

## 8. Build status

1. ✅ **Phase 1** — scaffold, navigation, deps, native config, docs.
2. ✅ **Phase 2** — vision-camera v4 frame processor + BlazeFace + CLAHE + throttling.
3. ✅ **Phase 3** — offline liveness: Face Mesh EAR/MAR/yaw + randomized challenge FSM + MiniFASNet passive gate.
4. ✅ **Phase 4** — MobileFaceNet 192-D embeddings, 5-pt alignment, SQLCipher enrollment, cosine 1:N match.
5. ✅ **Phase 5** — attendance + sync-and-purge (retry/backoff/idempotency, ACK-then-purge) + AWS SAM + mock server.
6. ✅ **Phase 6** — open-source compression pipeline (INT8 PTQ / pruning / distillation / Indian fine-tune).
7. ✅ **Phase 7** — submission docs, mermaid diagrams, pitch deck, license proof.

**Remaining hardening:** Keystore/Keychain-derived DB key (replacing the dev
placeholder); on-device latency + accuracy measurement on target phones; ship
the `<2 MB` INT8 model from the `ml/` pipeline.
