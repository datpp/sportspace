import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';

const staffControllerCreateShift = vi.fn();
const staffControllerRemoveShift = vi.fn();
const requireSession = vi.fn();
const revalidatePath = vi.fn();
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock('@/lib/api-client', () => ({
  createAuthenticatedApiClient: () => ({
    staff: { staffControllerCreateShift, staffControllerRemoveShift },
  }),
}));
vi.mock('@/lib/require-session', () => ({ requireSession }));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('next/navigation', () => ({ redirect }));

const { addShift, removeShift } = await import('./actions');

function buildFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  Object.entries(fields).forEach(([key, value]) => fd.set(key, value));
  return fd;
}

function axiosErrorWithStatus(status: number): AxiosError {
  return new AxiosError('error', String(status), undefined, undefined, {
    status,
    data: {},
    statusText: 'error',
    headers: {},
    config: {} as never,
  });
}

beforeEach(() => {
  staffControllerCreateShift.mockReset();
  staffControllerRemoveShift.mockReset();
  requireSession.mockReset().mockResolvedValue({
    accessToken: 'at',
    refreshToken: 'rt',
    userId: 'merchant-1',
    role: 'MERCHANT',
  });
  revalidatePath.mockClear();
  redirect.mockClear();
});

describe('addShift', () => {
  it('trả về lỗi khi giờ bắt đầu sau giờ kết thúc', async () => {
    const result = await addShift(
      'venue-1',
      'staff-1',
      undefined,
      buildFormData({ shiftDate: '2026-09-01', startTime: '12:00', endTime: '08:00' }),
    );

    expect(result.error).toBe('Giờ bắt đầu phải trước giờ kết thúc');
    expect(staffControllerCreateShift).not.toHaveBeenCalled();
  });

  it('trả về lỗi trùng giờ khi API trả 400', async () => {
    staffControllerCreateShift.mockRejectedValue(axiosErrorWithStatus(400));

    const result = await addShift(
      'venue-1',
      'staff-1',
      undefined,
      buildFormData({ shiftDate: '2026-09-01', startTime: '08:00', endTime: '12:00' }),
    );

    expect(result.error).toBe('Ca làm bị trùng giờ với ca đã có');
  });

  it('gọi API và revalidate khi dữ liệu hợp lệ', async () => {
    staffControllerCreateShift.mockResolvedValue({ data: {} });

    const result = await addShift(
      'venue-1',
      'staff-1',
      undefined,
      buildFormData({ shiftDate: '2026-09-01', startTime: '08:00', endTime: '12:00' }),
    );

    expect(result.error).toBeUndefined();
    expect(staffControllerCreateShift).toHaveBeenCalledWith('staff-1', {
      shiftDate: '2026-09-01',
      startTime: '08:00',
      endTime: '12:00',
    });
    expect(revalidatePath).toHaveBeenCalledWith('/merchant/venues/venue-1/staff/staff-1/shifts');
  });

  it('401 redirect về /login', async () => {
    staffControllerCreateShift.mockRejectedValue(axiosErrorWithStatus(401));

    await expect(
      addShift(
        'venue-1',
        'staff-1',
        undefined,
        buildFormData({ shiftDate: '2026-09-01', startTime: '08:00', endTime: '12:00' }),
      ),
    ).rejects.toThrow('NEXT_REDIRECT:/login');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('lỗi khác trả về thông báo lỗi chung', async () => {
    staffControllerCreateShift.mockRejectedValue(new Error('server error'));

    const result = await addShift(
      'venue-1',
      'staff-1',
      undefined,
      buildFormData({ shiftDate: '2026-09-01', startTime: '08:00', endTime: '12:00' }),
    );

    expect(result.error).toBe('Không thể thêm ca làm, vui lòng thử lại');
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('removeShift', () => {
  it('gọi API xoá ca làm và revalidate', async () => {
    staffControllerRemoveShift.mockResolvedValue({ data: undefined });

    await removeShift('venue-1', 'staff-1', 'shift-1');

    expect(staffControllerRemoveShift).toHaveBeenCalledWith('staff-1', 'shift-1');
    expect(revalidatePath).toHaveBeenCalledWith('/merchant/venues/venue-1/staff/staff-1/shifts');
  });

  it('401 redirect về /login', async () => {
    staffControllerRemoveShift.mockRejectedValue(axiosErrorWithStatus(401));

    await expect(removeShift('venue-1', 'staff-1', 'shift-1')).rejects.toThrow(
      'NEXT_REDIRECT:/login',
    );
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('lỗi khác ném ra ngoài cho error boundary xử lý', async () => {
    staffControllerRemoveShift.mockRejectedValue(new Error('server error'));

    await expect(removeShift('venue-1', 'staff-1', 'shift-1')).rejects.toThrow('server error');
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
