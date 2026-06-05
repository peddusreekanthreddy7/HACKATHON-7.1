"""
Lighting-robustness accuracy on LFW — answers constraint #5's "varying outdoor
lighting (harsh sunlight, low light, shadows)".

Realistic scenario: enrollment photo is CLEAN, the verification (probe) photo is
captured in adverse outdoor light. So for each LFW pair (a, b) we keep `a` clean
and degrade `b` with the app's OWN field-condition transforms (ml/augment.py),
then run the full aligned pipeline (face_landmark.tflite + Umeyama -> embed) and
measure accuracy per condition.

Same exact bundled models, same alignment as the app. 100% open-source. No
fabricated numbers — reproduce with one command.

Run:  python ml/eval_lfw_lighting.py
"""
from __future__ import annotations

import argparse
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from eval import _make_interpreter  # noqa: E402
from eval_lfw_aligned import Aligner, align_112, _to_uint8_rgb, MFN_SIZE  # noqa: E402
from augment import simulate_harsh_sun, simulate_low_light, add_synthetic_shadow  # noqa: E402

import cv2  # noqa: E402


def _identity(img, rng):
    return img


CONDITIONS = {
    "clean": _identity,
    "harsh_sun": simulate_harsh_sun,
    "low_light": simulate_low_light,
    "shadow": add_synthetic_shadow,
}


def main(mfn_path: str, mesh_path: str, far_target: float = 1e-3) -> None:
    from sklearn.datasets import fetch_lfw_pairs
    from sklearn.metrics import roc_curve

    print("Fetching LFW 'test' pairs (cached)...")
    lfw = fetch_lfw_pairs(subset="test", color=True, resize=1.0, funneled=True)
    pairs, labels = lfw.pairs, np.asarray(lfw.target)
    print(f"Loaded {len(pairs)} pairs.")

    aligner = Aligner(mesh_path)
    embedder = _make_interpreter(mfn_path)
    embedder.allocate_tensors()
    ein = embedder.get_input_details()[0]
    eout = embedder.get_output_details()[0]

    def embed(rgb_u8: np.ndarray) -> np.ndarray:
        pts = aligner.landmarks5(rgb_u8)
        face = align_112(rgb_u8, pts) if pts is not None else cv2.resize(rgb_u8, (MFN_SIZE, MFN_SIZE))
        x = ((face.astype(np.float32) - 128.0) / 128.0)[None, ...].astype(ein["dtype"])
        embedder.set_tensor(ein["index"], x)
        embedder.invoke()
        v = embedder.get_tensor(eout["index"])[0].astype(np.float32)
        n = np.linalg.norm(v)
        return v / n if n > 0 else v

    # Enrollment side (image a) is clean — embed once, reuse across conditions.
    print("Embedding clean enrollment side (image a) once...")
    emb_a = np.stack([embed(_to_uint8_rgb(a)) for a, _ in pairs])

    def metrics(scores: np.ndarray) -> dict:
        fpr, tpr, thr = roc_curve(labels, scores)
        idx = min(int(np.searchsorted(fpr, far_target, side="left")), len(tpr) - 1)
        best_acc, best_thr = max(
            ((((scores >= t) == labels).mean(), t) for t in thr), key=lambda z: z[0]
        )
        return {
            "acc@0.40": round(float(((scores >= 0.40) == labels).mean()), 4),
            "best_acc": round(float(best_acc), 4),
            "best_thr": round(float(best_thr), 4),
            "tar@far1e-3": round(float(tpr[idx]), 4),
        }

    results = {}
    for name, fn in CONDITIONS.items():
        print(f"\n[{name}] degrading probe (image b) + embedding...")
        scores = np.empty(len(pairs), dtype=np.float32)
        for i, (_, b) in enumerate(pairs):
            rng = np.random.default_rng(1000 + i)  # deterministic per image
            bb = _to_uint8_rgb(b)
            bb = fn(bb, rng) if name != "clean" else bb
            scores[i] = float(emb_a[i] @ embed(bb))
            if (i + 1) % 250 == 0:
                print(f"    {i + 1}/{len(pairs)}")
        results[name] = metrics(scores)

    print("\n=== LIGHTING ROBUSTNESS (clean enroll vs degraded probe) ===")
    print(f"{'condition':<12}{'acc@0.40':>10}{'best_acc':>10}{'best_thr':>10}{'tar@far':>10}")
    for name, m in results.items():
        print(f"{name:<12}{m['acc@0.40']:>10}{m['best_acc']:>10}{m['best_thr']:>10}{m['tar@far1e-3']:>10}")
    clean = results['clean']['acc@0.40']
    print("\nDrop vs clean (@0.40):")
    for name, m in results.items():
        if name != 'clean':
            print(f"  {name}: {round((clean - m['acc@0.40']) * 100, 1)} pts")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="models/mobilefacenet.tflite")
    ap.add_argument("--mesh", default="models/face_landmark.tflite")
    args = ap.parse_args()
    main(args.model, args.mesh)
