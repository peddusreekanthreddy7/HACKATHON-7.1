import { DefaultTheme, type Theme } from '@react-navigation/native';

/** Single source of truth for brand colours used across screens + navigation. */
export const palette = {
  brand: '#0B7285',
  brandDark: '#095C6B',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  text: '#0F172A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  success: '#16A34A',
  danger: '#DC2626',
  warning: '#D97706',
} as const;

export const navTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: palette.brand,
    background: palette.bg,
    card: palette.card,
    text: palette.text,
    border: palette.border,
  },
};
