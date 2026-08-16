import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/admin/users',
  useSearchParams: () => new URLSearchParams('q=an'),
}));

const { FilterSelect } = await import('./filter-select');

describe('FilterSelect', () => {
  beforeEach(() => push.mockClear());

  it('navigates immediately with the new filter value, preserving q, resetting page', () => {
    render(
      <FilterSelect
        paramKey="role"
        label="Vai trò"
        options={[
          { value: '', label: 'Tất cả' },
          { value: 'ADMIN', label: 'Quản trị' },
        ]}
      />,
    );
    fireEvent.change(screen.getByLabelText('Vai trò'), {
      target: { value: 'ADMIN' },
    });
    expect(push).toHaveBeenCalledWith('/admin/users?q=an&role=ADMIN');
  });

  it('clears the filter when the empty option is chosen', () => {
    render(
      <FilterSelect
        paramKey="q"
        label="Tìm"
        options={[
          { value: '', label: 'Tất cả' },
          { value: 'x', label: 'X' },
        ]}
      />,
    );
    fireEvent.change(screen.getByLabelText('Tìm'), { target: { value: '' } });
    expect(push).toHaveBeenCalledWith('/admin/users');
  });
});
