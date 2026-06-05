import React, { useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { palette } from '../navigation/theme';

interface Props {
  label: string;
  min: number;
  max: number;
  /** Snap step. 0 = continuous. */
  step?: number;
  value: number;
  onChange: (v: number) => void;
  /** Custom value formatter for the readout. */
  format?: (v: number) => string;
}

/**
 * Pure-JS slider — uses only RN core (PanResponder), so it adds NO native
 * dependency (keeps the APK build clean). Drag the track or tap −/+ to adjust.
 */
export function DebugSlider({
  label,
  min,
  max,
  step = 0,
  value,
  onChange,
  format,
}: Props): React.JSX.Element {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);

  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const snap = (v: number) => (step > 0 ? Math.round(v / step) * step : v);
  const fromX = (x: number) => {
    const w = widthRef.current || 1;
    const ratio = Math.min(1, Math.max(0, x / w));
    return clamp(snap(min + ratio * (max - min)));
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: e => onChange(fromX(e.nativeEvent.locationX)),
      onPanResponderMove: e => onChange(fromX(e.nativeEvent.locationX)),
    }),
  ).current;

  const pct = max > min ? (value - min) / (max - min) : 0;
  const stepNudge = step > 0 ? step : (max - min) / 20;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>
          {format ? format(value) : value.toFixed(2)}
        </Text>
      </View>
      <View style={styles.controlRow}>
        <Pressable
          style={styles.nudge}
          onPress={() => onChange(clamp(snap(value - stepNudge)))}>
          <Text style={styles.nudgeLabel}>−</Text>
        </Pressable>
        <View
          style={styles.track}
          onLayout={e => {
            const w = e.nativeEvent.layout.width;
            widthRef.current = w;
            setWidth(w);
          }}
          {...pan.panHandlers}>
          <View style={styles.trackLine} />
          <View style={[styles.fill, { width: `${pct * 100}%` }]} />
          <View style={[styles.thumb, { left: Math.max(0, pct * width - 11) }]} />
        </View>
        <Pressable
          style={styles.nudge}
          onPress={() => onChange(clamp(snap(value + stepNudge)))}>
          <Text style={styles.nudgeLabel}>+</Text>
        </Pressable>
      </View>
      <View style={styles.rangeRow}>
        <Text style={styles.range}>{format ? format(min) : min}</Text>
        <Text style={styles.range}>{format ? format(max) : max}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, paddingVertical: 6 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 14, color: palette.text, fontWeight: '600' },
  value: { fontSize: 14, color: palette.brand, fontWeight: '700' },
  controlRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nudge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: palette.bg,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nudgeLabel: { fontSize: 20, color: palette.text, fontWeight: '700' },
  track: {
    flex: 1,
    height: 34,
    justifyContent: 'center',
  },
  trackLine: {
    position: 'absolute',
    top: 14,
    left: 0,
    right: 0,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.border,
  },
  fill: {
    position: 'absolute',
    top: 14,
    left: 0,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.brand,
  },
  thumb: {
    position: 'absolute',
    top: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: palette.brand,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    elevation: 2,
  },
  rangeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  range: { fontSize: 11, color: palette.textMuted },
});
