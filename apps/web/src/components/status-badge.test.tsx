import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from './status-badge';

describe('StatusBadge', () => {
  it('renders children', () => {
    render(<StatusBadge variant="success">Đã duyệt</StatusBadge>);
    expect(screen.getByText('Đã duyệt')).toBeTruthy();
  });

  const EXPECTED_CLASSES = {
    success: ['bg-emerald-50', 'text-emerald-700', 'dark:bg-emerald-950', 'dark:text-emerald-300'],
    warning: ['bg-amber-50', 'text-amber-700', 'dark:bg-amber-950', 'dark:text-amber-300'],
    danger: ['bg-red-50', 'text-red-700', 'dark:bg-red-950', 'dark:text-red-300'],
    neutral: ['bg-slate-100', 'text-slate-600', 'dark:bg-slate-800', 'dark:text-slate-300'],
    info: ['bg-indigo-50', 'text-indigo-700', 'dark:bg-indigo-950', 'dark:text-indigo-200'],
  } as const;

  it.each(['success', 'warning', 'danger', 'neutral', 'info'] as const)(
    'applies distinct styling for variant %s',
    (variant) => {
      render(<StatusBadge variant={variant}>Label</StatusBadge>);
      const el = screen.getByText('Label');
      for (const className of EXPECTED_CLASSES[variant]) {
        expect(el.className).toContain(className);
      }
    },
  );
});
