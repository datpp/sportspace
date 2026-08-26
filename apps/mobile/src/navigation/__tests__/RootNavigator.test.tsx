import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { RootNavigator } from '../RootNavigator';

jest.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: { userId: 'u1', role: 'PLAYER' }, isLoading: false }),
}));

interface NavHeaders {
  /** title -> header điều hướng của native-stack có bị ẩn không */
  stack: Record<string, boolean>;
  /** tiêu đề các header của bottom-tab đang hiển thị */
  tab: string[];
}

/**
 * Header của native-stack không phải node <Text>, nên đếm tiêu đề hay queryAllByText cho
 * cùng kết quả dù header bật hay tắt — đó là lý do lỗi "tiêu đề đôi" (ScreenHeader nằm
 * dưới một header điều hướng chưa tắt) lọt lưới nhiều lần. Nhưng nó có mặt trong cây
 * render dưới dạng host element RNSScreenStackHeaderConfig kèm prop `hidden`, nên đọc
 * thẳng prop đó. Header của bottom-tab thì ngược lại: là <Text> role "heading".
 */
function collectNavHeaders(node: unknown, out: NavHeaders = { stack: {}, tab: [] }): NavHeaders {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    node.forEach((child) => collectNavHeaders(child, out));
    return out;
  }
  const el = node as { type?: string; props?: Record<string, unknown>; children?: unknown[] };
  if (el.type === 'RNSScreenStackHeaderConfig') {
    out.stack[String(el.props?.title)] = el.props?.hidden === true;
  }
  if (el.props?.role === 'heading' || el.props?.accessibilityRole === 'heading') {
    out.tab.push(String(el.children?.[0]));
  }
  collectNavHeaders(el.children, out);
  return out;
}

describe('RootNavigator', () => {
  it('tắt header điều hướng ở các màn tab tự vẽ ScreenHeader, giữ header cho màn con trong stack', async () => {
    const user = userEvent.setup();
    await render(<RootNavigator />);

    await user.press(await screen.findByText('Lịch của tôi')); // tab Lịch của tôi
    await user.press(await screen.findByText('Kèo')); // tab Kèo
    await user.press((await screen.findAllByTestId(/^match-item-/))[0]); // mở MatchDetail
    await user.press(await screen.findByText('Thông báo')); // tab Thông báo

    const headers = collectNavHeaders(screen.toJSON());
    // Ba màn gốc của tab đều tự render ScreenHeader -> không được có thêm header điều hướng.
    expect(headers.stack).toMatchObject({
      'Lịch của tôi': true,
      'Tìm kèo': true,
      'Chi tiết kèo': false, // màn con trong stack vẫn phải giữ header gốc
    });
    expect(headers.tab).toEqual([]); // Thông báo là màn tab trần, header bottom-tab phải tắt
  });
});
