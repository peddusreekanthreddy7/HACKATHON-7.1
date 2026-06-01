import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../navigation/theme';

type Tone = 'success' | 'danger' | 'warning' | 'neutral';

const TONE: Record<Tone, { bg: string; fg: string }> = {
  success: { bg: '#DCFCE7', fg: palette.success },
  danger: { bg: '#FEE2E2', fg: palette.danger },
  warning: { bg: '#FEF3C7', fg: palette.warning },
  neutral: { bg: '#E2E8F0', fg: palette.textMuted },
};

export function StatusPill({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: Tone;
}): React.JSX.Element {
  const c = TONE[tone];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: { fontSize: 12, fontWeight: '700' },
});
