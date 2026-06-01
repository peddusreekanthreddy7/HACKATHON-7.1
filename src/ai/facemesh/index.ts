export {
  eyeAspectRatio,
  averageEAR,
  mouthAspectRatio,
  smileRatio,
  headYawNorm,
  headPitchNorm,
  estimateHeadPose,
  type HeadPose,
} from './geometry';
export {
  umeyama2D,
  transformPoint,
  invertAffine,
  extract5Points,
  alignedCropParams,
  CANONICAL_112,
  MOBILEFACENET_INPUT_SIZE,
  type Point2D,
  type AffineMatrix,
  type AlignedCrop,
} from './alignment';
export {
  decodeLandmarks,
  facePresenceScore,
  FACEMESH_INPUT_SIZE,
  FACEMESH_LANDMARK_COUNT,
} from './decode';
export {
  LEFT_EYE_EAR,
  RIGHT_EYE_EAR,
  MOUTH,
  POSE,
  NUM_LANDMARKS,
} from './landmarks';
export type { Landmark, FaceLandmarks } from './types';
