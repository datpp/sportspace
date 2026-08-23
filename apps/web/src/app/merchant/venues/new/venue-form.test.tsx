import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { useActionState } from 'react';

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useActionState: vi.fn(actual.useActionState) };
});

vi.mock('./actions', () => ({ createVenue: vi.fn() }));

const { VenueForm } = await import('./venue-form');

describe('VenueForm', () => {
  it('giữ nguyên hợp đồng name mà Server Action đọc qua formData.get()', () => {
    vi.mocked(useActionState).mockReturnValue([{}, vi.fn(), false]);

    const { container } = render(<VenueForm />);
    const form = container.querySelector('form');
    expect(form).not.toBeNull();

    const fd = new FormData(form as HTMLFormElement);
    // Khớp đúng các key mà createVenue trong ./actions.ts đọc qua formData.get().
    for (const key of ['name', 'address', 'province', 'lat', 'lng', 'description']) {
      expect(fd.get(key)).not.toBeNull();
    }
  });
});
