import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Card } from '../Card';

describe('Card', () => {
  it('renders children', async () => {
    await render(<Card><Text>Nội dung</Text></Card>);
    expect(screen.getByText('Nội dung')).toBeTruthy();
  });

  it('fires onPress when provided', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(
      <Card testID="my-card" onPress={onPress}>
        <Text>Nội dung</Text>
      </Card>,
    );

    await user.press(screen.getByTestId('my-card'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
