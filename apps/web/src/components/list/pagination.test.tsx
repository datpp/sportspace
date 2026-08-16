import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/admin/users',
  useSearchParams: () => new URLSearchParams('page=2'),
}));

const { Pagination } = await import('./pagination');

describe('Pagination', () => {
  beforeEach(() => push.mockClear());

  it('renders nothing when there is only one page', () => {
    const { container } = render(<Pagination page={1} totalPages={1} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('disables Prev on page 1 and Next on the last page', () => {
    render(<Pagination page={1} totalPages={3} />);
    expect(screen.getByRole('button', { name: 'Trước' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sau' })).not.toBeDisabled();
  });

  it('navigates to the next page, preserving other params', () => {
    render(<Pagination page={2} totalPages={3} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sau' }));
    expect(push).toHaveBeenCalledWith('/admin/users?page=3');
  });
});
