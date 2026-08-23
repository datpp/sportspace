import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { StatusPill } from '../StatusPill';

const EXPECTED_BACKGROUND: Record<'success' | 'warning' | 'danger' | 'neutral' | 'info', string> = {
  success: '#ecfdf5',
  warning: '#fffbeb',
  danger: '#fef2f2',
  neutral: '#f1f5f9',
  info: '#eef2ff',
};

describe('StatusPill', () => {
  it.each(['success', 'warning', 'danger', 'neutral', 'info'] as const)(
    'renders its label and the status-palette background for variant %s',
    async (variant) => {
      await render(
        <StatusPill testID="pill" variant={variant}>
          Đã xác nhận
        </StatusPill>,
      );

      expect(screen.getByText('Đã xác nhận')).toBeTruthy();
      expect(screen.getByTestId('pill')).toHaveStyle({ backgroundColor: EXPECTED_BACKGROUND[variant] });
    },
  );
});
