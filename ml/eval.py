"""
Face-verification accuracy eval for a TFLite embedding model.

Computes TAR @ a fixed FAR and best-threshold accuracy on a labelled pair list
(LFW-style: lines of `imgA imgB same(0/1)`). Used to report accuracy RETENTION
before vs after quantisation, and on the harsh-light eval subsets.

Open-source only (TF + scikit-learn + numpy + opencv).
"""
from __future__ import annotations

import argparse
import numpy as np
import cv2


def load_face(path: str, size: int = 112) -> np.ndarray:
    """Load + resize + normalise exactly as the app does: (px-128)/128, RGB."""
    img = cv2.cvtColor(cv2.imread(path), cv2.COLOR_BGR2RGB)
    img = cv2.resize(img, (size, size))
    return ((img.astype(np.float32) - 128.0) / 128.0)[None, ...]


def _make_interpreter(tflite_path: str):
    """Load a TFLite interpreter from whichever runtime is installed.

    ai-edge-litert (LiteRT) ships Python 3.13 wheels and runs the SAME .tflite we
    bundle in the app; tensorflow.lite is the fallback on older Pythons. Either way
    we score the EXACT model the app ships — no proxy, no fabricated numbers.
    """
    try:
        from ai_edge_litert.interpreter import Interpreter
        return Interpreter(model_path=tflite_path)
    except ImportError:
        import tensorflow as tf
        return tf.lite.Interpreter(model_path=tflite_path)


def embed_all(tflite_path: str, image_paths: list[str], size: int = 112) -> dict[str, np.ndarray]:
    interp = _make_interpreter(tflite_path)
    interp.allocate_tensors()
    inp = interp.get_input_details()[0]
    out = interp.get_output_details()[0]

    embeddings: dict[str, np.ndarray] = {}
    for p in image_paths:
        x = load_face(p, size).astype(inp["dtype"])
        interp.set_tensor(inp["index"], x)
        interp.invoke()
        v = interp.get_tensor(out["index"])[0].astype(np.float32)
        n = np.linalg.norm(v)
        embeddings[p] = v / n if n > 0 else v  # L2-normalise → cosine == dot
    return embeddings


def read_pairs(pairs_file: str) -> list[tuple[str, str, int]]:
    pairs: list[tuple[str, str, int]] = []
    with open(pairs_file, "r", encoding="utf-8") as f:
        for line in f:
            parts = line.split()
            if len(parts) == 3:
                pairs.append((parts[0], parts[1], int(parts[2])))
    return pairs


def evaluate(tflite_path: str, pairs_file: str, far_target: float = 0.001) -> dict:
    from sklearn.metrics import roc_curve

    pairs = read_pairs(pairs_file)
    uniq = sorted({p for a, b, _ in pairs for p in (a, b)})
    emb = embed_all(tflite_path, uniq)

    scores = np.array([float(emb[a] @ emb[b]) for a, b, _ in pairs])
    labels = np.array([y for _, _, y in pairs])

    fpr, tpr, thr = roc_curve(labels, scores)
    # TAR @ FAR target
    idx = np.searchsorted(fpr, far_target, side="left")
    idx = min(idx, len(tpr) - 1)
    tar_at_far = float(tpr[idx])
    # Best-threshold accuracy
    accs = [(((scores >= t) == labels).mean(), t) for t in thr]
    best_acc, best_thr = max(accs, key=lambda z: z[0])

    return {
        "pairs": len(pairs),
        "tar_at_far": round(tar_at_far, 4),
        "far_target": far_target,
        "best_accuracy": round(float(best_acc), 4),
        "best_threshold": round(float(best_thr), 4),
    }


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True, help="path to .tflite")
    ap.add_argument("--pairs", required=True, help="LFW-style pairs file")
    ap.add_argument("--far", type=float, default=0.001)
    args = ap.parse_args()
    print(evaluate(args.model, args.pairs, args.far))
