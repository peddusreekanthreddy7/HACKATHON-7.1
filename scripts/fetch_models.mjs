/**
 * Downloads the on-device AI models into /models so inference is fully offline
 * (the files are then bundled by Metro). Re-runnable + idempotent.
 *
 *   npm run fetch:models
 *
 * All models are permissively licensed (see LICENSES.md). Sizes + SHA-256 are
 * printed so they can be recorded in models/MODEL_MANIFEST.json.
 */
import { writeFile, mkdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = path.join(__dirname, '..', 'models');

const MODELS = [
  {
    file: 'blazeface.tflite',
    // MediaPipe BlazeFace short-range (Apache-2.0): 128x128 input, 896 anchors.
    url: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
  },
  {
    file: 'face_landmark.tflite',
    // MediaPipe Face Mesh (Apache-2.0): 192x192 face crop -> 468 3D landmarks.
    url: 'https://storage.googleapis.com/mediapipe-assets/face_landmark.tflite',
  },
  {
    file: 'mobilefacenet.tflite',
    // MobileFaceNet (MCarlomagno/FaceRecognitionAuth, BSD-3-Clause): 112x112 RGB
    // input normalised to [-1,1] via (px-128)/128 -> 192-D float32 embedding.
    url: 'https://github.com/MCarlomagno/FaceRecognitionAuth/raw/master/assets/mobilefacenet.tflite',
  },
  // NOTE: MiniFASNet (passive anti-spoof) ships only as PyTorch .pth upstream.
  // Run `python scripts/convert_minifasnet.py` to produce models/minifasnet.tflite.
  //
  // OPTIONAL: scripts/convert_mobilefacenet.py can INT8-quantise the float
  // MobileFaceNet above (~5 MB -> ~1.3 MB) for a smaller footprint.
];

await mkdir(MODELS_DIR, { recursive: true });

let failed = false;
for (const m of MODELS) {
  const dest = path.join(MODELS_DIR, m.file);
  try {
    const res = await fetch(m.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(dest, buf);
    const sha = createHash('sha256').update(buf).digest('hex');
    console.log(
      `OK  ${m.file}  ${(buf.length / 1e6).toFixed(3)} MB  sha256:${sha}`,
    );
  } catch (e) {
    failed = true;
    console.error(`FAIL ${m.file}: ${e.message}\n     ${m.url}`);
  }
}
process.exit(failed ? 1 : 0);
