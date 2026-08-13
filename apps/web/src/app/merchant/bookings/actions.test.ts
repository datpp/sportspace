import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';

const bookingControllerConfirm = vi.fn();
const bookingControllerReject = vi.fn();
const requireSession = vi.fn();
const revalidatePath = vi.fn();
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock('@/lib/api-client', () => ({
  createAuthenticatedApiClient: () => ({
    bookings: { bookingControllerConfirm, bookingControllerReject },
  }),
}));
vi.mock('@/lib/require-session', () => ({ requireSession }));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('next/navigation', () => ({ redirect }));

const { confirmBooking, rejectBooking } = await import('./actions');

function formDataFor(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value);
  }
  return fd;
}

beforeEach(() => {
  bookingControllerConfirm.mockReset();
  bookingControllerReject.mockReset();
  requireSession.mockReset().mockResolvedValue({
    accessToken: 'at',
    refreshToken: 'rt',
    userId: 'merchant-1',
    role: 'MERCHANT',
  });
  revalidatePath.mockClear();
  redirect.mockClear();
});

describe('confirmBooking', () => {
  it('gọi đúng API với bookingId, revalidate path', async () => {
    bookingControllerConfirm.mockResolvedValue({ data: { id: 'booking-1' } });

    await confirmBooking('booking-1');

    expect(bookingControllerConfirm).toHaveBeenCalledWith('booking-1');
    expect(revalidatePath).toHaveBeenCalledWith('/merchant/bookings');
  });

  it('401 redirect về /login', async () => {
    bookingControllerConfirm.mockRejectedValue(
      new AxiosError('Unauthorized', '401', undefined, undefined, {
        status: 401,
        data: {},
        statusText: 'Unauthorized',
        headers: {},
        config: {} as never,
      }),
    );

    await expect(confirmBooking('booking-1')).rejects.toThrow('NEXT_REDIRECT:/login');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('lỗi khác ném ra ngoài cho error boundary xử lý', async () => {
    bookingControllerConfirm.mockRejectedValue(new Error('server error'));

    await expect(confirmBooking('booking-1')).rejects.toThrow('server error');
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('rejectBooking', () => {
  it('gọi đúng API với bookingId + reason từ FormData, revalidate path', async () => {
    bookingControllerReject.mockResolvedValue({ data: { id: 'booking-1' } });

    await rejectBooking('booking-1', formDataFor({ reason: 'Sân đang bảo trì' }));

    expect(bookingControllerReject).toHaveBeenCalledWith('booking-1', {
      reason: 'Sân đang bảo trì',
    });
    expect(revalidatePath).toHaveBeenCalledWith('/merchant/bookings');
  });

  it('thiếu reason trong FormData → không gọi API', async () => {
    await rejectBooking('booking-1', new FormData());

    expect(bookingControllerReject).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('reason là chuỗi trắng → không gọi API', async () => {
    await rejectBooking('booking-1', formDataFor({ reason: '   ' }));

    expect(bookingControllerReject).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('401 redirect về /login', async () => {
    bookingControllerReject.mockRejectedValue(
      new AxiosError('Unauthorized', '401', undefined, undefined, {
        status: 401,
        data: {},
        statusText: 'Unauthorized',
        headers: {},
        config: {} as never,
      }),
    );

    await expect(
      rejectBooking('booking-1', formDataFor({ reason: 'lý do' })),
    ).rejects.toThrow('NEXT_REDIRECT:/login');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('lỗi khác ném ra ngoài cho error boundary xử lý', async () => {
    bookingControllerReject.mockRejectedValue(new Error('server error'));

    await expect(
      rejectBooking('booking-1', formDataFor({ reason: 'lý do' })),
    ).rejects.toThrow('server error');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('không gọi nhầm sang confirm', async () => {
    bookingControllerReject.mockResolvedValue({ data: { id: 'booking-1' } });

    await rejectBooking('booking-1', formDataFor({ reason: 'lý do' }));

    expect(bookingControllerConfirm).not.toHaveBeenCalled();
  });
});
