export { DEFAULT_LIVENESS_CONFIG, DEMO_LIVENESS_CONFIG, type LivenessConfig } from './config';
export {
  pickChallenges,
  initLiveness,
  advanceLiveness,
} from './challengeMachine';
export {
  CHALLENGE_PROMPT,
  type ChallengeType,
  type ChallengeStatus,
  type ChallengeState,
  type LivenessPhase,
  type LivenessState,
  type LivenessFrame,
} from './types';
