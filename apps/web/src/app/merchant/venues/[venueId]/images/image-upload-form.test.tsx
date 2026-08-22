import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useActionState } from 'react';

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useActionState: vi.fn(actual.useActionState) };
});

vi.mock('./actions', () => ({ uploadImage: vi.fn() }));

const { ImageUploadForm } = await import('./image-upload-form');

describe('ImageUploadForm', () => {
  it('render input file và nút tải lên, không cho chọn nhiều file', () => {
    vi.mocked(useActionState).mockReturnValue([{}, vi.fn(), false]);

    render(<ImageUploadForm venueId="venue-1" />);

    const input = screen.getByDisplayValue('') as HTMLInputElement;
    expect(input).toHaveAttribute('type', 'file');
    expect(input).not.toHaveAttribute('multiple');
    expect(screen.getByRole('button', { name: /tải ảnh lên/i })).toBeEnabled();
  });

  it('disable nút khi pending', () => {
    vi.mocked(useActionState).mockReturnValue([{}, vi.fn(), true]);

    render(<ImageUploadForm venueId="venue-1" />);

    expect(screen.getByRole('button', { name: /đang tải lên/i })).toBeDisabled();
  });

  it('hiển thị lỗi từ action state', () => {
    vi.mocked(useActionState).mockReturnValue([{ error: 'Ảnh vượt quá 5MB' }, vi.fn(), false]);

    render(<ImageUploadForm venueId="venue-1" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Ảnh vượt quá 5MB');
  });
});
