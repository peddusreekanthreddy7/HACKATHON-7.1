import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { palette } from '../navigation/theme';

interface Props {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
}: Props): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: palette.brand,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  pressed: { backgroundColor: palette.brandDark },
  disabled: { backgroundColor: '#94A3B8' },
  label: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
