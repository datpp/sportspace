import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useActionState } from 'react';

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useActionState: vi.fn(actual.useActionState) };
});

vi.mock('./actions', () => ({ addShift: vi.fn() }));

const { ShiftForm } = await import('./shift-form');

describe('ShiftForm', () => {
  it('render đủ field và nút thêm ca làm', () => {
    vi.mocked(useActionState).mockReturnValue([{}, vi.fn(), false]);

    render(<ShiftForm venueId="venue-1" staffId="staff-1" />);

    expect(screen.getByLabelText(/ngày/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/giờ bắt đầu/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/giờ kết thúc/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /thêm ca làm/i })).toBeEnabled();
  });

  it('disable nút khi pending', () => {
    vi.mocked(useActionState).mockReturnValue([{}, vi.fn(), true]);

    render(<ShiftForm venueId="venue-1" staffId="staff-1" />);

    expect(screen.getByRole('button', { name: /đang thêm/i })).toBeDisabled();
  });

  it('hiển thị lỗi từ action state (ví dụ trùng giờ)', () => {
    vi.mocked(useActionState).mockReturnValue([
      { error: 'Ca làm bị trùng giờ với ca đã có' },
      vi.fn(),
      false,
    ]);

    render(<ShiftForm venueId="venue-1" staffId="staff-1" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Ca làm bị trùng giờ với ca đã có');
  });

  it('giữ nguyên các thuộc tính name/type mà Server Action phụ thuộc', () => {
    vi.mocked(useActionState).mockReturnValue([{}, vi.fn(), false]);

    const { container } = render(<ShiftForm venueId="venue-1" staffId="staff-1" />);

    const shiftDate = screen.getByLabelText(/ngày/i);
    expect(shiftDate).toHaveAttribute('name', 'shiftDate');
    expect(shiftDate).toHaveAttribute('type', 'date');
    expect(shiftDate).toBeRequired();

    const startTime = screen.getByLabelText(/giờ bắt đầu/i);
    expect(startTime).toHaveAttribute('name', 'startTime');
    expect(startTime).toHaveAttribute('type', 'time');
    expect(startTime).toBeRequired();

    const endTime = screen.getByLabelText(/giờ kết thúc/i);
    expect(endTime).toHaveAttribute('name', 'endTime');
    expect(endTime).toHaveAttribute('type', 'time');
    expect(endTime).toBeRequired();

    const form = container.querySelector('form')!;
    const fd = new FormData(form);
    // Khớp đúng các key mà addShift trong ./actions.ts đọc qua formData.get().
    for (const key of ['shiftDate', 'startTime', 'endTime']) {
      expect(fd.get(key)).not.toBeNull();
    }
  });
});
