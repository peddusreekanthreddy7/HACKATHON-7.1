# DatalakeFaceAuth

Fully **offline, on-device** facial recognition + liveness detection for
field-personnel attendance in **zero-network remote areas**. React Native
(TypeScript), Android **8.0+** and iOS **15.1+**.

> Recognise a person and prove they're physically present — **active**
> challenge-response **and** passive anti-spoof — with **no internet**, store the
> result encrypted, then sync to AWS only when a network returns and **purge
> locally only after a confirmed ACK**.

---

## Submission deliverables (Phase 7)

| Deliverable | File |
|-------------|------|
| Setup / build / run / demo | this **README.md** |
| Full technical documentation | [TECHNICAL_DOCUMENTATION.md](TECHNICAL_DOCUMENTATION.md) |
| Drop-in integration guide | [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md) |
| License proof (zero paid) | [LICENSES.md](LICENSES.md) |
| Architecture + data flow | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Sync/purge lifecycle (mermaid) | [docs/SYNC.md](docs/SYNC.md) |
| Compression / optimization | [docs/COMPRESSION_REPORT.md](docs/COMPRESSION_REPORT.md) |
| Performance benchmarks | [PERFORMANCE_BENCHMARKS.md](PERFORMANCE_BENCHMARKS.md) |
| Pitch deck outline (12–15 slides) | [PITCH_DECK.md](PITCH_DECK.md) |

### How deliverables map to the scoring criteria

| Criterion (weight) | Where it's earned |
|--------------------|-------------------|
| **Innovation (30)** | On-device 3-model liveness fusion (active FSM + passive MiniFASNet); INT8 compression pipeline `<2 MB` (`ml/`, COMPRESSION_REPORT); 5-pt Umeyama alignment; worklet-safe + 100% unit-tested AI math |
| **Feasibility (30)** | Runs offline on 3 GB devices; real bundled models (6.71 MB); 56 passing tests; tsc-clean; Metro bundle green; live sync round-trip verified; honest MEASURE-ON-DEVICE labelling |
| **Scalability (20)** | Serverless AWS SAM (API GW → Lambda → DynamoDB, pay-per-request, idempotent); 1:N cosine match; sync-and-purge keeps device storage bounded; INTEGRATION_GUIDE for Datalake 3.0 |
| **Presentation (20)** | This doc set + mermaid diagrams + PITCH_DECK + demo script below |

---

## Hard-constraints scorecard (final)

| # | Constraint | Status |
|---|------------|--------|
| 1 | Cross-platform RN, Android 8+ / iOS | ✅ Android `minSdk 26`; iOS **15.1+** (deviation documented) |
| 2 | AI footprint ≤ 20 MB | ✅ **6.71 MB** (`npm run verify:models`); `<2 MB` INT8 path in `ml/` |
| 3 | Recognition + liveness < 1 s | ⏳ budget wired + per-stage latency logger; **MEASURE ON DEVICE** |
| 4 | Fully offline inference | ✅ models bundled; zero network in the inference path |
| 5 | Accuracy > 95% (Indian demographics) | ⏳ eval harness (`ml/eval.py`) + fine-tune pipeline; **MEASURE ON DEVICE** |
| 6 | 100% open-source | ✅ all permissive — [LICENSES.md](LICENSES.md) (automated scan: none non-permissive) |
| 7 | Active + passive liveness | ✅ randomized challenge FSM + MiniFASNet gate (fusion: both must pass) |
| 8 | Sync-and-purge (encrypted → AWS → purge) | ✅ retry/backoff + idempotency + ACK-then-purge; SAM IaC + local mock |

---

## Quickstart

```bash
npm install
npm run fetch:models     # downloads blazeface, face_landmark, mobilefacenet (offline-ready)

# Android — needs Android Studio + a device/emulator + JDK 17 (NOT 25)
$env:JAVA_HOME = "C:\Program Files\Java\jdk-17"   # PowerShell; export on macOS/Linux
npm run android

# iOS — macOS + Xcode only
bundle install
bundle exec pod install --project-directory=ios
npm run ios
```

> ⚠️ **MiniFASNet (anti-spoof)** ships only as PyTorch upstream — run
> `python scripts/convert_minifasnet.py` once to produce `models/minifasnet.tflite`.
> Until then liveness **fails closed** (secure default).

### Verify / test

```bash
npm run typecheck      # tsc --noEmit            → 0 errors
npm test               # jest                    → 56 tests, 8 suites
npm run verify:models  # ≤ 20 MB model budget    → 6.71 MB
```

---

## Demo script (judge walkthrough, ~4 min)

1. **Offline proof** — enable airplane mode. Everything below still works.
2. **Enroll** (Enroll tab): enter a person ID + name → "Start enrollment" →
   7 frames captured → averaged 192-D embedding stored **encrypted** (no image).
3. **Verify** (Verify tab):
   - Passive **anti-spoof gate** runs first — hold a **photo/phone** to the
     camera → rejected before any challenge (or "model missing" if not converted).
   - **Randomized active challenges** appear (e.g. "Blink", then "Turn head left")
     with a countdown. A static photo can't satisfy them.
   - On pass → face is embedded, matched 1:N → shows **name + confidence %**.
   - An **encrypted attendance record** is written locally (`synced=false`).
4. **Sync/purge** (Sync tab):
   - Start the local endpoint: `node mock-server/server.mjs`
   - Tab shows **pending = 1**. Turn the network back on → auto-sync (or "Sync now").
   - Record pushed with an idempotency key → **200 ack** → local row **purged** →
     pending = 0, synced += 1. (`GET http://localhost:8787/records` shows it server-side.)
   - Demo resilience: `FAIL_TIMES=2 node mock-server/server.mjs` → watch retry/backoff.
5. **Compression** — `python ml/augment.py` (harsh-sun/low-light/shadow) and
   walk through [docs/COMPRESSION_REPORT.md](docs/COMPRESSION_REPORT.md).

---

## Repo layout

```
DatalakeFaceAuth/
├── src/
│   ├── ai/         blazeface · facemesh (geometry+alignment) · antispoof · embedding · preprocessing
│   ├── liveness/   challenge FSM + config (EAR/MAR/yaw thresholds)
│   ├── hooks/      useLiveness · useEnrollment · useRecognition · useCameraAccess · useIsOnline
│   ├── db/         SQLCipher schema + enrollment/attendance CRUD
│   ├── sync/       backoff · pushRecord (retry+idempotency) · syncService (ACK-then-purge)
│   ├── screens/    Enroll · Verify · Sync · Admin
│   ├── components/ camera hosts + overlays + shared UI
│   ├── navigation/ store/ utils/
├── models/         bundled TFLite + MODEL_MANIFEST.json (≤ 20 MB)
├── ml/             open-source compression pipeline (quantize · prune · distill · finetune · augment)
├── infra/          AWS SAM backend (API GW → Lambda → DynamoDB)
├── mock-server/    zero-dep local sync endpoint (offline demo)
├── scripts/        fetch_models · verify_model_sizes · convert_* (model acquisition)
├── __tests__/      56 unit/integration tests
└── docs/           ARCHITECTURE · SYNC · COMPRESSION_REPORT
```

See [TECHNICAL_DOCUMENTATION.md](TECHNICAL_DOCUMENTATION.md) for the deep dive.
