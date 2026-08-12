import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';

const venueControllerApprove = vi.fn();
const venueControllerReject = vi.fn();
const requireSession = vi.fn();
const revalidatePath = vi.fn();
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock('@/lib/api-client', () => ({
  createAuthenticatedApiClient: () => ({
    venues: { venueControllerApprove, venueControllerReject },
  }),
}));
vi.mock('@/lib/require-session', () => ({ requireSession }));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('next/navigation', () => ({ redirect }));

const { approveVenue, rejectVenue } = await import('./actions');

beforeEach(() => {
  venueControllerApprove.mockReset();
  venueControllerReject.mockReset();
  requireSession.mockReset().mockResolvedValue({
    accessToken: 'at',
    refreshToken: 'rt',
    userId: 'admin-1',
    role: 'ADMIN',
  });
  revalidatePath.mockClear();
  redirect.mockClear();
});

describe('approveVenue', () => {
  it('gọi đúng API với venueId, revalidate path', async () => {
    venueControllerApprove.mockResolvedValue({ data: { id: 'venue-1' } });

    await approveVenue('venue-1');

    expect(venueControllerApprove).toHaveBeenCalledWith('venue-1');
    expect(revalidatePath).toHaveBeenCalledWith('/admin/venues');
  });

  it('401 redirect về /login', async () => {
    venueControllerApprove.mockRejectedValue(
      new AxiosError('Unauthorized', '401', undefined, undefined, {
        status: 401,
        data: {},
        statusText: 'Unauthorized',
        headers: {},
        config: {} as never,
      }),
    );

    await expect(approveVenue('venue-1')).rejects.toThrow('NEXT_REDIRECT:/login');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('lỗi khác ném ra ngoài cho error boundary xử lý', async () => {
    venueControllerApprove.mockRejectedValue(new Error('server error'));

    await expect(approveVenue('venue-1')).rejects.toThrow('server error');
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('rejectVenue', () => {
  it('gọi đúng API với venueId, revalidate path', async () => {
    venueControllerReject.mockResolvedValue({ data: { id: 'venue-1' } });

    await rejectVenue('venue-1');

    expect(venueControllerReject).toHaveBeenCalledWith('venue-1');
    expect(revalidatePath).toHaveBeenCalledWith('/admin/venues');
  });

  it('không gọi nhầm sang approve', async () => {
    venueControllerReject.mockResolvedValue({ data: { id: 'venue-1' } });

    await rejectVenue('venue-1');

    expect(venueControllerApprove).not.toHaveBeenCalled();
  });
});
