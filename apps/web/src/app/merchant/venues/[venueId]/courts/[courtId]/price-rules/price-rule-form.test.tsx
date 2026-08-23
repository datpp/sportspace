import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useActionState } from 'react';

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useActionState: vi.fn(actual.useActionState) };
});

vi.mock('./actions', () => ({ addPriceRule: vi.fn() }));

const { PriceRuleForm } = await import('./price-rule-form');

describe('PriceRuleForm', () => {
  it('render đủ field và nút thêm giá', () => {
    vi.mocked(useActionState).mockReturnValue([{}, vi.fn(), false]);

    render(<PriceRuleForm venueId="venue-1" courtId="court-1" />);

    expect(screen.getByLabelText(/ngày trong tuần/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/giờ bắt đầu/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/giờ kết thúc/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^giá/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /thêm giá/i })).toBeEnabled();
  });

  it('disable nút khi pending', () => {
    vi.mocked(useActionState).mockReturnValue([{}, vi.fn(), true]);

    render(<PriceRuleForm venueId="venue-1" courtId="court-1" />);

    expect(screen.getByRole('button', { name: /đang thêm/i })).toBeDisabled();
  });

  it('hiển thị lỗi từ action state', () => {
    vi.mocked(useActionState).mockReturnValue([
      { error: 'Giờ bắt đầu phải trước giờ kết thúc' },
      vi.fn(),
      false,
    ]);

    render(<PriceRuleForm venueId="venue-1" courtId="court-1" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Giờ bắt đầu phải trước giờ kết thúc');
  });

  it('giữ nguyên các thuộc tính name/type mà Server Action phụ thuộc', () => {
    vi.mocked(useActionState).mockReturnValue([{}, vi.fn(), false]);

    const { container } = render(<PriceRuleForm venueId="venue-1" courtId="court-1" />);

    const startTime = screen.getByLabelText(/giờ bắt đầu/i);
    expect(startTime).toHaveAttribute('name', 'startTime');
    expect(startTime).toHaveAttribute('type', 'time');
    expect(startTime).toBeRequired();

    const endTime = screen.getByLabelText(/giờ kết thúc/i);
    expect(endTime).toHaveAttribute('name', 'endTime');
    expect(endTime).toHaveAttribute('type', 'time');
    expect(endTime).toBeRequired();

    const price = screen.getByLabelText(/^giá/i);
    expect(price).toHaveAttribute('name', 'price');
    expect(price).toHaveAttribute('type', 'number');
    expect(price).toHaveAttribute('min', '0');
    expect(price).toHaveAttribute('step', '1000');
    expect(price).toBeRequired();

    const form = container.querySelector('form')!;
    const fd = new FormData(form);
    // Khớp đúng các key mà addPriceRule trong ./actions.ts đọc qua formData.get().
    for (const key of ['dayOfWeek', 'startTime', 'endTime', 'price']) {
      expect(fd.get(key)).not.toBeNull();
    }
  });
});
