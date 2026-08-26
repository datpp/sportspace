import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { render, screen } from '@testing-library/react-native';
import { ScreenHeader } from '../ScreenHeader';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(),
}));
const mockUseColorScheme = require('react-native/Libraries/Utilities/useColorScheme')
  .default as jest.Mock;

describe('ScreenHeader', () => {
  it('renders the title', async () => {
    await render(<ScreenHeader title="Tìm sân" />);
    expect(screen.getByText('Tìm sân')).toBeTruthy();
  });

  it('renders the subtitle when given', async () => {
    await render(<ScreenHeader title="Tìm sân" subtitle="Quận 7, TP.HCM" />);
    expect(screen.getByText('Quận 7, TP.HCM')).toBeTruthy();
  });

  it('omits the subtitle line when not given', async () => {
    await render(<ScreenHeader title="Tìm sân" />);
    expect(screen.queryByTestId('screen-header-subtitle')).toBeNull();
  });

  it.each(['light', 'dark'] as const)('giữ nền tối ở scheme %s', async (scheme) => {
    mockUseColorScheme.mockReturnValue(scheme);
    await render(<ScreenHeader title="Tìm sân" subtitle="Quận 7" />);
    expect(StyleSheet.flatten(screen.getByText('Tìm sân').parent?.props.style).backgroundColor)
      .toBe('#0f172a');
    expect(StyleSheet.flatten(screen.getByText('Tìm sân').props.style).color).toBe('#f1f5f9');
    expect(
      StyleSheet.flatten(screen.getByTestId('screen-header-subtitle').props.style).color,
    ).toBe('#94a3b8');
  });

  it('cộng safe-area inset vào paddingTop thay vì dùng hằng số', async () => {
    await render(
      <SafeAreaInsetsContext.Provider value={{ top: 59, bottom: 0, left: 0, right: 0 }}>
        <ScreenHeader title="Tìm sân" />
      </SafeAreaInsetsContext.Provider>,
    );
    const header = screen.getByTestId('screen-header');
    expect(StyleSheet.flatten(header.props.style).paddingTop).toBe(59 + 12); // insets.top + spacing.md
  });
});
