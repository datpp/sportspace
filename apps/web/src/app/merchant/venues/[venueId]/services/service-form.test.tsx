import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useActionState } from 'react';

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useActionState: vi.fn(actual.useActionState) };
});

vi.mock('./actions', () => ({ addService: vi.fn() }));

const { ServiceForm } = await import('./service-form');

describe('ServiceForm', () => {
  it('render đủ field và nút thêm dịch vụ', () => {
    vi.mocked(useActionState).mockReturnValue([{}, vi.fn(), false]);

    render(<ServiceForm venueId="venue-1" />);

    expect(screen.getByLabelText(/tên dịch vụ/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/giá/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/mô tả/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /thêm dịch vụ/i })).toBeEnabled();
  });

  it('disable nút khi pending', () => {
    vi.mocked(useActionState).mockReturnValue([{}, vi.fn(), true]);

    render(<ServiceForm venueId="venue-1" />);

    expect(screen.getByRole('button', { name: /đang thêm/i })).toBeDisabled();
  });

  it('hiển thị lỗi từ action state', () => {
    vi.mocked(useActionState).mockReturnValue([
      { error: 'Tên dịch vụ không hợp lệ' },
      vi.fn(),
      false,
    ]);

    render(<ServiceForm venueId="venue-1" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Tên dịch vụ không hợp lệ');
  });

  it('giữ nguyên các thuộc tính name/type mà Server Action phụ thuộc', () => {
    vi.mocked(useActionState).mockReturnValue([{}, vi.fn(), false]);

    const { container } = render(<ServiceForm venueId="venue-1" />);

    const name = screen.getByLabelText(/tên dịch vụ/i);
    expect(name).toHaveAttribute('name', 'name');
    expect(name).toBeRequired();

    const price = screen.getByLabelText(/giá/i);
    expect(price).toHaveAttribute('name', 'price');
    expect(price).toHaveAttribute('type', 'number');
    expect(price).toHaveAttribute('min', '0');
    expect(price).toBeRequired();

    const description = screen.getByLabelText(/mô tả/i);
    expect(description).toHaveAttribute('name', 'description');
    expect(description).not.toBeRequired();

    const form = container.querySelector('form')!;
    const fd = new FormData(form);
    // Khớp đúng các key mà addService trong ./actions.ts đọc qua formData.get().
    for (const key of ['name', 'price', 'description']) {
      expect(fd.get(key)).not.toBeNull();
    }
  });
});
