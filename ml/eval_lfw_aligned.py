"""
ALIGNED LFW accuracy for the bundled embedding model — mirrors the app pipeline.

Difference vs eval_lfw.py: before embedding, each face is 5-point aligned using
the SAME bundled face_landmark.tflite + the SAME canonical 112x112 template and
Umeyama similarity transform the app uses (src/ai/facemesh/alignment.ts). This is
the representative number for the deployed system — MobileFaceNet is alignment-
sensitive, so the unaligned eval understates it badly.

Pipeline per face:  resize->192 -> face_landmark.tflite -> 5 pts (eyes/nose/mouth)
                  -> Umeyama warp to CANONICAL_112 -> 112x112 -> (px-128)/128 -> embed

Open-source only (LiteRT + sklearn + opencv). No fabricated data — uses the exact
shipped models on the public LFW benchmark.

Run:  python ml/eval_lfw_aligned.py
"""
from __future__ import annotations

import argparse
import os
import sys

import numpy as np
import cv2

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from eval import _make_interpreter  # noqa: E402  (same runtime loader)

# --- constants mirrored from src/ai/facemesh ---------------------------------
FACEMESH_INPUT_SIZE = 192
MFN_SIZE = 112
LEFT_EYE_EAR = [33, 160, 158, 133, 153, 144]
RIGHT_EYE_EAR = [362, 385, 387, 263, 373, 380]
NOSE_TIP = 1
MOUTH_LEFT, MOUTH_RIGHT = 61, 291
CANONICAL_112 = np.array(
    [[38.29, 51.70], [73.53, 51.50], [56.02, 71.74], [41.55, 92.37], [70.73, 92.20]],
    dtype=np.float32,
)


def _to_uint8_rgb(img: np.ndarray) -> np.ndarray:
    a = np.asarray(img, dtype=np.float32)
    if a.max() <= 1.0:           # sklearn hands back [0,1] floats
        a = a * 255.0
    if a.ndim == 2:
        a = np.stack([a, a, a], axis=-1)
    return np.clip(a, 0, 255).astype(np.uint8)


class Aligner:
    """Runs face_landmark.tflite and returns the 5 alignment points (image px)."""

    def __init__(self, mesh_path: str):
        self.interp = _make_interpreter(mesh_path)
        self.interp.allocate_tensors()
        self.inp = self.interp.get_input_details()[0]
        self.outs = self.interp.get_output_details()

    def landmarks5(self, rgb_u8: np.ndarray) -> np.ndarray | None:
        h, w = rgb_u8.shape[:2]
        x = cv2.resize(rgb_u8, (FACEMESH_INPUT_SIZE, FACEMESH_INPUT_SIZE)).astype(np.float32)
        x = (x / 255.0)[None, ...].astype(self.inp["dtype"])  # MediaPipe expects [0,1]
        self.interp.set_tensor(self.inp["index"], x)
        self.interp.invoke()
        # Landmarks tensor = the largest output (468*3 = 1404 floats).
        best = max(self.outs, key=lambda o: int(np.prod(o["shape"])))
        raw = self.interp.get_tensor(best["index"]).reshape(-1)
        if raw.size < 468 * 3:
            return None
        lm = raw[: 468 * 3].reshape(468, 3)[:, :2] / FACEMESH_INPUT_SIZE  # -> [0,1]
        # Scale crop-local [0,1] back to this image's pixel coords.
        lm[:, 0] *= w
        lm[:, 1] *= h
        left_eye = lm[LEFT_EYE_EAR].mean(axis=0)
        right_eye = lm[RIGHT_EYE_EAR].mean(axis=0)
        return np.array(
            [left_eye, right_eye, lm[NOSE_TIP], lm[MOUTH_LEFT], lm[MOUTH_RIGHT]],
            dtype=np.float32,
        )


