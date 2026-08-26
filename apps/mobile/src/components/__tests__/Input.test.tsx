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
        multiline
        onSubmitEditing={() => {}}
        editable={false}
        maxLength={10}
      />,
    );

    const input = screen.getByTestId('my-input');
    expect(input.props.secureTextEntry).toBe(true);
    expect(input.props.keyboardType).toBe('email-address');
    expect(input.props.autoCapitalize).toBe('none');
    expect(input.props.multiline).toBe(true);
    expect(typeof input.props.onSubmitEditing).toBe('function');
    expect(input.props.editable).toBe(false);
    expect(input.props.maxLength).toBe(10);
  });

  it('caller ghi đè được placeholderTextColor', async () => {
    await render(
      <Input testID="i" value="" onChangeText={() => {}} placeholderTextColor="#ff0000" />,
    );
    expect(screen.getByTestId('i').props.placeholderTextColor).toBe('#ff0000');
  });

  it('style của caller thắng token theme', async () => {
    await render(<Input testID="i" value="" onChangeText={() => {}} style={{ padding: 99 }} />);
    const flat = screen.getByTestId('i').props.style;
    const merged = Object.assign({}, ...[flat].flat(Infinity).filter(Boolean));
    expect(merged.padding).toBe(99);
  });
});
