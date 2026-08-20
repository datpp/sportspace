import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useActionState } from 'react';

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useActionState: vi.fn(actual.useActionState) };
});

vi.mock('./actions', () => ({ resetPassword: vi.fn() }));

const { ResetPasswordForm } = await import('./reset-password-form');

describe('ResetPasswordForm', () => {
  it('hiển thị lỗi trả về từ action state', () => {
    vi.mocked(useActionState).mockReturnValue([
      { error: 'Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn' },
      vi.fn(),
      false,
    ]);

    render(<ResetPasswordForm token="tok" />);

    expect(screen.getByRole('alert')).toHaveTextContent('không hợp lệ hoặc đã hết hạn');
  });

  it('disable nút submit khi đang pending', () => {
    vi.mocked(useActionState).mockReturnValue([{}, vi.fn(), true]);

    render(<ResetPasswordForm token="tok" />);

    expect(screen.getByRole('button', { name: /đang lưu/i })).toBeDisabled();
  });

  it('truyền token qua hidden input', () => {
    vi.mocked(useActionState).mockReturnValue([{}, vi.fn(), false]);

    const { container } = render(<ResetPasswordForm token="my-token" />);

    const hidden = container.querySelector('input[name="token"]') as HTMLInputElement;
    expect(hidden.value).toBe('my-token');
  });
});