def align_112(rgb_u8: np.ndarray, pts5: np.ndarray) -> np.ndarray:
    """Umeyama similarity warp of the source face into the 112x112 canonical frame."""
    M, _ = cv2.estimateAffinePartial2D(pts5, CANONICAL_112, method=cv2.LMEDS)
    if M is None:
        M, _ = cv2.estimateAffinePartial2D(pts5, CANONICAL_112)
    return cv2.warpAffine(rgb_u8, M, (MFN_SIZE, MFN_SIZE), flags=cv2.INTER_LINEAR)


def main(mfn_path: str, mesh_path: str, far_target: float = 1e-3) -> None:
    from sklearn.datasets import fetch_lfw_pairs
    from sklearn.metrics import roc_curve

    print("Fetching LFW 'test' pairs (cached after first run)...")
    lfw = fetch_lfw_pairs(subset="test", color=True, resize=1.0, funneled=True)
    pairs, labels = lfw.pairs, np.asarray(lfw.target)
    print(f"Loaded {len(pairs)} pairs ({int(labels.sum())} genuine + "
          f"{int((labels == 0).sum())} impostor).")

    aligner = Aligner(mesh_path)
    embedder = _make_interpreter(mfn_path)
    embedder.allocate_tensors()
    ein = embedder.get_input_details()[0]
    eout = embedder.get_output_details()[0]

    misses = 0
    sanity_printed = False

    def embed_face(img) -> np.ndarray:
        nonlocal misses, sanity_printed
        rgb = _to_uint8_rgb(img)
        pts = aligner.landmarks5(rgb)
        if pts is None:
            misses += 1
            face = cv2.resize(rgb, (MFN_SIZE, MFN_SIZE))  # fallback: plain resize
        else:
            if not sanity_printed:
                print(f"  [sanity] 5pts (img px): eyesY={pts[0][1]:.0f},{pts[1][1]:.0f} "
                      f"noseY={pts[2][1]:.0f} mouthY={pts[3][1]:.0f},{pts[4][1]:.0f} "
                      f"(expect eyes<nose<mouth)")
                sanity_printed = True
            face = align_112(rgb, pts)
        x = ((face.astype(np.float32) - 128.0) / 128.0)[None, ...].astype(ein["dtype"])
        embedder.set_tensor(ein["index"], x)
        embedder.invoke()
        v = embedder.get_tensor(eout["index"])[0].astype(np.float32)
        n = np.linalg.norm(v)
        return v / n if n > 0 else v

    scores = np.empty(len(pairs), dtype=np.float32)
    for i, (a, b) in enumerate(pairs):
        scores[i] = float(embed_face(a) @ embed_face(b))
        if (i + 1) % 100 == 0:
            print(f"  aligned+embedded {i + 1}/{len(pairs)} pairs")

    fpr, tpr, thr = roc_curve(labels, scores)
    idx = min(int(np.searchsorted(fpr, far_target, side="left")), len(tpr) - 1)
    tar_at_far = float(tpr[idx])
    best_acc, best_thr = max(
        ((((scores >= t) == labels).mean(), t) for t in thr), key=lambda z: z[0]
    )

    def acc_at(t: float) -> float:
        return float(((scores >= t) == labels).mean())

    print("\n=== RESULT (5-point aligned, mirrors on-device pipeline) ===")
    for k, v in {
        "dataset": "LFW test (funneled, 1000 pairs)",
        "alignment": "face_landmark.tflite + Umeyama -> CANONICAL_112",
        "landmark_misses": misses,
        "best_accuracy": round(float(best_acc), 4),
        "best_threshold": round(float(best_thr), 4),
        "acc@0.40_deployed": round(acc_at(0.40), 4),
        "acc@0.60_previous": round(acc_at(0.60), 4),
        "tar@far=1e-3": round(tar_at_far, 4),
    }.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="models/mobilefacenet.tflite")
    ap.add_argument("--mesh", default="models/face_landmark.tflite")
    ap.add_argument("--far", type=float, default=1e-3)
    args = ap.parse_args()
    main(args.model, args.mesh, args.far)
