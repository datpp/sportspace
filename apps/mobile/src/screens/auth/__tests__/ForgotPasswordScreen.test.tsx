import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test-utils/server';
import { ForgotPasswordScreen } from '../ForgotPasswordScreen';
import type { AuthStackParamList } from '../../../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const goBack = jest.fn();
const navigation = { goBack } as unknown as NativeStackNavigationProp<
  AuthStackParamList,
  'ForgotPassword'
>;

async function renderScreen() {
  return render(
    <ForgotPasswordScreen
      navigation={navigation}
      route={{ key: 'ForgotPassword', name: 'ForgotPassword', params: undefined }}
    />,
  );
}

describe('ForgotPasswordScreen', () => {
  afterEach(() => goBack.mockClear());

  it('gửi yêu cầu và hiện thông báo kiểm tra email', async () => {
    server.use(
      http.post('*/auth/forgot-password', () => HttpResponse.json(undefined, { status: 200 })),
    );
    const user = userEvent.setup();
    await renderScreen();

    await user.type(screen.getByTestId('forgot-password-email'), 'test@example.com');
    await user.press(screen.getByTestId('forgot-password-submit'));

    expect(await screen.findByTestId('forgot-password-success')).toBeTruthy();
  });

  it('báo lỗi khi thiếu email', async () => {
    const user = userEvent.setup();
    await renderScreen();

    await user.press(screen.getByTestId('forgot-password-submit'));

    expect(await screen.findByTestId('forgot-password-error')).toBeTruthy();
  });
});
