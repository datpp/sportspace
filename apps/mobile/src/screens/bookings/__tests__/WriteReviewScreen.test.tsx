import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test-utils/server';
import { WriteReviewScreen } from '../WriteReviewScreen';
import type { MyBookingsStackParamList } from '../../../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const goBack = jest.fn();
const navigation = { goBack } as unknown as NativeStackNavigationProp<
  MyBookingsStackParamList,
  'WriteReview'
>;

const params = { bookingId: 'booking-1', courtName: 'Sân số 1' };

async function renderScreen() {
  return render(
    <WriteReviewScreen navigation={navigation} route={{ key: 'WriteReview', name: 'WriteReview', params }} />,
  );
}

describe('WriteReviewScreen', () => {
  afterEach(() => {
    goBack.mockClear();
  });

  it('gửi đánh giá thành công gọi đúng API rồi quay lại màn trước', async () => {
    let capturedBody: unknown;
    server.use(
      http.post('*/reviews', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ id: 'review-1' }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    await renderScreen();

    await user.press(screen.getByTestId('write-review-star-4'));
    await user.type(screen.getByTestId('write-review-comment'), 'Sân đẹp');
    await user.press(screen.getByTestId('write-review-submit'));

    expect(capturedBody).toEqual({ bookingId: 'booking-1', rating: 4, comment: 'Sân đẹp' });
    expect(goBack).toHaveBeenCalled();
  });

  it('báo lỗi 400 khi booking đã được đánh giá', async () => {
    server.use(
      http.post('*/reviews', () =>
        HttpResponse.json({ message: 'Booking này đã được đánh giá' }, { status: 400 }),
      ),
    );
    const user = userEvent.setup();
    await renderScreen();

    await user.press(screen.getByTestId('write-review-star-5'));
    await user.press(screen.getByTestId('write-review-submit'));

    expect(await screen.findByTestId('write-review-error')).toHaveTextContent(
      'Booking này đã được đánh giá',
    );
  });
});
