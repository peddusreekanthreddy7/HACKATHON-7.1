import React, { type PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../navigation/theme';

interface Props {
  title: string;
  caption?: string;
}

/** Titled card used to group related content on a screen. */
export function Section({
  title,
  caption,
  children,
}: PropsWithChildren<Props>): React.JSX.Element {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 16,
    gap: 8,
  },
  title: { fontSize: 16, fontWeight: '700', color: palette.text },
  caption: { fontSize: 13, color: palette.textMuted },
  body: { gap: 6 },
});
