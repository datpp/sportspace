import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { Button } from '../Button';

describe('Button', () => {
  it('fires onPress when pressed', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(<Button testID="my-button" onPress={onPress}>Lưu</Button>);

    await user.press(screen.getByTestId('my-button'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire onPress when disabled', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(<Button testID="my-button" onPress={onPress} disabled>Lưu</Button>);

    await user.press(screen.getByTestId('my-button'));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows a spinner instead of the label when loading, and is not pressable', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(<Button testID="my-button" onPress={onPress} loading>Lưu</Button>);

    expect(screen.queryByText('Lưu')).toBeNull();
    await user.press(screen.getByTestId('my-button'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
