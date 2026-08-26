import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { Input } from '../Input';

describe('Input', () => {
  it('hiển thị giá trị và gọi onChangeText khi gõ', async () => {
    const onChangeText = jest.fn();
    const user = userEvent.setup();
    await render(<Input testID="my-input" value="" onChangeText={onChangeText} placeholder="Email" />);

    await user.type(screen.getByTestId('my-input'), 'a');

    expect(onChangeText).toHaveBeenCalled();
  });

  it('chuyển tiếp các prop TextInput tiêu chuẩn xuống phần tử thật', async () => {
    await render(
      <Input
        testID="my-input"
        value=""
        onChangeText={() => {}}
        secureTextEntry
        keyboardType="email-address"
        autoCapitalize="none"
      />,
    );

    const input = screen.getByTestId('my-input');
    expect(input.props.secureTextEntry).toBe(true);
    expect(input.props.keyboardType).toBe('email-address');
    expect(input.props.autoCapitalize).toBe('none');
  });
});
