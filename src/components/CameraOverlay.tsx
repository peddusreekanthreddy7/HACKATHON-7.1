import React, { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';

import type { FaceScanResult, ModelState } from '../hooks';
import { palette } from '../navigation/theme';

interface Props {
  result: FaceScanResult;
  fps: number;
  modelState: ModelState;
  /** Front-camera preview is mirrored, so flip the box X for visual alignment. */
  mirrored?: boolean;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Draws the face bounding box + a face-found indicator + a debug HUD (FPS,
 * brightness/lighting, model state) on top of the camera preview.
 *
 * NOTE: detection runs on a center-cropped 128² square, so exact box alignment
 * vs the full preview (crop/aspect/orientation) is a known TUNE-ON-DEVICE item.
 */
export function CameraOverlay({
  result,
  fps,
  modelState,
  mirrored,
}: Props): React.JSX.Element {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onLayout = (e: LayoutChangeEvent) => setSize(e.nativeEvent.layout);

  const { face, brightness, lighting } = result;
  const found = face != null;

  const box = face
    ? {
        left:
          (mirrored ? clamp01(1 - (face.bbox.x + face.bbox.width)) : clamp01(face.bbox.x)) *
          size.width,
        top: clamp01(face.bbox.y) * size.height,
        width: clamp01(face.bbox.width) * size.width,
        height: clamp01(face.bbox.height) * size.height,
      }
    : null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={onLayout}>
      {box ? (
        <View
          style={[
            styles.box,
            box,
            { borderColor: found ? palette.success : palette.warning },
          ]}
        />
      ) : null}

      <View style={styles.topBar}>
        <View
          style={[
            styles.dot,
            { backgroundColor: found ? palette.success : palette.danger },
          ]}
        />
        <Text style={styles.topText}>
          {found
            ? `Face detected · ${Math.round(face!.score * 100)}%`
            : 'Searching for a face…'}
        </Text>
      </View>

      <View style={styles.hud}>
        <Text style={styles.hudText}>FPS {fps}</Text>
        <Text style={styles.hudText}>
          Light {Math.round(brightness * 100)}% · {lighting}
        </Text>
        <Text style={styles.hudText}>Model {modelState}</Text>
        {modelState === 'error' ? (
          <Text style={styles.hudWarn}>run: npm run fetch:models</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    borderWidth: 3,
    borderRadius: 12,
  },
  topBar: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 8,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  topText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  hud: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 2,
  },
  hudText: { color: '#fff', fontSize: 12, fontVariant: ['tabular-nums'] },
  hudWarn: { color: palette.warning, fontSize: 12, fontWeight: '700' },
});
