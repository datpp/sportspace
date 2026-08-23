import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useActionState } from 'react';

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useActionState: vi.fn(actual.useActionState) };
});

vi.mock('./actions', () => ({ addStaff: vi.fn() }));

const { StaffForm } = await import('./staff-form');

describe('StaffForm', () => {
  it('render đủ field và nút thêm nhân viên', () => {
    vi.mocked(useActionState).mockReturnValue([{}, vi.fn(), false]);

    render(<StaffForm venueId="venue-1" />);

    expect(screen.getByLabelText(/họ tên/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/số điện thoại/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/chức vụ/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /thêm nhân viên/i })).toBeEnabled();
  });

  it('disable nút khi pending', () => {
    vi.mocked(useActionState).mockReturnValue([{}, vi.fn(), true]);

    render(<StaffForm venueId="venue-1" />);

    expect(screen.getByRole('button', { name: /đang thêm/i })).toBeDisabled();
  });

  it('hiển thị lỗi từ action state', () => {
    vi.mocked(useActionState).mockReturnValue([
      { error: 'Họ tên không hợp lệ' },
      vi.fn(),
      false,
    ]);

    render(<StaffForm venueId="venue-1" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Họ tên không hợp lệ');
  });

  it('giữ nguyên các thuộc tính name/type mà Server Action phụ thuộc', () => {
    vi.mocked(useActionState).mockReturnValue([{}, vi.fn(), false]);

    const { container } = render(<StaffForm venueId="venue-1" />);

    const fullName = screen.getByLabelText(/họ tên/i);
    expect(fullName).toHaveAttribute('name', 'fullName');
    expect(fullName).toBeRequired();

    const phone = screen.getByLabelText(/số điện thoại/i);
    expect(phone).toHaveAttribute('name', 'phone');
    expect(phone).toHaveAttribute('type', 'tel');
    expect(phone).toBeRequired();

    const position = screen.getByLabelText(/chức vụ/i);
    expect(position).toHaveAttribute('name', 'position');
    expect(position).toBeRequired();

    const form = container.querySelector('form')!;
    const fd = new FormData(form);
    // Khớp đúng các key mà addStaff trong ./actions.ts đọc qua formData.get().
    for (const key of ['fullName', 'phone', 'position']) {
      expect(fd.get(key)).not.toBeNull();
    }
  });
});
