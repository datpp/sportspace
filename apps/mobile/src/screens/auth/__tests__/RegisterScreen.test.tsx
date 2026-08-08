import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test-utils/server';
import { AuthProvider } from '../../../auth/AuthContext';
import { clearSession } from '../../../auth/session';
import { RegisterScreen } from '../RegisterScreen';
import type { AuthStackParamList } from '../../../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const navigate = jest.fn();
const navigation = { navigate } as unknown as NativeStackNavigationProp<AuthStackParamList, 'Register'>;

async function renderScreen() {
  return render(
    <AuthProvider>
      <RegisterScreen navigation={navigation} route={{ key: 'Register', name: 'Register' }} />
    </AuthProvider>,
  );
}

describe('RegisterScreen', () => {
  afterEach(async () => {
    navigate.mockClear();
    await clearSession();
  });

  it('báo lỗi khi thiếu họ tên/email/mật khẩu', async () => {
    const user = userEvent.setup();
    await renderScreen();

    await user.press(screen.getByTestId('register-submit'));

    expect(await screen.findByTestId('register-error')).toHaveTextContent(
      'Vui lòng nhập đầy đủ họ tên, email và mật khẩu',
    );
  });

  it('đăng ký thành công không còn hiển thị lỗi', async () => {
    const user = userEvent.setup();
    await renderScreen();

    await user.type(screen.getByTestId('register-fullName'), 'Người Chơi Mới');
    await user.type(screen.getByTestId('register-email'), 'new-player@sportspace.dev');
    await user.type(screen.getByTestId('register-password'), 'secret123');
    await user.press(screen.getByTestId('register-submit'));

    await screen.findByTestId('register-submit');
    expect(screen.queryByTestId('register-error')).toBeNull();
  });

  it('hiển thị lỗi email đã dùng khi server trả 409', async () => {
    server.use(
      http.post('*/auth/register', () =>
        HttpResponse.json({ message: 'Email đã tồn tại' }, { status: 409 }),
      ),
    );
    const user = userEvent.setup();
    await renderScreen();

    await user.type(screen.getByTestId('register-fullName'), 'Người Chơi Mới');
    await user.type(screen.getByTestId('register-email'), 'dup@sportspace.dev');
    await user.type(screen.getByTestId('register-password'), 'secret123');
    await user.press(screen.getByTestId('register-submit'));

    expect(await screen.findByTestId('register-error')).toHaveTextContent('Email đã được sử dụng');
  });

  it('điều hướng sang Login khi bấm link', async () => {
    const user = userEvent.setup();
    await renderScreen();

    await user.press(screen.getByTestId('register-go-login'));

    expect(navigate).toHaveBeenCalledWith('Login');
  });
});
