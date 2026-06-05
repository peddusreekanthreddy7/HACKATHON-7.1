"""
ALIGNED accuracy eval on a LOCAL pairs file (e.g. an Indian-demographic set).

Use this — NOT the unaligned eval.py — for a representative number, because the
bundled MobileFaceNet is alignment-sensitive (LFW: 76.7% unaligned vs 96.9%
aligned). Runs the SAME pipeline the app does: face_landmark.tflite -> 5-pt
Umeyama -> CANONICAL_112 -> embed.

Workflow for an Indian-demographic measurement:
    # 1. collect faces (team/volunteers), one sub-folder per person, >=2 imgs each:
    #    ml/dataset/ravi/*.jpg   ml/dataset/anita/*.jpg  ...
    python ml/make_pairs.py --data ml/dataset --out ml/pairs.txt
    python ml/eval_folder_aligned.py --pairs ml/pairs.txt

Open-source only (LiteRT + sklearn + opencv). No fabricated data.
"""
from __future__ import annotations

import argparse
import os
import sys

import numpy as np
import cv2

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from eval import _make_interpreter, read_pairs  # noqa: E402
from eval_lfw_aligned import Aligner, align_112, MFN_SIZE  # noqa: E402


def main(model: str, mesh: str, pairs_file: str, far_target: float = 1e-3) -> None:
    from sklearn.metrics import roc_curve

    pairs = read_pairs(pairs_file)
    if not pairs:
        raise SystemExit(f"No pairs in {pairs_file!r} — run make_pairs.py first.")
    labels = np.array([y for _, _, y in pairs])

    aligner = Aligner(mesh)
    embedder = _make_interpreter(model)
    embedder.allocate_tensors()
    ein = embedder.get_input_details()[0]
    eout = embedder.get_output_details()[0]

    cache: dict[str, np.ndarray] = {}
    misses = 0

    def embed_path(path: str) -> np.ndarray:
        nonlocal misses
        if path in cache:
            return cache[path]
        bgr = cv2.imread(path)
        if bgr is None:
            raise SystemExit(f"Cannot read image: {path}")
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        pts = aligner.landmarks5(rgb)
        if pts is None:
            misses += 1
            face = cv2.resize(rgb, (MFN_SIZE, MFN_SIZE))
        else:
            face = align_112(rgb, pts)
        x = ((face.astype(np.float32) - 128.0) / 128.0)[None, ...].astype(ein["dtype"])
        embedder.set_tensor(ein["index"], x)
        embedder.invoke()
        v = embedder.get_tensor(eout["index"])[0].astype(np.float32)
        n = np.linalg.norm(v)
        out = v / n if n > 0 else v
        cache[path] = out
        return out

    scores = np.array([float(embed_path(a) @ embed_path(b)) for a, b, _ in pairs])

    fpr, tpr, thr = roc_curve(labels, scores)
    idx = min(int(np.searchsorted(fpr, far_target, side="left")), len(tpr) - 1)
    best_acc, best_thr = max(
        ((((scores >= t) == labels).mean(), t) for t in thr), key=lambda z: z[0]
    )
    print("\n=== ALIGNED accuracy on local set ===")
    for k, v in {
        "pairs": len(pairs),
        "images": len(cache),
        "landmark_misses": misses,
        "best_accuracy": round(float(best_acc), 4),
        "best_threshold": round(float(best_thr), 4),
        "acc@0.40_deployed": round(float(((scores >= 0.40) == labels).mean()), 4),
        "tar@far=1e-3": round(float(tpr[idx]), 4),
    }.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--pairs", required=True, help="LFW-style pairs file (from make_pairs.py)")
    ap.add_argument("--model", default="models/mobilefacenet.tflite")
    ap.add_argument("--mesh", default="models/face_landmark.tflite")
    ap.add_argument("--far", type=float, default=1e-3)
    args = ap.parse_args()
    main(args.model, args.mesh, args.pairs, args.far)
