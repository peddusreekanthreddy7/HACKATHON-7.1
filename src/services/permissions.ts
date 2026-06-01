import { Camera, type CameraPermissionStatus } from 'react-native-vision-camera';

/**
 * Camera-permission helpers. The reactive acquisition flow lives in the
 * `useCameraAccess` hook; this service holds the framework-agnostic,
 * unit-testable pure logic + the shared type.
 */
export type { CameraPermissionStatus };

/** True when the camera permission is granted (vision-camera v4 status). */
export function isCameraAuthorized(status: CameraPermissionStatus): boolean {
  return status === 'granted';
}

/** Imperative status read (non-reactive) for use outside React. */
export function getCameraPermissionStatus(): CameraPermissionStatus {
  return Camera.getCameraPermissionStatus();
}
