import React from 'react';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test-utils/server';
import { getNotificationControllerFindAllResponseMock } from '@sportspace/shared/mocks';
import { NotificationsScreen } from '../NotificationsScreen';

async function renderScreen() {
  return render(
    // useFocusEffect (refetch khi tab được focus lại) cần NavigationContainer.
    <NavigationContainer>
      <NotificationsScreen />
    </NavigationContainer>,
  );
}

describe('NotificationsScreen', () => {
  it('hiển thị danh sách thông báo sau khi tải xong', async () => {
    await renderScreen();

    await waitFor(() => expect(screen.queryByTestId('notifications-loading')).toBeNull());
    expect(screen.getByTestId('notifications-list')).toBeTruthy();
  });

  it('hiển thị empty state khi chưa có thông báo nào', async () => {
    server.use(http.get('*/notifications', () => HttpResponse.json([], { status: 200 })));

    await renderScreen();

    expect(await screen.findByTestId('notifications-empty')).toBeTruthy();
  });

  it('hiển thị error state khi API lỗi và cho thử lại', async () => {
    server.use(http.get('*/notifications', () => HttpResponse.json({ message: 'fail' }, { status: 500 })));

    await renderScreen();

    expect(await screen.findByTestId('notifications-error')).toBeTruthy();
  });

  it('bấm thông báo chưa đọc gọi API đánh dấu đã đọc và cập nhật UI', async () => {
    const notification = getNotificationControllerFindAllResponseMock()[0];
    notification.isRead = false;
    server.use(http.get('*/notifications', () => HttpResponse.json([notification], { status: 200 })));
    server.use(
      http.post('*/notifications/:id/read', () =>
        HttpResponse.json({ ...notification, isRead: true }, { status: 201 }),
      ),
    );
    const user = userEvent.setup();
    await renderScreen();

    expect(await screen.findByTestId(`notification-dot-${notification.id}`)).toBeTruthy();

    await user.press(screen.getByTestId(`notification-item-${notification.id}`));

    await waitFor(() => expect(screen.queryByTestId(`notification-dot-${notification.id}`)).toBeNull());
  });

  it('bấm thông báo đã đọc rồi thì không gọi lại API đánh dấu đọc', async () => {
    const notification = getNotificationControllerFindAllResponseMock()[0];
    notification.isRead = true;
    server.use(http.get('*/notifications', () => HttpResponse.json([notification], { status: 200 })));
    const markReadSpy = jest.fn();
    server.use(http.post('*/notifications/:id/read', markReadSpy));
    const user = userEvent.setup();
    await renderScreen();

    await user.press(await screen.findByTestId(`notification-item-${notification.id}`));

    expect(markReadSpy).not.toHaveBeenCalled();
  });
});
