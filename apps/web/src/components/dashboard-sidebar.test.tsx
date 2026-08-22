import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DashboardSidebar } from './dashboard-sidebar';

describe('DashboardSidebar', () => {
  it('renders the label and every nav item as a link to its href', () => {
    render(
      <DashboardSidebar
        label="Merchant"
        navItems={[
          { href: '/merchant', label: 'Tổng quan' },
          { href: '/merchant/venues', label: 'Cụm sân' },
        ]}
      />,
    );

    expect(screen.getByText('Merchant')).toBeTruthy();
    const overviewLink = screen.getByText('Tổng quan').closest('a');
    expect(overviewLink).toHaveAttribute('href', '/merchant');
    const venuesLink = screen.getByText('Cụm sân').closest('a');
    expect(venuesLink).toHaveAttribute('href', '/merchant/venues');
  });
});
