import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';

const userControllerLock = vi.fn();
const userControllerUnlock = vi.fn();
const requireSession = vi.fn();
const revalidatePath = vi.fn();
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock('@/lib/api-client', () => ({
  createAuthenticatedApiClient: () => ({
    users: { userControllerLock, userControllerUnlock },
  }),
}));
vi.mock('@/lib/require-session', () => ({ requireSession }));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('next/navigation', () => ({ redirect }));

const { lockUser, unlockUser } = await import('./actions');

beforeEach(() => {
  userControllerLock.mockReset();
  userControllerUnlock.mockReset();
  requireSession.mockReset().mockResolvedValue({
    accessToken: 'at',
    refreshToken: 'rt',
    userId: 'admin-1',
    role: 'ADMIN',
  });
  revalidatePath.mockClear();
  redirect.mockClear();
});

describe('lockUser', () => {
  it('gọi đúng API với userId, revalidate path', async () => {
    userControllerLock.mockResolvedValue({ data: { id: 'user-1' } });

    await lockUser('user-1');

    expect(userControllerLock).toHaveBeenCalledWith('user-1');
    expect(revalidatePath).toHaveBeenCalledWith('/admin/users');
  });

  it('401 redirect về /login', async () => {
    userControllerLock.mockRejectedValue(
      new AxiosError('Unauthorized', '401', undefined, undefined, {
        status: 401,
        data: {},
        statusText: 'Unauthorized',
        headers: {},
        config: {} as never,
      }),
    );

    await expect(lockUser('user-1')).rejects.toThrow('NEXT_REDIRECT:/login');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('lỗi khác ném ra ngoài cho error boundary xử lý', async () => {
    userControllerLock.mockRejectedValue(new Error('server error'));

    await expect(lockUser('user-1')).rejects.toThrow('server error');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('không gọi nhầm sang unlock', async () => {
    userControllerLock.mockResolvedValue({ data: { id: 'user-1' } });

    await lockUser('user-1');

    expect(userControllerUnlock).not.toHaveBeenCalled();
  });
});

describe('unlockUser', () => {
  it('gọi đúng API với userId, revalidate path', async () => {
    userControllerUnlock.mockResolvedValue({ data: { id: 'user-1' } });

    await unlockUser('user-1');

    expect(userControllerUnlock).toHaveBeenCalledWith('user-1');
    expect(revalidatePath).toHaveBeenCalledWith('/admin/users');
  });

  it('401 redirect về /login', async () => {
    userControllerUnlock.mockRejectedValue(
      new AxiosError('Unauthorized', '401', undefined, undefined, {
        status: 401,
        data: {},
        statusText: 'Unauthorized',
        headers: {},
        config: {} as never,
      }),
    );

    await expect(unlockUser('user-1')).rejects.toThrow('NEXT_REDIRECT:/login');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('không gọi nhầm sang lock', async () => {
    userControllerUnlock.mockResolvedValue({ data: { id: 'user-1' } });

    await unlockUser('user-1');

    expect(userControllerLock).not.toHaveBeenCalled();
  });
});
