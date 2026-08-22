import React from 'react';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import * as Location from 'expo-location';
import { server } from '../../../test-utils/server';
import { getVenueControllerFindAllResponseMock } from '@sportspace/shared/mocks';
import { VenueListScreen } from '../VenueListScreen';
import type { VenuesStackParamList } from '../../../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

const mockedLocation = Location as jest.Mocked<typeof Location>;
const navigate = jest.fn();
const navigation = { navigate } as unknown as NativeStackNavigationProp<
  VenuesStackParamList,
  'VenueList'
>;

async function renderScreen() {
  return render(<VenueListScreen navigation={navigation} route={{ key: 'VenueList', name: 'VenueList' }} />);
}

describe('VenueListScreen', () => {
  beforeEach(() => {
    mockedLocation.requestForegroundPermissionsAsync.mockResolvedValue({
      status: 'granted',
    } as Awaited<ReturnType<typeof Location.requestForegroundPermissionsAsync>>);
    mockedLocation.getCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: 10.77, longitude: 106.7 },
    } as Awaited<ReturnType<typeof Location.getCurrentPositionAsync>>);
  });

  afterEach(() => {
    navigate.mockClear();
    jest.clearAllMocks();
  });

  it('hiển thị danh sách sân sau khi tải xong', async () => {
    await renderScreen();

    await waitFor(() => expect(screen.queryByTestId('venue-list-loading')).toBeNull());
    expect(screen.getByTestId('venue-list')).toBeTruthy();
  });

  it('hiển thị ScreenHeader với tiêu đề "Tìm sân"', async () => {
    await renderScreen();

    expect(screen.getByTestId('screen-header')).toBeTruthy();
    expect(screen.getByText('Tìm sân')).toBeTruthy();
  });

  it('hiển thị empty state khi không có sân', async () => {
    server.use(http.get('*/venues', () => HttpResponse.json([], { status: 200 })));

    await renderScreen();

    expect(await screen.findByTestId('venue-list-empty')).toBeTruthy();
  });

  it('hiển thị error state khi API lỗi và cho thử lại', async () => {
    server.use(http.get('*/venues', () => HttpResponse.json({ message: 'fail' }, { status: 500 })));

    await renderScreen();

    expect(await screen.findByTestId('venue-list-error')).toBeTruthy();
  });

  it('hiển thị banner khi không có quyền vị trí nhưng vẫn tải được danh sách', async () => {
    mockedLocation.requestForegroundPermissionsAsync.mockResolvedValue({
      status: 'denied',
    } as Awaited<ReturnType<typeof Location.requestForegroundPermissionsAsync>>);

    await renderScreen();

    expect(await screen.findByTestId('venue-location-banner')).toBeTruthy();
    await waitFor(() => expect(screen.queryByTestId('venue-list-loading')).toBeNull());
    expect(screen.getByTestId('venue-list')).toBeTruthy();
  });

  it('lọc theo bộ môn gửi đúng query param sport', async () => {
    let capturedSport: string | null = null;
    server.use(
      http.get('*/venues', ({ request }) => {
        const url = new URL(request.url);
        capturedSport = url.searchParams.get('sport');
        return HttpResponse.json(getVenueControllerFindAllResponseMock(), { status: 200 });
      }),
    );
    const user = userEvent.setup();
    await renderScreen();
    await waitFor(() => expect(screen.queryByTestId('venue-list-loading')).toBeNull());

    await user.type(screen.getByTestId('venue-sport-input'), 'bong-da');
    await user.press(screen.getByTestId('venue-search-submit'));

    await waitFor(() => expect(capturedSport).toBe('bong-da'));
  });

  it('bấm vào 1 sân điều hướng sang VenueDetail với đúng id/tên', async () => {
    const oneVenue = getVenueControllerFindAllResponseMock().slice(0, 1);
    server.use(http.get('*/venues', () => HttpResponse.json(oneVenue, { status: 200 })));
    const user = userEvent.setup();
    await renderScreen();

    const item = await screen.findByTestId(`venue-item-${oneVenue[0].id}`);
    await user.press(item);

    expect(navigate).toHaveBeenCalledWith('VenueDetail', {
      venueId: oneVenue[0].id,
      venueName: oneVenue[0].name,
    });
  });
});
