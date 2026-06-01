# Model-optimization pipeline (Phase 6)

Reproducible, **100% open-source** pipeline to shrink MobileFaceNet to a
**< 2 MB INT8 TFLite** model and harden it for Indian outdoor field conditions.

> ⚠️ **Python version:** TensorFlow has no wheel for Python 3.13. Use 3.11/3.12:
> ```
> py -3.11 -m venv .venv && .venv\Scripts\activate    # Windows
> pip install -r ml/requirements.txt
> ```
> The augmentation module (`augment.py`) needs only numpy + opencv and runs on
> any Python 3.x (verified on 3.13).

## Files

| File | What it does | Deps to run |
|------|--------------|-------------|
| `augment.py` | Harsh-sun / low-light / shadow / gamma / CLAHE augmentation | numpy + opencv ✅ runs on 3.13 |
| `finetune_indian.py` | Fine-tune MobileFaceNet (ArcFace head) on IMFDB-style Indian sets + augmentation | TF (3.11/3.12) |
| `distill.py` | Embedding-space knowledge distillation (large teacher → small student) | TF |
| `quantize.py` | INT8 PTQ (+ optional magnitude pruning) → `<2MB` TFLite, before/after report | TF + tfmot |
| `eval.py` | Verification accuracy (TAR@FAR) for accuracy-retention reporting | TF + sklearn |

## End-to-end

```bash
# 0. obtain a MobileFaceNet SavedModel (see scripts/convert_mobilefacenet.py)
# 1. (optional) fine-tune on Indian-demographics data with field augmentation
python ml/finetune_indian.py --backbone artifacts/mfn_savedmodel \
    --data data/indian --out artifacts/mfn_indian --epochs 20
# 2. (optional) distill from a larger teacher to recover accuracy
python ml/distill.py --teacher artifacts/teacher --student artifacts/mfn_indian \
    --images data/indian --out artifacts/mfn_distilled
# 3. quantize to <2MB INT8 + measure before/after size + accuracy
python ml/quantize.py --saved-model artifacts/mfn_distilled \
    --rep-images data/calib_faces --pairs data/imfdb_pairs.txt \
    --out ../models/mobilefacenet_int8.tflite --prune 0.4
# -> writes ml/compression_report.json and prints the size reduction
```

Then point the app at the new model (rename to `models/mobilefacenet.tflite`,
re-run `npm run verify:models`).

## Datasets (open, research-use; comply with each licence)

- **IMFDB** — Indian Movie Face Database (IIIT-H CVIT): pose/illumination/
  expression variation across Indian identities.
- Supplementary Indian celeb sets (e.g. IIIT-CFW) as `data/indian/<id>/*.jpg`.

## Licences

All deps are Apache-2.0 / BSD / MIT (see `requirements.txt`). No proprietary
training services.
