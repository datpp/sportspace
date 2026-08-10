import React from 'react';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test-utils/server';
import { CourtSlotsScreen } from '../CourtSlotsScreen';
import { toDateOnlyString } from '../../../utils/date';
import type { VenuesStackParamList } from '../../../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const navigate = jest.fn();
const navigation = { navigate } as unknown as NativeStackNavigationProp<
  VenuesStackParamList,
  'CourtSlots'
>;

async function renderScreen() {
  return render(
    // useFocusEffect (dùng để refetch slot khi màn hình được focus lại) cần
    // NavigationContainer bao ngoài, dù test không đi qua navigator thật.
    <NavigationContainer>
      <CourtSlotsScreen
        navigation={navigation}
        route={{
          key: 'CourtSlots',
          name: 'CourtSlots',
          params: { courtId: 'court-1', courtName: 'Sân số 1', venueName: 'Sân test' },
        }}
      />
    </NavigationContainer>,
  );
}

describe('CourtSlotsScreen', () => {
  afterEach(() => {
    navigate.mockClear();
  });

  it('hiển thị ô giờ trống có thể bấm và ô đã đặt bị disable', async () => {
    server.use(
      http.get('*/courts/:id/slots', () =>
        HttpResponse.json(
          [
            { startTime: '06:00', endTime: '07:00', price: 200000, available: true },
            { startTime: '07:00', endTime: '08:00', price: 200000, available: false },
          ],
          { status: 200 },
        ),
      ),
    );
    const user = userEvent.setup();
    await renderScreen();

    const availableSlot = await screen.findByTestId('slot-06:00');
    const bookedSlot = screen.getByTestId('slot-07:00');

    await user.press(availableSlot);
    expect(navigate).toHaveBeenCalledWith(
      'BookingConfirm',
      expect.objectContaining({
        courtId: 'court-1',
        startTime: '06:00',
        endTime: '07:00',
        price: 200000,
      }),
    );

    navigate.mockClear();
    await user.press(bookedSlot);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('đổi ngày gọi lại API với date tương ứng', async () => {
    let capturedDates: string[] = [];
    server.use(
      http.get('*/courts/:id/slots', ({ request }) => {
        const url = new URL(request.url);
        capturedDates.push(url.searchParams.get('date') ?? '');
        return HttpResponse.json(
          [{ startTime: '06:00', endTime: '07:00', price: 200000, available: true }],
          { status: 200 },
        );
      }),
    );
    const user = userEvent.setup();
    await renderScreen();
    await waitFor(() => expect(capturedDates.length).toBeGreaterThan(0));

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowIso = toDateOnlyString(tomorrow);

    await user.press(screen.getByTestId(`date-option-${tomorrowIso}`));

    await waitFor(() => expect(capturedDates).toContain(tomorrowIso));
  });

  it('hiển thị empty state khi ngày đó không có ô giờ', async () => {
    server.use(http.get('*/courts/:id/slots', () => HttpResponse.json([], { status: 200 })));

    await renderScreen();

    expect(await screen.findByTestId('court-slots-empty')).toBeTruthy();
  });

  it('hiển thị error state khi API lỗi', async () => {
    server.use(
      http.get('*/courts/:id/slots', () => HttpResponse.json({ message: 'fail' }, { status: 500 })),
    );

    await renderScreen();

    expect(await screen.findByTestId('court-slots-error')).toBeTruthy();
  });
});
