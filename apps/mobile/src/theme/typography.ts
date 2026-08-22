import type { TextStyle } from 'react-native';

export const typography: Record<'title' | 'heading' | 'body' | 'caption', TextStyle> = {
  title: { fontSize: 24, fontWeight: '800' },
  heading: { fontSize: 16, fontWeight: '700' },
  body: { fontSize: 14, fontWeight: '400' },
  caption: { fontSize: 12, fontWeight: '400' },
};
