import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PageError, PageLoading } from './page-state';

describe('PageLoading', () => {
  it('renders its message', () => {
    render(<PageLoading message="Đang tải danh sách cụm sân..." />);
    expect(screen.getByText('Đang tải danh sách cụm sân...')).toBeTruthy();
  });
});

describe('PageError', () => {
  it('renders its message with an alert role', () => {
    render(<PageError message="Có lỗi xảy ra." onRetry={() => {}} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Có lỗi xảy ra.');
  });

  it('calls onRetry when the retry button is pressed', () => {
    const onRetry = vi.fn();
    render(<PageError message="Có lỗi xảy ra." onRetry={onRetry} />);

    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
