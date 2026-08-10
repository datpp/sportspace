import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { useCurrentLocation } from '../useCurrentLocation';

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

const mockedLocation = Location as jest.Mocked<typeof Location>;

describe('useCurrentLocation', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('trả về toạ độ khi quyền được cấp', async () => {
    mockedLocation.requestForegroundPermissionsAsync.mockResolvedValue({
      status: 'granted',
    } as Awaited<ReturnType<typeof Location.requestForegroundPermissionsAsync>>);
    mockedLocation.getCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: 10.77, longitude: 106.7 },
    } as Awaited<ReturnType<typeof Location.getCurrentPositionAsync>>);

    const { result } = await renderHook(() => useCurrentLocation());

    await waitFor(() => expect(result.current.status).toBe('granted'));
    expect(result.current).toMatchObject({ status: 'granted', coords: { lat: 10.77, lng: 106.7 } });
  });

  it('trả về denied khi người dùng từ chối quyền', async () => {
    mockedLocation.requestForegroundPermissionsAsync.mockResolvedValue({
      status: 'denied',
    } as Awaited<ReturnType<typeof Location.requestForegroundPermissionsAsync>>);

    const { result } = await renderHook(() => useCurrentLocation());

    await waitFor(() => expect(result.current.status).toBe('denied'));
  });

  it('retry gọi lại luồng xin quyền và có thể thành công sau khi trước đó bị từ chối', async () => {
    mockedLocation.requestForegroundPermissionsAsync.mockResolvedValueOnce({
      status: 'denied',
    } as Awaited<ReturnType<typeof Location.requestForegroundPermissionsAsync>>);

    const { result } = await renderHook(() => useCurrentLocation());
    await waitFor(() => expect(result.current.status).toBe('denied'));

    mockedLocation.requestForegroundPermissionsAsync.mockResolvedValueOnce({
      status: 'granted',
    } as Awaited<ReturnType<typeof Location.requestForegroundPermissionsAsync>>);
    mockedLocation.getCurrentPositionAsync.mockResolvedValueOnce({
      coords: { latitude: 1, longitude: 2 },
    } as Awaited<ReturnType<typeof Location.getCurrentPositionAsync>>);

    await act(async () => {
      await result.current.retry();
    });

    expect(result.current).toMatchObject({ status: 'granted', coords: { lat: 1, lng: 2 } });
  });
});
