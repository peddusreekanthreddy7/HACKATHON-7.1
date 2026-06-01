import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

/**
 * Top-level destinations. Kept as a bottom-tab set for Phase 1; individual tabs
 * (e.g. Enroll, Verify) will host their own native-stacks for multi-step camera
 * flows in later phases.
 */
export type RootTabParamList = {
  Enroll: undefined;
  Verify: undefined;
  Sync: undefined;
  Admin: undefined;
};

export type RootTabScreenProps<T extends keyof RootTabParamList> =
  BottomTabScreenProps<RootTabParamList, T>;
