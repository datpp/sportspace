import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ScreenHeader } from '../ScreenHeader';

describe('ScreenHeader', () => {
  it('renders the title', async () => {
    await render(<ScreenHeader title="Tìm sân" />);
    expect(screen.getByText('Tìm sân')).toBeTruthy();
  });

  it('renders the subtitle when given', async () => {
    await render(<ScreenHeader title="Tìm sân" subtitle="Quận 7, TP.HCM" />);
    expect(screen.getByText('Quận 7, TP.HCM')).toBeTruthy();
  });

  it('omits the subtitle line when not given', async () => {
    await render(<ScreenHeader title="Tìm sân" />);
    expect(screen.queryByTestId('screen-header-subtitle')).toBeNull();
  });
});
