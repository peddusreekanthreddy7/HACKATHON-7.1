import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { useIsFocused } from '@react-navigation/native';

import { useCameraAccess, useLiveness } from '../hooks';
import { DEMO_LIVENESS_CONFIG } from '../liveness';
import { LivenessOverlay } from './LivenessOverlay';
import { Paragraph } from './Paragraph';
import { PrimaryButton } from './PrimaryButton';
import { palette } from '../navigation/theme';

/**
 * Full liveness flow: passive anti-spoof gate → randomized active challenges →
 * pass/fail. Camera pauses when done (terminal) or when the tab loses focus.
 */
export function LivenessCamera(): React.JSX.Element {
  const { hasPermission, request, status } = useCameraAccess();
  const device = useCameraDevice('front');
  const isFocused = useIsFocused();
  // DEMO_LIVENESS_CONFIG skips the passive anti-spoof gate (MiniFASNet placeholder).
  // Switch to DEFAULT_LIVENESS_CONFIG once the real model is converted.
  const { frameProcessor, liveness, prompt, reset, models } = useLiveness(DEMO_LIVENESS_CONFIG);

  if (!hasPermission) {
    return (
      <Centered>
        <Paragraph>Camera access is needed for liveness verification.</Paragraph>
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

  const terminal = liveness.phase === 'passed' || liveness.phase === 'failed';

  return (
    <View style={styles.fill}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isFocused && !terminal}
        frameProcessor={frameProcessor}
      />
      <LivenessOverlay
        liveness={liveness}
        prompt={prompt}
        antiSpoofState={models.antiSpoof}
        timeoutMs={DEMO_LIVENESS_CONFIG.challengeTimeoutMs}
      />
      {terminal ? (
        <View style={styles.footer}>
          <PrimaryButton label="Try again" onPress={reset} />
        </View>
      ) : null}
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
  footer: { position: 'absolute', bottom: 72, left: 24, right: 24 },
});
