import React from 'react';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test-utils/server';
import { getVenueControllerFindOneResponseMock } from '@sportspace/shared/mocks';
import { VenueDetailScreen } from '../VenueDetailScreen';
import type { VenuesStackParamList } from '../../../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const navigate = jest.fn();
const navigation = { navigate } as unknown as NativeStackNavigationProp<
  VenuesStackParamList,
  'VenueDetail'
>;

async function renderScreen(venueId = 'venue-1') {
  return render(
    <VenueDetailScreen
      navigation={navigation}
      route={{ key: 'VenueDetail', name: 'VenueDetail', params: { venueId, venueName: 'Sân test' } }}
    />,
  );
}

describe('VenueDetailScreen', () => {
  afterEach(() => {
    navigate.mockClear();
  });

  it('hiển thị thông tin sân và danh sách sân con sau khi tải xong', async () => {
    await renderScreen();

    await waitFor(() => expect(screen.queryByTestId('venue-detail-loading')).toBeNull());
    expect(screen.getByTestId('venue-detail-screen')).toBeTruthy();
    expect(screen.getByTestId('court-list')).toBeTruthy();
  });

  it('hiển thị error state khi API lỗi và cho thử lại', async () => {
    server.use(http.get('*/venues/:id', () => HttpResponse.json({ message: 'fail' }, { status: 500 })));

    await renderScreen();

    expect(await screen.findByTestId('venue-detail-error')).toBeTruthy();
  });

  it('bấm vào 1 sân con điều hướng sang CourtSlots với đúng tham số', async () => {
    const venue = getVenueControllerFindOneResponseMock({
      courts: [
        {
          id: 'court-1',
          name: 'Sân số 1',
          sport: 'Bóng đá',
          basePrice: 200000,
          priceRules: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });
    server.use(http.get('*/venues/:id', () => HttpResponse.json(venue, { status: 200 })));
    const user = userEvent.setup();
    await renderScreen();

    const court = await screen.findByTestId('court-item-court-1');
    await user.press(court);

    expect(navigate).toHaveBeenCalledWith('CourtSlots', {
      courtId: 'court-1',
      courtName: 'Sân số 1',
      venueName: venue.name,
    });
  });
});
