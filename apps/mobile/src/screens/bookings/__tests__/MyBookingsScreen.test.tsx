import React from 'react';
import { Alert } from 'react-native';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test-utils/server';
import {
  getBookingControllerCancelResponseMock,
  getBookingControllerFindAllResponseMock,
} from '@sportspace/shared/mocks';
import { BookingStatus } from '@sportspace/shared';
import { MyBookingsScreen } from '../MyBookingsScreen';
import type { MyBookingsStackParamList } from '../../../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const navigate = jest.fn();
const navigation = { navigate } as unknown as NativeStackNavigationProp<
  MyBookingsStackParamList,
  'MyBookingsList'
>;

async function renderScreen() {
  return render(
    // MyBookingsScreen dùng useFocusEffect để refetch khi tab được focus lại.
    <NavigationContainer>
      <MyBookingsScreen navigation={navigation} route={{ key: 'MyBookingsList', name: 'MyBookingsList' }} />
    </NavigationContainer>,
  );
}

describe('MyBookingsScreen', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    navigate.mockClear();
  });

  it('hiển thị danh sách lịch đặt sân sau khi tải xong', async () => {
    await renderScreen();

    await waitFor(() => expect(screen.queryByTestId('my-bookings-loading')).toBeNull());
    expect(screen.getByTestId('my-bookings-list')).toBeTruthy();
  });

  it('hiển thị empty state khi chưa có lịch nào', async () => {
    server.use(http.get('*/bookings', () => HttpResponse.json([], { status: 200 })));

    await renderScreen();

    expect(await screen.findByTestId('my-bookings-empty')).toBeTruthy();
  });

  it('hiển thị error state khi API lỗi', async () => {
    server.use(http.get('*/bookings', () => HttpResponse.json({ message: 'fail' }, { status: 500 })));

    await renderScreen();

    expect(await screen.findByTestId('my-bookings-error')).toBeTruthy();
  });

  it('xác nhận huỷ lịch gọi API cancel và cập nhật trạng thái', async () => {
    const booking = getBookingControllerFindAllResponseMock()[0];
    booking.status = BookingStatus.CONFIRMED;
    server.use(http.get('*/bookings', () => HttpResponse.json([booking], { status: 200 })));
    server.use(
      http.post('*/bookings/:id/cancel', () =>
        HttpResponse.json(
          getBookingControllerCancelResponseMock({ ...booking, status: BookingStatus.CANCELLED }),
          { status: 201 },
        ),
      ),
    );
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const confirmButton = buttons?.find((b) => b.text === 'Huỷ lịch');
      confirmButton?.onPress?.();
    });

    const user = userEvent.setup();
    await renderScreen();

    const cancelButton = await screen.findByTestId(`booking-cancel-${booking.id}`);
    await user.press(cancelButton);

    await waitFor(() =>
      expect(screen.getByTestId(`booking-item-${booking.id}`)).toHaveTextContent('Đã huỷ', {
        exact: false,
      }),
    );
  });

  it('không huỷ khi bấm "Không" trong hộp thoại xác nhận', async () => {
    const booking = getBookingControllerFindAllResponseMock()[0];
    booking.status = BookingStatus.CONFIRMED;
    server.use(http.get('*/bookings', () => HttpResponse.json([booking], { status: 200 })));
    const cancelSpy = jest.fn();
    server.use(http.post('*/bookings/:id/cancel', cancelSpy));
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const dismissButton = buttons?.find((b) => b.text === 'Không');
      dismissButton?.onPress?.();
    });

    const user = userEvent.setup();
    await renderScreen();

    const cancelButton = await screen.findByTestId(`booking-cancel-${booking.id}`);
    await user.press(cancelButton);

    expect(cancelSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId(`booking-item-${booking.id}`)).toHaveTextContent('Đã xác nhận', {
      exact: false,
    });
  });

  it('booking CONFIRMED hiện nút Tạo kèo, bấm điều hướng sang CreateMatch đúng tham số', async () => {
    const booking = getBookingControllerFindAllResponseMock()[0];
    booking.status = BookingStatus.CONFIRMED;
    server.use(http.get('*/bookings', () => HttpResponse.json([booking], { status: 200 })));
    const user = userEvent.setup();
    await renderScreen();

    const createMatchButton = await screen.findByTestId(`booking-create-match-${booking.id}`);
    await user.press(createMatchButton);

    expect(navigate).toHaveBeenCalledWith('CreateMatch', {
      bookingId: booking.id,
      courtName: booking.court.name,
      bookingDate: booking.bookingDate,
      startTime: booking.startTime,
      endTime: booking.endTime,
    });
  });

  it('booking PENDING không hiện nút Tạo kèo', async () => {
    const booking = getBookingControllerFindAllResponseMock()[0];
    booking.status = BookingStatus.PENDING;
    server.use(http.get('*/bookings', () => HttpResponse.json([booking], { status: 200 })));
    await renderScreen();

    await screen.findByTestId(`booking-item-${booking.id}`);
    expect(screen.queryByTestId(`booking-create-match-${booking.id}`)).toBeNull();
  });
});
