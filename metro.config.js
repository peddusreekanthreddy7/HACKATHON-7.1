const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * We register model/binary extensions as ASSETS so on-device AI models in
 * /models (TFLite, ONNX, raw weights) are bundled and resolvable at runtime
 * for fully-offline inference (hard constraint #4).
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    assetExts: [
      ...defaultConfig.resolver.assetExts,
      'tflite', // TensorFlow Lite models (react-native-fast-tflite)
      'onnx', // ONNX Runtime Mobile fallback models
      'bin', // raw quantized weights / label maps
    ],
  },
};

module.exports = mergeConfig(defaultConfig, config);
