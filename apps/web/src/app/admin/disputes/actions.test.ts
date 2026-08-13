import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';
import { ResolveDisputeDtoStatus } from '@sportspace/shared';

const disputeControllerResolve = vi.fn();
const requireSession = vi.fn();
const revalidatePath = vi.fn();
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock('@/lib/api-client', () => ({
  createAuthenticatedApiClient: () => ({
    disputes: { disputeControllerResolve },
  }),
}));
vi.mock('@/lib/require-session', () => ({ requireSession }));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('next/navigation', () => ({ redirect }));

const { resolveDispute } = await import('./actions');

function formDataFor(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value);
  }
  return fd;
}

beforeEach(() => {
  disputeControllerResolve.mockReset();
  requireSession.mockReset().mockResolvedValue({
    accessToken: 'at',
    refreshToken: 'rt',
    userId: 'admin-1',
    role: 'ADMIN',
  });
  revalidatePath.mockClear();
  redirect.mockClear();
});

describe('resolveDispute', () => {
  it('status=RESOLVED kèm refundAmount → gọi API với refundAmount là số, revalidate path', async () => {
    disputeControllerResolve.mockResolvedValue({ data: { id: 'dispute-1' } });

    await resolveDispute(
      'dispute-1',
      formDataFor({
        status: ResolveDisputeDtoStatus.RESOLVED,
        resolutionNote: 'Đã kiểm tra, hoàn tiền cho khách',
        refundAmount: '50000',
      }),
    );

    expect(disputeControllerResolve).toHaveBeenCalledWith('dispute-1', {
      status: ResolveDisputeDtoStatus.RESOLVED,
      resolutionNote: 'Đã kiểm tra, hoàn tiền cho khách',
      refundAmount: 50000,
    });
    expect(revalidatePath).toHaveBeenCalledWith('/admin/disputes');
  });

  it('status=REJECTED không có refundAmount → gọi API với refundAmount undefined', async () => {
    disputeControllerResolve.mockResolvedValue({ data: { id: 'dispute-1' } });

    await resolveDispute(
      'dispute-1',
      formDataFor({
        status: ResolveDisputeDtoStatus.REJECTED,
        resolutionNote: 'Khiếu nại không có căn cứ',
      }),
    );

    expect(disputeControllerResolve).toHaveBeenCalledWith('dispute-1', {
      status: ResolveDisputeDtoStatus.REJECTED,
      resolutionNote: 'Khiếu nại không có căn cứ',
      refundAmount: undefined,
    });
    expect(revalidatePath).toHaveBeenCalledWith('/admin/disputes');
  });

  it('status không hợp lệ hoặc thiếu → không gọi API', async () => {
    await resolveDispute(
      'dispute-1',
      formDataFor({ status: 'OPEN', resolutionNote: 'ghi chú' }),
    );

    expect(disputeControllerResolve).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('resolutionNote trắng hoặc thiếu → không gọi API', async () => {
    await resolveDispute(
      'dispute-1',
      formDataFor({ status: ResolveDisputeDtoStatus.RESOLVED, resolutionNote: '   ' }),
    );

    expect(disputeControllerResolve).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('401 redirect về /login', async () => {
    disputeControllerResolve.mockRejectedValue(
      new AxiosError('Unauthorized', '401', undefined, undefined, {
        status: 401,
        data: {},
        statusText: 'Unauthorized',
        headers: {},
        config: {} as never,
      }),
    );

    await expect(
      resolveDispute(
        'dispute-1',
        formDataFor({ status: ResolveDisputeDtoStatus.RESOLVED, resolutionNote: 'ghi chú' }),
      ),
    ).rejects.toThrow('NEXT_REDIRECT:/login');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('lỗi khác ném ra ngoài cho error boundary xử lý', async () => {
    disputeControllerResolve.mockRejectedValue(new Error('server error'));

    await expect(
      resolveDispute(
        'dispute-1',
        formDataFor({ status: ResolveDisputeDtoStatus.RESOLVED, resolutionNote: 'ghi chú' }),
      ),
    ).rejects.toThrow('server error');
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
