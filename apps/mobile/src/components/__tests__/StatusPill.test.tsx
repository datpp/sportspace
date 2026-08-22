import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { StatusPill } from '../StatusPill';

describe('StatusPill', () => {
  it.each(['success', 'warning', 'danger', 'neutral', 'info'] as const)(
    'renders its label for variant %s',
    async (variant) => {
      await render(<StatusPill variant={variant}>Đã xác nhận</StatusPill>);
      expect(screen.getByText('Đã xác nhận')).toBeTruthy();
    },
  );
});
