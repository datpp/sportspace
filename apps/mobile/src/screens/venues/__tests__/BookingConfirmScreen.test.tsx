import React from 'react';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test-utils/server';
import { getBookingControllerCreateResponseMock } from '@sportspace/shared/mocks';
import { BookingStatus } from '@sportspace/shared';
import { BookingConfirmScreen } from '../BookingConfirmScreen';
import type { VenuesStackParamList } from '../../../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const navigate = jest.fn();
const goBack = jest.fn();
const getParent = jest.fn(() => ({ navigate }));
const navigation = {
  navigate,
  goBack,
  getParent,
} as unknown as NativeStackNavigationProp<VenuesStackParamList, 'BookingConfirm'>;

const params = {
  courtId: 'court-1',
  courtName: 'Sân số 1',
  venueName: 'Sân test',
  bookingDate: '2026-08-10',
  startTime: '06:00',
  endTime: '07:00',
  price: 200000,
};

async function renderScreen() {
  return render(
    <BookingConfirmScreen
      navigation={navigation}
      route={{ key: 'BookingConfirm', name: 'BookingConfirm', params }}
    />,
  );
}

describe('BookingConfirmScreen', () => {
  afterEach(() => {
    navigate.mockClear();
    goBack.mockClear();
  });

  it('đặt sân thành công hiện countdown giữ chỗ 5 phút', async () => {
    server.use(
      http.post('*/bookings', () =>
        HttpResponse.json(
          getBookingControllerCreateResponseMock({
            status: BookingStatus.PENDING,
            createdAt: new Date().toISOString(),
          }),
          { status: 201 },
        ),
      ),
    );
    const user = userEvent.setup();
    await renderScreen();

    await user.press(screen.getByTestId('booking-confirm-submit'));

    expect(await screen.findByTestId('booking-success')).toBeTruthy();
    expect(screen.getByTestId('booking-countdown')).toHaveTextContent('5:00');
  });

  it('gặp 409 báo chọn ô khác, bấm nút quay lại chọn slot khác', async () => {
    server.use(
      http.post('*/bookings', () =>
        HttpResponse.json({ message: 'Ô giờ đang được đặt' }, { status: 409 }),
      ),
    );
    const user = userEvent.setup();
    await renderScreen();

    await user.press(screen.getByTestId('booking-confirm-submit'));

    expect(await screen.findByTestId('booking-conflict')).toBeTruthy();

    await user.press(screen.getByTestId('booking-conflict-back'));
    expect(goBack).toHaveBeenCalled();
  });

  it('hiển thị lỗi chung khi API thất bại vì lý do khác 409', async () => {
    server.use(http.post('*/bookings', () => HttpResponse.json({ message: 'fail' }, { status: 500 })));
    const user = userEvent.setup();
    await renderScreen();

    await user.press(screen.getByTestId('booking-confirm-submit'));

    expect(await screen.findByTestId('booking-error')).toBeTruthy();
  });

  it('sau khi đặt thành công có thể điều hướng sang Lịch của tôi', async () => {
    server.use(
      http.post('*/bookings', () =>
        HttpResponse.json(
          getBookingControllerCreateResponseMock({
            status: BookingStatus.PENDING,
            createdAt: new Date().toISOString(),
          }),
          { status: 201 },
        ),
      ),
    );
    const user = userEvent.setup();
    await renderScreen();
    await user.press(screen.getByTestId('booking-confirm-submit'));
    await screen.findByTestId('booking-success');

    await user.press(screen.getByTestId('booking-go-my-bookings'));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('MyBookings'));
  });
});
