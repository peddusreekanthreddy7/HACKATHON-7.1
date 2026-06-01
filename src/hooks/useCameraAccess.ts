import { useCallback, useEffect, useState } from 'react';
import {
  Camera,
  useCameraPermission,
  type CameraPermissionStatus,
} from 'react-native-vision-camera';

export interface CameraAccess {
  /** Detailed status: granted | not-determined | denied | restricted. */
  status: CameraPermissionStatus;
  /** Convenience flag — true when status is 'granted'. */
  hasPermission: boolean;
  /** Prompts the OS permission dialog; resolves true if granted. */
  request: () => Promise<boolean>;
}

/**
 * App-facing wrapper over vision-camera's permission API (v4): the reactive
 * `useCameraPermission` hook for `hasPermission`, plus the static status enum
 * for a precise UI label.
 */
export function useCameraAccess(): CameraAccess {
  const { hasPermission, requestPermission } = useCameraPermission();
  const [status, setStatus] = useState<CameraPermissionStatus>(() =>
    Camera.getCameraPermissionStatus(),
  );

  useEffect(() => {
    setStatus(Camera.getCameraPermissionStatus());
  }, [hasPermission]);

  const request = useCallback(async () => {
    const granted = await requestPermission();
    setStatus(Camera.getCameraPermissionStatus());
    return granted;
  }, [requestPermission]);

  return { status, hasPermission, request };
}
