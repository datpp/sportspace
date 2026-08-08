import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test-utils/server';
import { AuthProvider } from '../../../auth/AuthContext';
import { clearSession } from '../../../auth/session';
import { LoginScreen } from '../LoginScreen';
import type { AuthStackParamList } from '../../../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const navigate = jest.fn();
const navigation = { navigate } as unknown as NativeStackNavigationProp<AuthStackParamList, 'Login'>;

async function renderScreen() {
  return render(
    <AuthProvider>
      <LoginScreen navigation={navigation} route={{ key: 'Login', name: 'Login' }} />
    </AuthProvider>,
  );
}

describe('LoginScreen', () => {
  afterEach(async () => {
    navigate.mockClear();
    await clearSession();
  });

  it('báo lỗi khi submit thiếu email/mật khẩu', async () => {
    const user = userEvent.setup();
    await renderScreen();

    await user.press(screen.getByTestId('login-submit'));

    expect(await screen.findByTestId('login-error')).toHaveTextContent(
      'Vui lòng nhập email và mật khẩu',
    );
  });

  it('đăng nhập thành công gọi đúng API và không còn hiển thị lỗi', async () => {
    const user = userEvent.setup();
    await renderScreen();

    await user.type(screen.getByTestId('login-email'), 'player@sportspace.dev');
    await user.type(screen.getByTestId('login-password'), 'secret123');
    await user.press(screen.getByTestId('login-submit'));

    await screen.findByTestId('login-submit');
    expect(screen.queryByTestId('login-error')).toBeNull();
  });

  it('hiển thị lỗi khi đăng nhập sai (401)', async () => {
    server.use(
      http.post('*/auth/login', () =>
        HttpResponse.json({ message: 'Sai email hoặc mật khẩu' }, { status: 401 }),
      ),
    );
    const user = userEvent.setup();
    await renderScreen();

    await user.type(screen.getByTestId('login-email'), 'player@sportspace.dev');
    await user.type(screen.getByTestId('login-password'), 'wrong');
    await user.press(screen.getByTestId('login-submit'));

    expect(await screen.findByTestId('login-error')).toHaveTextContent('Sai email hoặc mật khẩu');
  });

  it('điều hướng sang Register khi bấm link', async () => {
    const user = userEvent.setup();
    await renderScreen();

    await user.press(screen.getByTestId('login-go-register'));

    expect(navigate).toHaveBeenCalledWith('Register');
  });
});
