import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test-utils/server';
import { CreateMatchScreen } from '../CreateMatchScreen';
import type { MyBookingsStackParamList } from '../../../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const goBack = jest.fn();
const navigation = { goBack } as unknown as NativeStackNavigationProp<
  MyBookingsStackParamList,
  'CreateMatch'
>;

const params = {
  bookingId: 'booking-1',
  courtName: 'Sân số 1',
  bookingDate: '2026-08-15',
  startTime: '18:00',
  endTime: '19:00',
};

async function renderScreen() {
  return render(
    <CreateMatchScreen navigation={navigation} route={{ key: 'CreateMatch', name: 'CreateMatch', params }} />,
  );
}

describe('CreateMatchScreen', () => {
  afterEach(() => {
    goBack.mockClear();
  });

  it('validate slotsTotal không hợp lệ thì báo lỗi, không gọi API', async () => {
    const createSpy = jest.fn();
    server.use(http.post('*/matches', createSpy));
    const user = userEvent.setup();
    await renderScreen();

    await user.clear(screen.getByTestId('create-match-slots'));
    await user.type(screen.getByTestId('create-match-slots'), '0');
    await user.press(screen.getByTestId('create-match-submit'));

    expect(await screen.findByTestId('create-match-error')).toBeTruthy();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('tạo kèo thành công gọi đúng API rồi quay lại màn trước', async () => {
    let capturedBody: unknown;
    server.use(
      http.post('*/matches', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ id: 'match-1' }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    await renderScreen();

    await user.clear(screen.getByTestId('create-match-slots'));
    await user.type(screen.getByTestId('create-match-slots'), '5');
    await user.type(screen.getByTestId('create-match-skill'), 'Trung bình');
    await user.press(screen.getByTestId('create-match-submit'));

    expect(capturedBody).toEqual({
      bookingId: 'booking-1',
      slotsTotal: 5,
      skillLevel: 'Trung bình',
    });
    expect(goBack).toHaveBeenCalled();
  });

  it('báo lỗi 409 khi booking đã có kèo rồi', async () => {
    server.use(
      http.post('*/matches', () =>
        HttpResponse.json({ message: 'Booking đã có kèo' }, { status: 409 }),
      ),
    );
    const user = userEvent.setup();
    await renderScreen();

    await user.press(screen.getByTestId('create-match-submit'));

    expect(await screen.findByTestId('create-match-error')).toHaveTextContent(
      'Booking này đã có kèo rồi',
    );
  });
});
