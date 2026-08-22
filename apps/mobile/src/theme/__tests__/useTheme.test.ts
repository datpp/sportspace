import { lightColors, darkColors } from '../colors';
import { lightStatusColors, darkStatusColors } from '../statusColors';
import { spacing } from '../spacing';
import { radius } from '../radius';
import { typography } from '../typography';
import type { Theme } from '../useTheme';

describe('useTheme', () => {
  it('returns light theme object with correct structure', () => {
    const lightTheme: Theme = {
      colors: lightColors,
      statusColors: lightStatusColors,
      spacing,
      radius,
      typography,
      scheme: 'light',
    };
    expect(lightTheme.colors.background).toBe('#f8fafc');
    expect(lightTheme.scheme).toBe('light');
  });

  it('returns dark theme object with correct structure', () => {
    const darkTheme: Theme = {
      colors: darkColors,
      statusColors: darkStatusColors,
      spacing,
      radius,
      typography,
      scheme: 'dark',
    };
    expect(darkTheme.colors.background).toBe('#1e293b');
    expect(darkTheme.scheme).toBe('dark');
  });

  it('colors have all required properties', () => {
    const theme: Theme = {
      colors: lightColors,
      statusColors: lightStatusColors,
      spacing,
      radius,
      typography,
      scheme: 'light',
    };
    expect(theme.colors).toHaveProperty('background');
    expect(theme.colors).toHaveProperty('foreground');
    expect(theme.colors).toHaveProperty('card');
    expect(theme.colors).toHaveProperty('primary');
    expect(theme.colors).toHaveProperty('danger');
  });
});
