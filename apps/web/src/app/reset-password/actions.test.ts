import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';

const authControllerResetPassword = vi.fn();
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock('@/lib/api-client', () => ({
  createAnonymousApiClient: () => ({ auth: { authControllerResetPassword } }),
}));
vi.mock('next/navigation', () => ({ redirect }));

const { resetPassword } = await import('./actions');

function formDataFor(token: string, newPassword: string) {
  const fd = new FormData();
  fd.set('token', token);
  fd.set('newPassword', newPassword);
  return fd;
}

beforeEach(() => {
  authControllerResetPassword.mockReset();
  redirect.mockClear();
});

describe('resetPassword action', () => {
  it('thiếu token trả lỗi, không gọi API', async () => {
    const state = await resetPassword(undefined, formDataFor('', 'NewPassword123'));
    expect(state.error).toBeTruthy();
    expect(authControllerResetPassword).not.toHaveBeenCalled();
  });

  it('mật khẩu ngắn hơn 8 ký tự trả lỗi, không gọi API', async () => {
    const state = await resetPassword(undefined, formDataFor('tok', 'short'));
    expect(state.error).toBeTruthy();
    expect(authControllerResetPassword).not.toHaveBeenCalled();
  });

  it('thành công: gọi API và redirect /login', async () => {
    authControllerResetPassword.mockResolvedValue({ data: undefined });

    await expect(
      resetPassword(undefined, formDataFor('valid-token', 'NewPassword123')),
    ).rejects.toThrow('NEXT_REDIRECT:/login');

    expect(authControllerResetPassword).toHaveBeenCalledWith({
      token: 'valid-token',
      newPassword: 'NewPassword123',
    });
  });

  it('token không hợp lệ/hết hạn (400) trả lỗi', async () => {
    authControllerResetPassword.mockRejectedValue(
      new AxiosError('Bad Request', '400', undefined, undefined, {
        status: 400,
        data: {},
        statusText: 'Bad Request',
        headers: {},
        config: {} as never,
      }),
    );

    const state = await resetPassword(undefined, formDataFor('bad-token', 'NewPassword123'));
    expect(state.error).toBeTruthy();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('lỗi mạng/khác trả thông báo chung', async () => {
    authControllerResetPassword.mockRejectedValue(new Error('network down'));

    const state = await resetPassword(undefined, formDataFor('valid-token', 'NewPassword123'));
    expect(state.error).toBeTruthy();
    expect(redirect).not.toHaveBeenCalled();
  });
});
