import { renderHook } from '@testing-library/react-native';
import { useTheme } from '../useTheme';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('useTheme', () => {
  const mockUseColorScheme = require('react-native/Libraries/Utilities/useColorScheme').default as jest.Mock;

  beforeEach(() => {
    mockUseColorScheme.mockClear();
  });

  it('returns light colors when the OS scheme is light', async () => {
    mockUseColorScheme.mockReturnValue('light');
    const { result } = await renderHook(() => useTheme());
    expect(result.current.colors.background).toBe('#f8fafc');
    expect(result.current.scheme).toBe('light');
    expect(result.current.statusColors.success.bg).toBe('#ecfdf5');
  });

  it('returns dark colors when the OS scheme is dark', async () => {
    mockUseColorScheme.mockReturnValue('dark');
    const { result } = await renderHook(() => useTheme());
    expect(result.current.colors.background).toBe('#1e293b');
    expect(result.current.scheme).toBe('dark');
    expect(result.current.statusColors.success.bg).toBe('#022c22');
  });

  it('falls back to light when the OS scheme is null (unknown)', async () => {
    mockUseColorScheme.mockReturnValue(null);
    const { result } = await renderHook(() => useTheme());
    expect(result.current.scheme).toBe('light');
    expect(result.current.colors.background).toBe('#f8fafc');
    expect(result.current.statusColors.danger.text).toBe('#b91c1c');
  });

  it('falls back to light when the OS scheme is undefined', async () => {
    mockUseColorScheme.mockReturnValue(undefined);
    const { result } = await renderHook(() => useTheme());
    expect(result.current.scheme).toBe('light');
    expect(result.current.colors.background).toBe('#f8fafc');
  });
});
