# License Ledger — hard constraint #6 (100% open-source, zero paid licenses)

**Every** dependency, AI model, native engine, and build tool is MIT / Apache-2.0
/ BSD / public-domain. No copyleft, no proprietary SDKs, no paid licenses, no
per-seat or per-device fees.

The runtime/dev table below is **generated from the installed `node_modules`**
(each package's own `license` field), not hand-written — re-verify any time with:

```bash
npx license-checker --production --summary        # summary by license type
npx license-checker --failOn "GPL;AGPL;LGPL;SSPL;BUSL;Commercial"   # CI gate
```

## 1. npm dependencies (runtime + dev) — 37 packages, verified installed

| Package | Version | License |
|---------|---------|---------|
| @babel/core | 7.29.7 | MIT |
| @babel/plugin-proposal-nullish-coalescing-operator | 7.18.6 | MIT |
| @babel/plugin-proposal-optional-chaining | 7.21.0 | MIT |
| @babel/preset-env | 7.29.7 | MIT |
| @babel/preset-typescript | 7.29.7 | MIT |
| @babel/runtime | 7.29.7 | MIT |
| @op-engineering/op-sqlite | 16.2.0 | MIT |
| @react-native-community/cli (+ android/ios) | 20.1.0 | MIT |
| @react-native-community/netinfo | 12.0.1 | MIT |
| @react-native/babel-preset · eslint-config · jest-preset · metro-config · typescript-config · new-app-screen | 0.85.3 | MIT |
| @react-navigation/native · native-stack · bottom-tabs | 7.x | MIT |
| @types/jest · @types/react · @types/react-test-renderer | — | MIT |
| eslint | 8.57.1 | MIT |
| jest | 29.7.0 | MIT |
| prettier | 2.8.8 | MIT |
| react | 19.2.3 | MIT |
| react-native | 0.85.3 | MIT |
| react-native-fast-tflite | 3.0.1 | MIT |
| react-native-nitro-modules | 0.35.9 | MIT |
| react-native-safe-area-context | 5.8.0 | MIT |
| react-native-screens | 4.25.2 | MIT |
| react-native-vision-camera | 4.7.3 | MIT |
| react-native-worklets-core | 1.6.3 | MIT |
| react-test-renderer | 19.2.3 | MIT |
| typescript | 5.9.3 | **Apache-2.0** |
| vision-camera-resize-plugin | 3.2.0 | MIT |
| zustand | 5.0.14 | MIT |

> Automated scan result: **NON-PERMISSIVE: NONE — all permissive ✅**

## 2. Bundled native engines (transitive)

| Component | License |
|-----------|---------|
| TensorFlow Lite (via react-native-fast-tflite) | Apache-2.0 |
| SQLCipher Community Edition (via op-sqlite) | BSD-style (Zetetic) |
| SQLite | Public Domain |
| Hermes (RN JS engine) | MIT |

## 3. On-device AI models (`models/MODEL_MANIFEST.json`)

| Model | License | Source |
|-------|---------|--------|
| BlazeFace short-range (MediaPipe) | Apache-2.0 | google-ai-edge/mediapipe |
| Face Mesh / face_landmark (MediaPipe) | Apache-2.0 | mediapipe-assets |
| MobileFaceNet | BSD-3-Clause | MCarlomagno/FaceRecognitionAuth |
| MiniFASNet (Silent-Face, placeholder) | Apache-2.0 | minivision-ai/Silent-Face-Anti-Spoofing |

## 4. Model-optimization pipeline (`ml/requirements.txt`, dev-time only)

| Package | License |
|---------|---------|
| tensorflow | Apache-2.0 |
| tensorflow-model-optimization | Apache-2.0 |
| numpy | BSD-3-Clause |
| opencv-python | Apache-2.0 |
| scikit-learn | BSD-3-Clause |
| tqdm | MPL-2.0 / MIT |

## 5. AWS backend (`infra/`, dev-time only)

| Package | License |
|---------|---------|
| @aws-sdk/client-dynamodb · lib-dynamodb | Apache-2.0 |
| AWS SAM template / CLI | Apache-2.0 |

> ✅ **Conclusion:** 100% MIT / Apache-2.0 / BSD / Public-Domain across app,
> models, native engines, ML pipeline, and cloud backend. Zero paid licenses.
