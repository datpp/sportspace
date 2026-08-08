import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';
import { AuthResponseDtoRole } from '@sportspace/shared';

const authControllerLogin = vi.fn();
const setSession = vi.fn();
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock('@/lib/api-client', () => ({
  createAnonymousApiClient: () => ({ auth: { authControllerLogin } }),
}));
vi.mock('@/lib/session', () => ({ setSession }));
vi.mock('next/navigation', () => ({ redirect }));

const { login } = await import('./actions');

function formDataFor(email: string, password: string) {
  const fd = new FormData();
  fd.set('email', email);
  fd.set('password', password);
  return fd;
}

beforeEach(() => {
  authControllerLogin.mockReset();
  setSession.mockReset();
  redirect.mockClear();
});

describe('login action', () => {
  it('email không hợp lệ trả lỗi, không gọi API', async () => {
    const state = await login(undefined, formDataFor('not-an-email', 'secret'));
    expect(state.error).toBeTruthy();
    expect(authControllerLogin).not.toHaveBeenCalled();
  });

  it('đăng nhập thành công với role MERCHANT: lưu session và redirect /merchant', async () => {
    authControllerLogin.mockResolvedValue({
      data: {
        accessToken: 'at',
        refreshToken: 'rt',
        userId: 'u1',
        role: AuthResponseDtoRole.MERCHANT,
      },
    });

    await expect(login(undefined, formDataFor('m@test.com', 'secret'))).rejects.toThrow(
      'NEXT_REDIRECT:/merchant',
    );
    expect(setSession).toHaveBeenCalledWith({
      accessToken: 'at',
      refreshToken: 'rt',
      userId: 'u1',
      role: AuthResponseDtoRole.MERCHANT,
    });
  });

  it('đăng nhập thành công với role ADMIN: redirect /admin', async () => {
    authControllerLogin.mockResolvedValue({
      data: {
        accessToken: 'at',
        refreshToken: 'rt',
        userId: 'u2',
        role: AuthResponseDtoRole.ADMIN,
      },
    });

    await expect(login(undefined, formDataFor('a@test.com', 'secret'))).rejects.toThrow(
      'NEXT_REDIRECT:/admin',
    );
  });

  it('role PLAYER bị từ chối, không set session', async () => {
    authControllerLogin.mockResolvedValue({
      data: {
        accessToken: 'at',
        refreshToken: 'rt',
        userId: 'u3',
        role: AuthResponseDtoRole.PLAYER,
      },
    });

    const state = await login(undefined, formDataFor('p@test.com', 'secret'));
    expect(state.error).toBeTruthy();
    expect(setSession).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('sai mật khẩu (401) trả lỗi, không set session', async () => {
    authControllerLogin.mockRejectedValue(
      new AxiosError('Unauthorized', '401', undefined, undefined, {
        status: 401,
        data: {},
        statusText: 'Unauthorized',
        headers: {},
        config: {} as never,
      }),
    );

    const state = await login(undefined, formDataFor('m@test.com', 'wrong'));
    expect(state.error).toBeTruthy();
    expect(setSession).not.toHaveBeenCalled();
  });

  it('lỗi mạng/khác trả thông báo chung', async () => {
    authControllerLogin.mockRejectedValue(new Error('network down'));

    const state = await login(undefined, formDataFor('m@test.com', 'secret'));
    expect(state.error).toBeTruthy();
    expect(setSession).not.toHaveBeenCalled();
  });
});
