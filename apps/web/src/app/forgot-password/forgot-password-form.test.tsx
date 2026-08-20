import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useActionState } from 'react';

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useActionState: vi.fn(actual.useActionState) };
});

vi.mock('./actions', () => ({ forgotPassword: vi.fn() }));

const { ForgotPasswordForm } = await import('./forgot-password-form');

describe('ForgotPasswordForm', () => {
  it('hiển thị lỗi trả về từ action state', () => {
    vi.mocked(useActionState).mockReturnValue([{ error: 'Email không hợp lệ' }, vi.fn(), false]);

    render(<ForgotPasswordForm />);

    expect(screen.getByRole('alert')).toHaveTextContent('Email không hợp lệ');
  });

  it('hiển thị thông báo thành công khi state.success', () => {
    vi.mocked(useActionState).mockReturnValue([{ success: true }, vi.fn(), false]);

    render(<ForgotPasswordForm />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText(/đã gửi link đặt lại mật khẩu/i)).toBeInTheDocument();
  });

  it('disable nút submit khi đang pending', () => {
    vi.mocked(useActionState).mockReturnValue([{}, vi.fn(), true]);

    render(<ForgotPasswordForm />);

    expect(screen.getByRole('button', { name: /đang gửi/i })).toBeDisabled();
  });
});
