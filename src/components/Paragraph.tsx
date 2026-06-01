import React, { type PropsWithChildren } from 'react';
import { StyleSheet, Text } from 'react-native';
import { palette } from '../navigation/theme';

/** Body copy with consistent colour, size and line-height. */
export function Paragraph({ children }: PropsWithChildren): React.JSX.Element {
  return <Text style={styles.p}>{children}</Text>;
}

const styles = StyleSheet.create({
  p: { color: palette.text, fontSize: 14, lineHeight: 20 },
});
