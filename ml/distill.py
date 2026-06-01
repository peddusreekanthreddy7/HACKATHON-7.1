"""
Knowledge distillation for face embeddings (optional accuracy booster before
quantisation). Unlike classification KD (soft logits), face models distill in
the EMBEDDING space: the small student learns to reproduce a large teacher's
512-D embeddings, so it inherits the teacher's discriminative geometry at a
fraction of the size.

Loss = (1 - cos(student, teacher)) + λ · MSE(student, teacher)

Teacher: a large pretrained ArcFace/MobileFaceNet (FP32, ~100 MB+ — used only at
train time, never shipped).  Student: the small MobileFaceNet we ship.

Open-source only (TF/Keras). Needs Python 3.11/3.12 + ml/requirements.txt.
"""
from __future__ import annotations

import argparse


def distillation_loss(lam: float = 0.5):
    import tensorflow as tf

    def loss(teacher_emb, student_emb):
        t = tf.math.l2_normalize(teacher_emb, axis=1)
        s = tf.math.l2_normalize(student_emb, axis=1)
        cosine = 1.0 - tf.reduce_mean(tf.reduce_sum(t * s, axis=1))
        mse = tf.reduce_mean(tf.square(t - s))
        return cosine + lam * mse

    return loss


def build_dataset(images_dir: str, batch: int, input_size: int = 112):
    """tf.data pipeline of augmented face crops (no labels needed for KD)."""
    import tensorflow as tf
    import numpy as np
    from augment import augment

    rng = np.random.default_rng(0)

    def _aug(path):
        def _np(p):
            img = tf.io.read_file(p)
            return img

        raw = tf.io.read_file(path)
        img = tf.image.decode_jpeg(raw, channels=3)
        img = tf.image.resize(img, (input_size, input_size))

        def _augment(x):
            return augment(x.numpy().astype("uint8"), rng).astype("float32")

        img = tf.py_function(_augment, [img], tf.float32)
        img.set_shape((input_size, input_size, 3))
        return (img - 128.0) / 128.0

    files = tf.data.Dataset.list_files(images_dir + "/*/*.jpg")
    return files.map(_aug, num_parallel_calls=tf.data.AUTOTUNE).batch(batch).prefetch(tf.data.AUTOTUNE)


def distill(teacher_path: str, student_path: str, images_dir: str, out_dir: str,
            epochs: int = 5, batch: int = 64, lam: float = 0.5) -> None:
    import tensorflow as tf

    teacher = tf.keras.models.load_model(teacher_path)
    teacher.trainable = False
    student = tf.keras.models.load_model(student_path)

    opt = tf.keras.optimizers.Adam(1e-4)
    loss_fn = distillation_loss(lam)
    ds = build_dataset(images_dir, batch)

    for epoch in range(epochs):
        running = 0.0
        steps = 0
        for batch_imgs in ds:
            with tf.GradientTape() as tape:
                t_emb = teacher(batch_imgs, training=False)
                s_emb = student(batch_imgs, training=True)
                loss = loss_fn(t_emb, s_emb)
            grads = tape.gradient(loss, student.trainable_variables)
            opt.apply_gradients(zip(grads, student.trainable_variables))
            running += float(loss)
            steps += 1
        print(f"epoch {epoch + 1}/{epochs}  distill_loss={running / max(steps, 1):.4f}")

    student.save(out_dir)
    print(f"Distilled student saved to {out_dir} — feed it to quantize.py")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--teacher", required=True, help="large teacher SavedModel")
    ap.add_argument("--student", required=True, help="small MobileFaceNet SavedModel")
    ap.add_argument("--images", required=True, help="unlabelled face-crop dir (class subfolders)")
    ap.add_argument("--out", required=True, help="output student SavedModel dir")
    ap.add_argument("--epochs", type=int, default=5)
    ap.add_argument("--lam", type=float, default=0.5)
    args = ap.parse_args()
    distill(args.teacher, args.student, args.images, args.out, args.epochs, lam=args.lam)
