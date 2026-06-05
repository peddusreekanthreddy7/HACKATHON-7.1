"""
Measure face-verification accuracy of the BUNDLED embedding model on LFW.

Uses scikit-learn's LFW 'test' pair set (500 genuine + 500 impostor, funneled/
aligned), embeds every face with the SAME mobilefacenet.tflite the app ships
(via ai-edge-litert / LiteRT), and reports:
  - best-threshold accuracy + that threshold (the standard LFW number)
  - accuracy at the app's DEPLOYED thresholds (0.40 now, 0.60 before)
  - TAR @ FAR = 1e-3

Standard public benchmark, 100% open-source, NO fabricated data. Honesty notes:
faces use LFW's funneled alignment + the app's embed-input normalisation
((px-128)/128, RGB, 112x112). The app's own 5-point alignment is NOT applied
here, so this is a fair, slightly conservative proxy for the embedding model's
discriminative power on real photos.

Run:
  python ml/eval_lfw.py --model models/mobilefacenet.tflite
"""
from __future__ import annotations

import argparse
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from eval import _make_interpreter  # reuse the exact same runtime loader  # noqa: E402


def preprocess(img: np.ndarray, size: int = 112) -> np.ndarray:
    """RGB, 112x112, (px-128)/128 — identical to the app's embed input."""
    import cv2

    a = np.asarray(img, dtype=np.float32)
    if a.max() <= 1.0:          # sklearn may hand back [0,1] floats
        a = a * 255.0
    if a.ndim == 2:             # grayscale → RGB
        a = np.stack([a, a, a], axis=-1)
    a = cv2.resize(a, (size, size))
    return ((a - 128.0) / 128.0)[None, ...]


def main(model: str, far_target: float = 1e-3) -> None:
    from sklearn.datasets import fetch_lfw_pairs
    from sklearn.metrics import roc_curve

    print("Fetching LFW 'test' pairs (first run downloads ~200MB, then cached)...")
    lfw = fetch_lfw_pairs(subset="test", color=True, resize=1.0, funneled=True)
    pairs, labels = lfw.pairs, np.asarray(lfw.target)  # pairs (N,2,H,W,3); 1=same
    print(f"Loaded {len(pairs)} pairs ({int(labels.sum())} genuine + "
          f"{int((labels == 0).sum())} impostor).")

    interp = _make_interpreter(model)
    interp.allocate_tensors()
    inp = interp.get_input_details()[0]
    out = interp.get_output_details()[0]

    def embed(img: np.ndarray) -> np.ndarray:
        x = preprocess(img).astype(inp["dtype"])
        interp.set_tensor(inp["index"], x)
        interp.invoke()
        v = interp.get_tensor(out["index"])[0].astype(np.float32)
        n = np.linalg.norm(v)
        return v / n if n > 0 else v

    scores = np.empty(len(pairs), dtype=np.float32)
    for i, (a, b) in enumerate(pairs):
        scores[i] = float(embed(a) @ embed(b))
        if (i + 1) % 100 == 0:
            print(f"  embedded {i + 1}/{len(pairs)} pairs")

    fpr, tpr, thr = roc_curve(labels, scores)
    idx = min(int(np.searchsorted(fpr, far_target, side="left")), len(tpr) - 1)
    tar_at_far = float(tpr[idx])
    best_acc, best_thr = max(
        ((((scores >= t) == labels).mean(), t) for t in thr), key=lambda z: z[0]
    )

    def acc_at(t: float) -> float:
        return float(((scores >= t) == labels).mean())

    result = {
        "dataset": "LFW test (funneled, 1000 pairs)",
        "model": os.path.basename(model),
        "best_accuracy": round(float(best_acc), 4),
        "best_threshold": round(float(best_thr), 4),
        "acc@0.40_deployed": round(acc_at(0.40), 4),
        "acc@0.60_previous": round(acc_at(0.60), 4),
        "tar@far=1e-3": round(tar_at_far, 4),
    }
    print("\n=== RESULT ===")
    for k, v in result.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="models/mobilefacenet.tflite")
    ap.add_argument("--far", type=float, default=1e-3)
    args = ap.parse_args()
    main(args.model, args.far)
