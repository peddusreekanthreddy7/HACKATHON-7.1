import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { useIsFocused } from '@react-navigation/native';

import { useCameraAccess, useFaceDetector } from '../hooks';
import { CameraOverlay } from './CameraOverlay';
import { Paragraph } from './Paragraph';
import { PrimaryButton } from './PrimaryButton';
import { palette } from '../navigation/theme';

/**
 * Live face-detection camera. Hosts the vision-camera frame processor and
 * overlays detection results. Pauses (`isActive=false`) when the tab loses
 * focus, so it doesn't burn CPU/battery in the background.
 */
export function FaceCamera(): React.JSX.Element {
  const { hasPermission, request, status } = useCameraAccess();
  const device = useCameraDevice('front');
  const isFocused = useIsFocused();
  const { frameProcessor, result, fps, modelState } = useFaceDetector();

  if (!hasPermission) {
    return (
      <Centered>
        <Paragraph>Camera access is needed to detect faces.</Paragraph>
        <PrimaryButton label="Grant camera permission" onPress={request} />
      </Centered>
    );
  }

  if (device == null) {
    return (
      <Centered>
        <Paragraph>No front camera found on this device ({status}).</Paragraph>
      </Centered>
    );
  }

  return (
    <View style={styles.fill}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isFocused}
        frameProcessor={frameProcessor}
      />
      <CameraOverlay result={result} fps={fps} modelState={modelState} mirrored />
    </View>
  );
}

function Centered({ children }: React.PropsWithChildren): React.JSX.Element {
  return <View style={styles.centered}>{children}</View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 24,
    backgroundColor: palette.bg,
  },
});
