import { describe, expect, it, vi, beforeEach } from 'vitest';

const clearSession = vi.fn();
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock('@/lib/session', () => ({ clearSession }));
vi.mock('next/navigation', () => ({ redirect }));

const { logout } = await import('./actions');

beforeEach(() => {
  clearSession.mockReset();
  redirect.mockClear();
});

describe('logout action', () => {
  it('xoá session rồi redirect về /login', async () => {
    await expect(logout()).rejects.toThrow('NEXT_REDIRECT:/login');
    expect(clearSession).toHaveBeenCalledOnce();
  });
});
