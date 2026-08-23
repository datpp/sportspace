import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useActionState } from 'react';
import { CourtStatus, type Court } from '@sportspace/shared';

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useActionState: vi.fn(actual.useActionState) };
});

vi.mock('./actions', () => ({ createCourt: vi.fn(), updateCourt: vi.fn() }));

const { CourtForm } = await import('./court-form');

const sampleCourt: Court = {
  id: 'court-1',
  priceRules: [],
  name: 'Sân 1',
  sport: 'football',
  basePrice: 200000,
  status: CourtStatus.ACTIVE,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('CourtForm', () => {
  it('chế độ tạo mới: nút submit ghi "Thêm sân", field trống', () => {
    vi.mocked(useActionState).mockReturnValue([{}, vi.fn(), false]);

    render(<CourtForm venueId="venue-1" />);

    expect(screen.getByRole('button', { name: /thêm sân/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/tên sân/i)).toHaveValue('');
  });

  it('chế độ sửa: field điền sẵn giá trị court, nút ghi "Lưu"', () => {
    vi.mocked(useActionState).mockReturnValue([{}, vi.fn(), false]);

    render(<CourtForm venueId="venue-1" court={sampleCourt} />);

    expect(screen.getByRole('button', { name: /^lưu$/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/tên sân/i)).toHaveValue('Sân 1');
    expect(screen.getByLabelText(/bộ môn/i)).toHaveValue('football');
    expect(screen.getByLabelText(/giá cơ bản/i)).toHaveValue(200000);
  });

  it('hiển thị lỗi từ action state', () => {
    vi.mocked(useActionState).mockReturnValue([{ error: 'Không thể tạo sân' }, vi.fn(), false]);

    render(<CourtForm venueId="venue-1" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Không thể tạo sân');
  });

  it('giữ nguyên các thuộc tính name/required mà Server Action phụ thuộc', () => {
    vi.mocked(useActionState).mockReturnValue([{}, vi.fn(), false]);

    const { container } = render(<CourtForm venueId="venue-1" />);

    const name = screen.getByLabelText('Tên sân');
    expect(name).toHaveAttribute('name', 'name');
    expect(name).toBeRequired();

    const sport = screen.getByLabelText('Bộ môn');
    expect(sport).toHaveAttribute('name', 'sport');
    expect(sport).toBeRequired();

    const basePrice = screen.getByLabelText('Giá cơ bản (đ)');
    expect(basePrice).toHaveAttribute('name', 'basePrice');
    expect(basePrice).toHaveAttribute('type', 'number');
    expect(basePrice).toHaveAttribute('min', '0');
    expect(basePrice).toHaveAttribute('step', '1000');
    expect(basePrice).toBeRequired();

    const form = container.querySelector('form')!;
    const fd = new FormData(form);
    // Khớp đúng các key mà createCourt/updateCourt trong ./actions.ts đọc qua formData.get().
    for (const key of ['name', 'sport', 'basePrice']) {
      expect(fd.get(key)).not.toBeNull();
    }
  });
});
