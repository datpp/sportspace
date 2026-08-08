import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useActionState } from 'react';

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useActionState: vi.fn(actual.useActionState) };
});

vi.mock('./actions', () => ({ login: vi.fn() }));

const { LoginForm } = await import('./login-form');

describe('LoginForm', () => {
  it('hiển thị lỗi trả về từ action state', () => {
    vi.mocked(useActionState).mockReturnValue([
      { error: 'Email hoặc mật khẩu không đúng' },
      vi.fn(),
      false,
    ]);

    render(<LoginForm />);

    expect(screen.getByRole('alert')).toHaveTextContent('Email hoặc mật khẩu không đúng');
  });

  it('disable nút submit khi đang pending', () => {
    vi.mocked(useActionState).mockReturnValue([{}, vi.fn(), true]);

    render(<LoginForm />);

    expect(screen.getByRole('button', { name: /đang đăng nhập/i })).toBeDisabled();
  });

  it('không hiển thị alert khi chưa có lỗi', () => {
    vi.mocked(useActionState).mockReturnValue([{}, vi.fn(), false]);

    render(<LoginForm />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /đăng nhập/i })).toBeEnabled();
  });
});
