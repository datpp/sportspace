import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';

const systemConfigControllerUpdate = vi.fn();
const requireSession = vi.fn();
const revalidatePath = vi.fn();
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock('@/lib/api-client', () => ({
  createAuthenticatedApiClient: () => ({
    systemConfig: { systemConfigControllerUpdate },
  }),
}));
vi.mock('@/lib/require-session', () => ({ requireSession }));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('next/navigation', () => ({ redirect }));

const { updateSystemConfig } = await import('./actions');

function formDataFor(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value);
  }
  return fd;
}

beforeEach(() => {
  systemConfigControllerUpdate.mockReset();
  requireSession.mockReset().mockResolvedValue({
    accessToken: 'at',
    refreshToken: 'rt',
    userId: 'admin-1',
    role: 'ADMIN',
  });
  revalidatePath.mockClear();
  redirect.mockClear();
});

describe('updateSystemConfig', () => {
  it('gọi đúng API với 4 trường số từ FormData, revalidate path', async () => {
    systemConfigControllerUpdate.mockResolvedValue({ data: { id: 'config-1' } });

    await updateSystemConfig(
      formDataFor({
        cancellationFullRefundHours: '24',
        cancellationPartialRefundHours: '2',
        cancellationPartialRefundPercent: '50',
        platformCommissionPercent: '10',
      }),
    );

    expect(systemConfigControllerUpdate).toHaveBeenCalledWith({
      cancellationFullRefundHours: 24,
      cancellationPartialRefundHours: 2,
      cancellationPartialRefundPercent: 50,
      platformCommissionPercent: 10,
    });
    expect(revalidatePath).toHaveBeenCalledWith('/admin/config');
  });

  it('401 redirect về /login', async () => {
    systemConfigControllerUpdate.mockRejectedValue(
      new AxiosError('Unauthorized', '401', undefined, undefined, {
        status: 401,
        data: {},
        statusText: 'Unauthorized',
        headers: {},
        config: {} as never,
      }),
    );

    await expect(
      updateSystemConfig(
        formDataFor({
          cancellationFullRefundHours: '24',
          cancellationPartialRefundHours: '2',
          cancellationPartialRefundPercent: '50',
          platformCommissionPercent: '10',
        }),
      ),
    ).rejects.toThrow('NEXT_REDIRECT:/login');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('lỗi khác ném ra ngoài cho error boundary xử lý', async () => {
    systemConfigControllerUpdate.mockRejectedValue(new Error('server error'));

    await expect(
      updateSystemConfig(
        formDataFor({
          cancellationFullRefundHours: '24',
          cancellationPartialRefundHours: '2',
          cancellationPartialRefundPercent: '50',
          platformCommissionPercent: '10',
        }),
      ),
    ).rejects.toThrow('server error');
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
