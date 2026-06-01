"""
INT8 post-training quantization (+ optional magnitude pruning) for MobileFaceNet,
exporting a <2 MB TFLite embedding model.

Pipeline:
  SavedModel (FP32)
    -> [optional] prune_low_magnitude to `target_sparsity` + strip
    -> TFLite INT8 PTQ with a representative dataset (real face crops)
    -> measure size + verification accuracy before/after
    -> write ml/compression_report.json

Run (needs Python 3.11/3.12 + ml/requirements.txt):
  python ml/quantize.py \
      --saved-model artifacts/mobilefacenet_savedmodel \
      --rep-images data/calib_faces \
      --pairs data/imfdb_pairs.txt \
      --out ../models/mobilefacenet_int8.tflite \
      --prune 0.4
"""
from __future__ import annotations

import argparse
import json
import os
import numpy as np
import cv2


def representative_dataset(images_dir: str, input_size: int = 112, n: int = 200):
    """Yields calibration tensors normalised exactly like the app: (px-128)/128."""
    files = [
        os.path.join(images_dir, f)
        for f in os.listdir(images_dir)
        if f.lower().endswith((".jpg", ".jpeg", ".png"))
    ][:n]

    def gen():
        for p in files:
            img = cv2.cvtColor(cv2.imread(p), cv2.COLOR_BGR2RGB)
            img = cv2.resize(img, (input_size, input_size))
            x = (img.astype(np.float32) - 128.0) / 128.0
            yield [x[None, ...]]

    return gen


def maybe_prune(saved_model_dir: str, target_sparsity: float):
    """Apply magnitude pruning to `target_sparsity`, return a stripped Keras model."""
    import tensorflow as tf
    import tensorflow_model_optimization as tfmot

    model = tf.keras.models.load_model(saved_model_dir)
    schedule = tfmot.sparsity.keras.ConstantSparsity(target_sparsity, begin_step=0)
    pruned = tfmot.sparsity.keras.prune_low_magnitude(model, pruning_schedule=schedule)
    # NB: a few fine-tune steps recover accuracy — wired in finetune_indian.py.
    return tfmot.sparsity.keras.strip_pruning(pruned)


def convert_int8(source, rep_gen, out_path: str) -> int:
    """INT8 PTQ. Keeps float32 I/O for a simple app contract; weights/acts are INT8."""
    import tensorflow as tf

    if isinstance(source, str):
        conv = tf.lite.TFLiteConverter.from_saved_model(source)
    else:
        conv = tf.lite.TFLiteConverter.from_keras_model(source)

    conv.optimizations = [tf.lite.Optimize.DEFAULT]
    conv.representative_dataset = rep_gen
    conv.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
    conv.inference_input_type = tf.float32
    conv.inference_output_type = tf.float32

    tflite = conv.convert()
    with open(out_path, "wb") as f:
        f.write(tflite)
    return len(tflite)


def fp32_baseline_tflite(saved_model_dir: str, out_path: str) -> int:
    import tensorflow as tf

    conv = tf.lite.TFLiteConverter.from_saved_model(saved_model_dir)
    tflite = conv.convert()
    with open(out_path, "wb") as f:
        f.write(tflite)
    return len(tflite)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--saved-model", required=True)
    ap.add_argument("--rep-images", required=True, help="dir of calibration face crops")
    ap.add_argument("--pairs", help="LFW-style pairs file for accuracy (optional)")
    ap.add_argument("--out", required=True, help="output INT8 .tflite path")
    ap.add_argument("--prune", type=float, default=0.0, help="target sparsity 0..0.9 (0=off)")
    ap.add_argument("--report", default=os.path.join(os.path.dirname(__file__), "compression_report.json"))
    args = ap.parse_args()

    rep = representative_dataset(args.rep_images)

    # Baseline FP32 size (for the before/after report).
    fp32_path = args.out.replace(".tflite", "_fp32.tflite")
    fp32_bytes = fp32_baseline_tflite(args.saved_model, fp32_path)

    source = maybe_prune(args.saved_model, args.prune) if args.prune > 0 else args.saved_model
    int8_bytes = convert_int8(source, rep, args.out)

    report = {
        "fp32_mb": round(fp32_bytes / 1e6, 3),
        "int8_mb": round(int8_bytes / 1e6, 3),
        "reduction_x": round(fp32_bytes / int8_bytes, 2) if int8_bytes else None,
        "pruning_sparsity": args.prune,
        "under_2mb": int8_bytes < 2_000_000,
    }

    if args.pairs:
        from eval import evaluate

        report["accuracy_fp32"] = evaluate(fp32_path, args.pairs)
        report["accuracy_int8"] = evaluate(args.out, args.pairs)
        report["tar_retention"] = round(
            report["accuracy_int8"]["tar_at_far"] / max(report["accuracy_fp32"]["tar_at_far"], 1e-6),
            4,
        )

    with open(args.report, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(json.dumps(report, indent=2))
    print(f"\nFP32: {report['fp32_mb']} MB  ->  INT8: {report['int8_mb']} MB "
          f"({report['reduction_x']}x smaller, <2MB: {report['under_2mb']})")


if __name__ == "__main__":
    main()
