"""
Domain augmentation for Indian field conditions: harsh sunlight, low light, and
hard shadows. Implemented from scratch with NumPy + OpenCV (no heavy aug
dependency) so the exact transforms are auditable and match the on-device
preprocessing assumptions (CLAHE, [-1,1] normalisation).

Each transform takes/returns an uint8 RGB image (H, W, 3).
"""
from __future__ import annotations

import numpy as np
import cv2


def adjust_gamma(img: np.ndarray, gamma: float) -> np.ndarray:
    """gamma < 1 brightens shadows (low light); gamma > 1 darkens (harsh sun)."""
    inv = 1.0 / max(gamma, 1e-6)
    table = (np.linspace(0, 1, 256) ** inv * 255).astype(np.uint8)
    return cv2.LUT(img, table)


def adjust_brightness_contrast(img: np.ndarray, alpha: float, beta: float) -> np.ndarray:
    """alpha = contrast gain (~0.7..1.4), beta = brightness offset (~-60..60)."""
    return cv2.convertScaleAbs(img, alpha=alpha, beta=beta)


def add_synthetic_shadow(img: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """Overlay a random dark polygon — mimics a cap brim / wall / tree shadow."""
    h, w = img.shape[:2]
    mask = np.zeros((h, w), dtype=np.uint8)
    n = rng.integers(3, 6)
    pts = np.stack([rng.integers(0, w, n), rng.integers(0, h, n)], axis=1)
    cv2.fillPoly(mask, [pts.astype(np.int32)], 255)
    darkness = float(rng.uniform(0.35, 0.7))
    out = img.astype(np.float32)
    out[mask == 255] *= darkness
    return np.clip(out, 0, 255).astype(np.uint8)


def simulate_harsh_sun(img: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """Blown-out highlights + warm cast + raised gamma."""
    out = adjust_gamma(img, gamma=float(rng.uniform(1.3, 2.0)))
    out = adjust_brightness_contrast(out, alpha=float(rng.uniform(1.1, 1.4)), beta=float(rng.uniform(20, 60)))
    # Push a few highlights to clip, as a phone camera would in direct sun.
    return np.clip(out.astype(np.float32) * 1.05, 0, 255).astype(np.uint8)


def simulate_low_light(img: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """Crushed shadows + sensor noise + reduced gamma."""
    out = adjust_gamma(img, gamma=float(rng.uniform(0.4, 0.7)))
    out = adjust_brightness_contrast(out, alpha=float(rng.uniform(0.7, 0.95)), beta=float(rng.uniform(-50, -15)))
    noise = rng.normal(0, rng.uniform(4, 12), out.shape)
    return np.clip(out.astype(np.float32) + noise, 0, 255).astype(np.uint8)


def apply_clahe(img: np.ndarray, clip_limit: float = 2.0) -> np.ndarray:
    """Same CLAHE the app applies on-device (src/ai/preprocessing) — keep train/infer aligned."""
    lab = cv2.cvtColor(img, cv2.COLOR_RGB2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(8, 8))
    l = clahe.apply(l)
    return cv2.cvtColor(cv2.merge((l, a, b)), cv2.COLOR_LAB2RGB)


def augment(img: np.ndarray, rng: np.random.Generator | None = None) -> np.ndarray:
    """
    Randomly compose field-condition augmentations. Designed so a single source
    face yields plausible harsh-sun / low-light / shadowed variants — the exact
    distribution shift that hurts recognition in outdoor Indian deployments.
    """
    rng = rng or np.random.default_rng()
    out = img
    roll = rng.random()
    if roll < 0.35:
        out = simulate_harsh_sun(out, rng)
    elif roll < 0.70:
        out = simulate_low_light(out, rng)
    else:
        out = adjust_brightness_contrast(out, alpha=float(rng.uniform(0.85, 1.2)), beta=float(rng.uniform(-20, 20)))

    if rng.random() < 0.5:
        out = add_synthetic_shadow(out, rng)
    if rng.random() < 0.3:
        out = apply_clahe(out)
    return out


if __name__ == "__main__":
    # Smoke demo: synthesize the three conditions from a grey image.
    g = np.full((112, 112, 3), 128, np.uint8)
    r = np.random.default_rng(0)
    for name, fn in [("sun", simulate_harsh_sun), ("low", simulate_low_light)]:
        out = fn(g, r)
        print(f"{name}: mean {out.mean():.1f}  min {out.min()}  max {out.max()}")
    print("shadow mean:", add_synthetic_shadow(g, r).mean())
