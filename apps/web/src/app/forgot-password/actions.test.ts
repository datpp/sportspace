import { describe, expect, it, vi, beforeEach } from 'vitest';

const authControllerForgotPassword = vi.fn();

vi.mock('@/lib/api-client', () => ({
  createAnonymousApiClient: () => ({ auth: { authControllerForgotPassword } }),
}));

const { forgotPassword } = await import('./actions');

function formDataFor(email: string) {
  const fd = new FormData();
  fd.set('email', email);
  return fd;
}

beforeEach(() => {
  authControllerForgotPassword.mockReset();
});

describe('forgotPassword action', () => {
  it('email không hợp lệ trả lỗi, không gọi API', async () => {
    const state = await forgotPassword(undefined, formDataFor('not-an-email'));
    expect(state.error).toBeTruthy();
    expect(authControllerForgotPassword).not.toHaveBeenCalled();
  });

  it('email hợp lệ: gọi API và trả success', async () => {
    authControllerForgotPassword.mockResolvedValue({ data: undefined });

    const state = await forgotPassword(undefined, formDataFor('user@example.com'));

    expect(authControllerForgotPassword).toHaveBeenCalledWith({ email: 'user@example.com' });
    expect(state.success).toBe(true);
  });

  it('API lỗi vẫn trả success (không lộ email có tồn tại hay không)', async () => {
    authControllerForgotPassword.mockRejectedValue(new Error('network down'));

    const state = await forgotPassword(undefined, formDataFor('user@example.com'));

    expect(state.success).toBe(true);
  });
});
