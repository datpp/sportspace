import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { SystemConfig } from '@sportspace/shared';
import { SystemConfigForm } from './system-config-form';

const sampleConfig: SystemConfig = {
  id: 'config-1',
  cancellationFullRefundHours: 24,
  cancellationPartialRefundHours: 2,
  cancellationPartialRefundPercent: 50,
  platformCommissionPercent: 10,
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('SystemConfigForm', () => {
  it('giữ nguyên hợp đồng name mà Server Action phụ thuộc', () => {
    const { container } = render(<SystemConfigForm config={sampleConfig} action={vi.fn()} />);
    const form = container.querySelector('form');
    expect(form).not.toBeNull();

    const fd = new FormData(form as HTMLFormElement);
    expect(fd.get('cancellationFullRefundHours')).toBe('24');
    expect(fd.get('cancellationPartialRefundHours')).toBe('2');
    expect(fd.get('cancellationPartialRefundPercent')).toBe('50');
    expect(fd.get('platformCommissionPercent')).toBe('10');
  });

  it('điền sẵn giá trị hiện tại và giữ nguyên min={0} cho từng field', () => {
    render(<SystemConfigForm config={sampleConfig} action={vi.fn()} />);

    expect(screen.getByLabelText('Hoàn 100% nếu hủy trước (giờ)')).toHaveValue(24);
    expect(screen.getByLabelText('Hoàn một phần nếu hủy trước (giờ)')).toHaveValue(2);
    expect(screen.getByLabelText('Tỷ lệ hoàn một phần (%)')).toHaveValue(50);
    expect(screen.getByLabelText('Hoa hồng nền tảng (%)')).toHaveValue(10);

    for (const label of [
      'Hoàn 100% nếu hủy trước (giờ)',
      'Hoàn một phần nếu hủy trước (giờ)',
      'Tỷ lệ hoàn một phần (%)',
      'Hoa hồng nền tảng (%)',
    ]) {
      expect(screen.getByLabelText(label)).toHaveAttribute('min', '0');
    }
  });
});
