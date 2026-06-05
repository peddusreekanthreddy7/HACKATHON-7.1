"""
Build an LFW-style verification pairs file from a folder-of-people.

Expected layout (one sub-folder per person, >=2 images each):

    dataset/
      person_a/  img1.jpg img2.jpg img3.jpg
      person_b/  img1.jpg img2.jpg
      ...

Emits lines of `imgA imgB same(1/0)` consumed by eval.py:
  - GENUINE pairs (same=1): every distinct same-person image pair.
  - IMPOSTOR pairs (same=0): random cross-person pairs, balanced 1:1 with genuines.

Deterministic (fixed seed) so the reported number is reproducible.
Open-source only (stdlib). No fabricated data — pairs come straight from your images.
"""
from __future__ import annotations

import argparse
import os
import random
from itertools import combinations

IMG_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def list_people(root: str) -> dict[str, list[str]]:
    people: dict[str, list[str]] = {}
    for name in sorted(os.listdir(root)):
        d = os.path.join(root, name)
        if not os.path.isdir(d):
            continue
        imgs = [
            os.path.join(d, f)
            for f in sorted(os.listdir(d))
            if os.path.splitext(f)[1].lower() in IMG_EXT
        ]
        if len(imgs) >= 1:
            people[name] = imgs
    return people


def build_pairs(root: str, seed: int = 1234) -> list[tuple[str, str, int]]:
    rng = random.Random(seed)
    people = list_people(root)
    if len(people) < 2:
        raise SystemExit(
            f"Need >=2 person sub-folders with images under {root!r}; found {len(people)}."
        )

    genuine: list[tuple[str, str, int]] = []
    for imgs in people.values():
        for a, b in combinations(imgs, 2):
            genuine.append((a, b, 1))

    if not genuine:
        raise SystemExit("No genuine pairs — every person needs >=2 images.")

    # Balanced impostors: one random cross-person pair per genuine pair.
    names = list(people.keys())
    impostor: list[tuple[str, str, int]] = []
    seen: set[tuple[str, str]] = set()
    attempts = 0
    while len(impostor) < len(genuine) and attempts < len(genuine) * 50:
        attempts += 1
        n1, n2 = rng.sample(names, 2)
        a = rng.choice(people[n1])
        b = rng.choice(people[n2])
        key = tuple(sorted((a, b)))
        if key in seen:
            continue
        seen.add(key)
        impostor.append((a, b, 0))

    pairs = genuine + impostor
    rng.shuffle(pairs)
    return pairs


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True, help="root folder (one sub-folder per person)")
    ap.add_argument("--out", default="pairs.txt", help="output pairs file")
    ap.add_argument("--seed", type=int, default=1234)
    args = ap.parse_args()

    pairs = build_pairs(args.data, args.seed)
    with open(args.out, "w", encoding="utf-8") as f:
        for a, b, y in pairs:
            f.write(f"{a} {b} {y}\n")

    g = sum(1 for *_, y in pairs if y == 1)
    print(f"Wrote {len(pairs)} pairs to {args.out}  ({g} genuine + {len(pairs) - g} impostor)")
    print(f"People: {len(list_people(args.data))}")
