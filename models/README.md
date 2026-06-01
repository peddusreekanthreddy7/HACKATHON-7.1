# `/models` — on-device AI models

These TFLite models are **bundled into the app** (Metro treats `.tflite/.onnx/.bin`
as assets) so inference is **100% offline** (hard constraint #4).

## Footprint budget — hard constraint #2

Total size of everything in this folder must stay **≤ 20 MB** (smaller scores
higher). Enforced by:

```bash
npm run verify:models
```

which sums the model files and exits non-zero if the budget is blown.

## Planned models (added in Phase 2+)

| Model | File | Quant | Purpose | License |
|-------|------|-------|---------|---------|
| BlazeFace | `blazeface.tflite` | FP16 | Face detection | Apache-2.0 |
| Face Mesh | `face_mesh.tflite` | FP16 | 468 landmarks → liveness | Apache-2.0 |
| MobileFaceNet | `mobilefacenet_int8.tflite` | INT8 | 512-D embedding | MIT* |
| MiniFASNet | `minifasnet_int8.tflite` | INT8 | Passive anti-spoof | Apache-2.0 |

`*` MobileFaceNet weights' license is re-verified against the exact source in
Phase 2. See `MODEL_MANIFEST.json` for sizes + SHA-256 (filled when added) and
`../LICENSES.md` for the full ledger.
