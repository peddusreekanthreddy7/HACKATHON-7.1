"""
Fine-tune MobileFaceNet on OPEN datasets representing Indian demographics, with
harsh-sun / low-light / shadow augmentation, so the shipped model is robust to
real outdoor field conditions in India.

Datasets (all openly available for research; cite + comply with each licence):
  * IMFDB  — Indian Movie Face DB (CVIT, IIIT-H): pose/illumination/expression
             variation across Indian actors. https://cvit.iiit.ac.in/projects/IMFDB/
  * IIIT-CFW / Indian celeb sets — optional supplementary identities.
  Provide them as ImageFolder layout:  data/indian/<person_id>/<img>.jpg

Head: ArcFace (additive angular margin) on top of the MobileFaceNet backbone —
the standard for high-TAR face verification. After fine-tuning we save a
SavedModel that quantize.py turns into the shipped <2 MB INT8 model.

Open-source only (TF/Keras). Needs Python 3.11/3.12 + ml/requirements.txt.
"""
from __future__ import annotations

import argparse
import numpy as np


class ArcFace:
    """Additive angular margin head (CVPR'19). Built as a Keras layer factory."""

    def __init__(self, num_classes: int, s: float = 64.0, m: float = 0.5):
        self.num_classes = num_classes
        self.s = s
        self.m = m

    def build(self, embedding_dim: int):
        import tensorflow as tf

        w = tf.Variable(
            tf.random.normal([embedding_dim, self.num_classes]) * 0.01,
            trainable=True,
            name="arcface_w",
        )

        def call(embeddings, labels):
            x = tf.math.l2_normalize(embeddings, axis=1)
            wn = tf.math.l2_normalize(w, axis=0)
            cos = tf.matmul(x, wn)                      # cosine logits
            theta = tf.acos(tf.clip_by_value(cos, -1 + 1e-7, 1 - 1e-7))
            target = tf.cos(theta + self.m)             # add angular margin
            onehot = tf.one_hot(labels, self.num_classes)
            logits = (onehot * target + (1 - onehot) * cos) * self.s
            return logits

        return call, w


def build_dataset(data_dir: str, input_size: int, batch: int):
    """Augmented, labelled tf.data pipeline from an ImageFolder layout."""
    import tensorflow as tf
    from augment import augment

    rng = np.random.default_rng(42)
    classes = sorted(
        d for d in __import__("os").listdir(data_dir)
        if __import__("os").path.isdir(__import__("os").path.join(data_dir, d))
    )
    class_to_idx = {c: i for i, c in enumerate(classes)}

    paths, labels = [], []
    import os
    for c in classes:
        for f in os.listdir(os.path.join(data_dir, c)):
            if f.lower().endswith((".jpg", ".jpeg", ".png")):
                paths.append(os.path.join(data_dir, c, f))
                labels.append(class_to_idx[c])

    def _load(path, label):
        def _augment(p):
            import cv2
            img = cv2.cvtColor(cv2.imread(p.numpy().decode()), cv2.COLOR_BGR2RGB)
            img = cv2.resize(img, (input_size, input_size))
            img = augment(img, rng)                       # harsh sun / low light / shadow
            return ((img.astype("float32") - 128.0) / 128.0)

        img = tf.py_function(_augment, [path], tf.float32)
        img.set_shape((input_size, input_size, 3))
        return img, label

    ds = tf.data.Dataset.from_tensor_slices((paths, labels))
    ds = ds.shuffle(4096).map(_load, num_parallel_calls=tf.data.AUTOTUNE)
    return ds.batch(batch).prefetch(tf.data.AUTOTUNE), len(classes)


def finetune(backbone_path: str, data_dir: str, out_dir: str,
             epochs: int = 20, batch: int = 64, lr: float = 1e-3, input_size: int = 112) -> None:
    import tensorflow as tf

    backbone = tf.keras.models.load_model(backbone_path)  # outputs 192/512-D embedding
    ds, num_classes = build_dataset(data_dir, input_size, batch)
    head = ArcFace(num_classes)
    emb_dim = backbone.output_shape[-1]
    arc_call, arc_w = head.build(emb_dim)

    opt = tf.keras.optimizers.SGD(lr, momentum=0.9)
    xent = tf.keras.losses.SparseCategoricalCrossentropy(from_logits=True)

    for epoch in range(epochs):
        running, steps = 0.0, 0
        for imgs, labels in ds:
            with tf.GradientTape() as tape:
                emb = backbone(imgs, training=True)
                logits = arc_call(emb, labels)
                loss = xent(labels, logits)
            variables = backbone.trainable_variables + [arc_w]
            grads = tape.gradient(loss, variables)
            opt.apply_gradients(zip(grads, variables))
            running += float(loss)
            steps += 1
        print(f"epoch {epoch + 1}/{epochs}  loss={running / max(steps, 1):.4f}")

    backbone.save(out_dir)  # ship the backbone (head is training-only)
    print(f"Fine-tuned backbone saved to {out_dir} — now run quantize.py")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--backbone", required=True, help="pretrained MobileFaceNet SavedModel")
    ap.add_argument("--data", required=True, help="ImageFolder dir (Indian-demographics)")
    ap.add_argument("--out", required=True, help="output fine-tuned SavedModel dir")
    ap.add_argument("--epochs", type=int, default=20)
    args = ap.parse_args()
    finetune(args.backbone, args.data, args.out, args.epochs)
