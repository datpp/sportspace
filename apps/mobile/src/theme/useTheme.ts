import { useColorScheme } from 'react-native';
import { darkColors, lightColors, type ThemeColors } from './colors';
import { darkStatusColors, lightStatusColors, type StatusColorPair, type StatusVariant } from './statusColors';
import { radius } from './radius';
import { spacing } from './spacing';
import { typography } from './typography';

export interface Theme {
  colors: ThemeColors;
  statusColors: Record<StatusVariant, StatusColorPair>;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  scheme: 'light' | 'dark';
}

export function useTheme(): Theme {
  const osScheme = useColorScheme();
  const scheme: 'light' | 'dark' = osScheme === 'dark' ? 'dark' : 'light';
  return {
    colors: scheme === 'dark' ? darkColors : lightColors,
    statusColors: scheme === 'dark' ? darkStatusColors : lightStatusColors,
    spacing,
    radius,
    typography,
    scheme,
  };
}
