"""Pull amitpuri/bollywood-celebs (MIT, Indian celebrities), load the
save_to_disk-format dataset, group by identity, save a balanced subset as
folder-per-person JPGs for the aligned verification eval."""
import os
import glob

from huggingface_hub import snapshot_download
from datasets import load_from_disk, Dataset
from datasets.features import Image as HFImage, ClassLabel

OUT = "ml/dataset_bollywood"
PER_ID = 8

p = snapshot_download("amitpuri/bollywood-celebs", repo_type="dataset")
print("snapshot:", p)

ds = None
for cand in [os.path.join(p, "train"), p]:
    try:
        ds = load_from_disk(cand)
        print("load_from_disk OK at", cand)
        break
    except Exception as e:
        print("load_from_disk failed at", cand, "->", repr(e)[:120])
if ds is None:
    arrows = sorted(glob.glob(os.path.join(p, "**", "*.arrow"), recursive=True))
    print("falling back to arrow files:", arrows[:3])
    ds = Dataset.from_file(arrows[0])

# DatasetDict -> train split
try:
    ds = ds["train"]
except Exception:
    pass

print("columns:", ds.column_names, "len:", len(ds))

img_col, lbl_col, names = None, None, None
for c, f in ds.features.items():
    if isinstance(f, HFImage):
        img_col = c
    if isinstance(f, ClassLabel):
        lbl_col, names = c, f.names
if lbl_col is None:
    for c in ds.column_names:
        if c != img_col and ("label" in c.lower() or "target" in c.lower() or "id" in c.lower()):
            lbl_col = c
            break
print("image col:", img_col, "| label col:", lbl_col)

counts: dict = {}
saved = 0
for ex in ds:
    lbl = ex[lbl_col]
    if counts.get(lbl, 0) >= PER_ID:
        continue
    nm = (str(names[lbl]) if names else str(lbl)).replace(" ", "_").replace("/", "_")
    d = os.path.join(OUT, nm)
    os.makedirs(d, exist_ok=True)
    ex[img_col].convert("RGB").save(os.path.join(d, f"{counts.get(lbl, 0)}.jpg"))
    counts[lbl] = counts.get(lbl, 0) + 1
    saved += 1

usable = sum(1 for c in counts.values() if c >= 2)
print(f"Saved {saved} images / {len(counts)} identities ({usable} with >=2 imgs) to {OUT}")
