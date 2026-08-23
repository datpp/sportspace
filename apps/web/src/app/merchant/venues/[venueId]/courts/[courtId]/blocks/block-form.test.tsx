import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useActionState } from 'react';

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useActionState: vi.fn(actual.useActionState) };
});

vi.mock('./actions', () => ({ addBlock: vi.fn() }));

const { BlockForm } = await import('./block-form');

describe('BlockForm', () => {
  it('render đủ field và nút chặn khoảng giờ', () => {
    vi.mocked(useActionState).mockReturnValue([{}, vi.fn(), false]);

    render(<BlockForm venueId="venue-1" courtId="court-1" />);

    expect(screen.getByLabelText(/ngày/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/giờ bắt đầu/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/giờ kết thúc/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/lý do/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /chặn khoảng giờ/i })).toBeEnabled();
  });

  it('disable nút khi pending', () => {
    vi.mocked(useActionState).mockReturnValue([{}, vi.fn(), true]);

    render(<BlockForm venueId="venue-1" courtId="court-1" />);

    expect(screen.getByRole('button', { name: /đang chặn/i })).toBeDisabled();
  });

  it('hiển thị lỗi từ action state', () => {
    vi.mocked(useActionState).mockReturnValue([
      { error: 'Đã có đơn đặt sân trong khung giờ này, không thể chặn' },
      vi.fn(),
      false,
    ]);

    render(<BlockForm venueId="venue-1" courtId="court-1" />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Đã có đơn đặt sân trong khung giờ này, không thể chặn',
    );
  });

  it('giữ nguyên các thuộc tính name/type mà Server Action phụ thuộc', () => {
    vi.mocked(useActionState).mockReturnValue([{}, vi.fn(), false]);

    const { container } = render(<BlockForm venueId="venue-1" courtId="court-1" />);

    const blockDate = screen.getByLabelText(/ngày/i);
    expect(blockDate).toHaveAttribute('name', 'blockDate');
    expect(blockDate).toHaveAttribute('type', 'date');
    expect(blockDate).toBeRequired();

    const startTime = screen.getByLabelText(/giờ bắt đầu/i);
    expect(startTime).toHaveAttribute('name', 'startTime');
    expect(startTime).toHaveAttribute('type', 'time');
    expect(startTime).toBeRequired();

    const endTime = screen.getByLabelText(/giờ kết thúc/i);
    expect(endTime).toHaveAttribute('name', 'endTime');
    expect(endTime).toHaveAttribute('type', 'time');
    expect(endTime).toBeRequired();

    const reason = screen.getByLabelText(/lý do/i);
    expect(reason).toHaveAttribute('name', 'reason');
    expect(reason).toBeRequired();

    const form = container.querySelector('form')!;
    const fd = new FormData(form);
    // Khớp đúng các key mà addBlock trong ./actions.ts đọc qua formData.get().
    for (const key of ['blockDate', 'startTime', 'endTime', 'reason']) {
      expect(fd.get(key)).not.toBeNull();
    }
  });
});
