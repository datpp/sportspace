import React from 'react';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test-utils/server';
import {
  getBookingControllerCreateResponseMock,
  getBookingControllerFindOneResponseMock,
} from '@sportspace/shared/mocks';
import { BookingStatus } from '@sportspace/shared';
import { BookingConfirmScreen } from '../BookingConfirmScreen';
import { startVnpayCheckout } from '../../../payments/checkout';
import { WebBrowserResultType } from 'expo-web-browser';
import type { VenuesStackParamList } from '../../../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

jest.mock('../../../payments/checkout', () => ({
  startVnpayCheckout: jest.fn(),
}));

const mockedStartVnpayCheckout = startVnpayCheckout as jest.MockedFunction<typeof startVnpayCheckout>;

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

async function createBookingAndReachSuccess() {
  server.use(
    http.post('*/bookings', () =>
      HttpResponse.json(
        getBookingControllerCreateResponseMock({
          id: 'booking-1',
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
  return user;
}

describe('BookingConfirmScreen', () => {
  afterEach(() => {
    navigate.mockClear();
    goBack.mockClear();
    mockedStartVnpayCheckout.mockReset();
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

  it('thanh toán thành công (browser success) → poll thấy CONFIRMED → hiện đã thanh toán', async () => {
    mockedStartVnpayCheckout.mockResolvedValue({ type: 'success', url: 'sportspace://payment-return' });
    server.use(
      http.get('*/bookings/:id', () =>
        HttpResponse.json(
          getBookingControllerFindOneResponseMock({ id: 'booking-1', status: BookingStatus.CONFIRMED }),
          { status: 200 },
        ),
      ),
    );
    const user = await createBookingAndReachSuccess();

    await user.press(screen.getByTestId('booking-pay-submit'));

    await waitFor(() => expect(screen.getByTestId('booking-success')).toHaveTextContent('Đã thanh toán thành công', { exact: false }));
    expect(mockedStartVnpayCheckout).toHaveBeenCalledWith('booking-1');
  });

  it('đóng trình duyệt giữa chừng (cancel) → báo và cho thử lại', async () => {
    mockedStartVnpayCheckout.mockResolvedValue({ type: WebBrowserResultType.CANCEL });
    const user = await createBookingAndReachSuccess();

    await user.press(screen.getByTestId('booking-pay-submit'));

    expect(await screen.findByTestId('payment-cancelled')).toBeTruthy();
    expect(screen.getByTestId('booking-pay-submit')).toBeTruthy();
  });

  it(
    'poll hết lượt vẫn PENDING → hiện nút Kiểm tra lại',
    async () => {
      mockedStartVnpayCheckout.mockResolvedValue({ type: 'success', url: 'sportspace://payment-return' });
      server.use(
        http.get('*/bookings/:id', () =>
          HttpResponse.json(
            getBookingControllerFindOneResponseMock({ id: 'booking-1', status: BookingStatus.PENDING }),
            { status: 200 },
          ),
        ),
      );
      const user = await createBookingAndReachSuccess();

      await user.press(screen.getByTestId('booking-pay-submit'));

      // Poll thật 5 lần / 1.5s (~7.5s) theo plan đã duyệt — không rút ngắn
      // khoảng poll chỉ để test chạy nhanh, nên nới timeout riêng cho test này.
      expect(await screen.findByTestId('payment-pending', {}, { timeout: 12000 })).toBeTruthy();
      expect(screen.getByTestId('booking-check-again')).toBeTruthy();
    },
    15000,
  );

  it('lỗi gọi checkout API → hiện lỗi', async () => {
    mockedStartVnpayCheckout.mockRejectedValue(new Error('network fail'));
    const user = await createBookingAndReachSuccess();

    await user.press(screen.getByTestId('booking-pay-submit'));

    expect(await screen.findByTestId('payment-checkout-error')).toBeTruthy();
  });
});
