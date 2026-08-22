import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from './status-badge';

describe('StatusBadge', () => {
  it('renders children', () => {
    render(<StatusBadge variant="success">Đã duyệt</StatusBadge>);
    expect(screen.getByText('Đã duyệt')).toBeTruthy();
  });

  it.each(['success', 'warning', 'danger', 'neutral', 'info'] as const)(
    'applies distinct styling for variant %s',
    (variant) => {
      render(<StatusBadge variant={variant}>Label</StatusBadge>);
      const el = screen.getByText('Label');
      expect(el.className).toContain(
        variant === 'success'
          ? 'emerald'
          : variant === 'warning'
            ? 'amber'
            : variant === 'danger'
              ? 'red'
              : variant === 'neutral'
                ? 'slate'
                : 'indigo',
      );
    },
  );
});
