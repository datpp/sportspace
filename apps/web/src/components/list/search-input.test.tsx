import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/admin/users',
  useSearchParams: () => new URLSearchParams('status=ACTIVE'),
}));

const { SearchInput } = await import('./search-input');

describe('SearchInput', () => {
  beforeEach(() => {
    push.mockClear();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('debounces navigation, preserves other params, and resets page', () => {
    render(<SearchInput placeholder="Tìm..." />);
    fireEvent.change(screen.getByPlaceholderText('Tìm...'), {
      target: { value: 'an' },
    });
    expect(push).not.toHaveBeenCalled();

    vi.advanceTimersByTime(400);
    expect(push).toHaveBeenCalledWith('/admin/users?status=ACTIVE&q=an');
  });
});
