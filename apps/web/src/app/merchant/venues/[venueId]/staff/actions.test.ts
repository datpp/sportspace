import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';

const staffControllerCreate = vi.fn();
const staffControllerUpdate = vi.fn();
const requireSession = vi.fn();
const revalidatePath = vi.fn();
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock('@/lib/api-client', () => ({
  createAuthenticatedApiClient: () => ({
    staff: { staffControllerCreate, staffControllerUpdate },
  }),
}));
vi.mock('@/lib/require-session', () => ({ requireSession }));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('next/navigation', () => ({ redirect }));

const { addStaff, deactivateStaff } = await import('./actions');

function buildFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  Object.entries(fields).forEach(([key, value]) => fd.set(key, value));
  return fd;
}

beforeEach(() => {
  staffControllerCreate.mockReset();
  staffControllerUpdate.mockReset();
  requireSession.mockReset().mockResolvedValue({
    accessToken: 'at',
    refreshToken: 'rt',
    userId: 'merchant-1',
    role: 'MERCHANT',
  });
  revalidatePath.mockClear();
  redirect.mockClear();
});

describe('addStaff', () => {
  it('trả về lỗi khi thiếu họ tên', async () => {
    const result = await addStaff(
      'venue-1',
      undefined,
      buildFormData({ fullName: '', phone: '0900000000', position: 'Lễ tân' }),
    );

    expect(result.error).toBeDefined();
    expect(staffControllerCreate).not.toHaveBeenCalled();
  });

  it('gọi API và revalidate khi dữ liệu hợp lệ', async () => {
    staffControllerCreate.mockResolvedValue({ data: {} });

    const result = await addStaff(
      'venue-1',
      undefined,
      buildFormData({ fullName: 'Nguyễn Văn A', phone: '0900000000', position: 'Lễ tân' }),
    );

    expect(result.error).toBeUndefined();
    expect(staffControllerCreate).toHaveBeenCalledWith({
      venueId: 'venue-1',
      fullName: 'Nguyễn Văn A',
      phone: '0900000000',
      position: 'Lễ tân',
    });
    expect(revalidatePath).toHaveBeenCalledWith('/merchant/venues/venue-1/staff');
  });

  it('401 redirect về /login', async () => {
    staffControllerCreate.mockRejectedValue(
      new AxiosError('Unauthorized', '401', undefined, undefined, {
        status: 401,
        data: {},
        statusText: 'Unauthorized',
        headers: {},
        config: {} as never,
      }),
    );

    await expect(
      addStaff(
        'venue-1',
        undefined,
        buildFormData({ fullName: 'Nguyễn Văn A', phone: '0900000000', position: 'Lễ tân' }),
      ),
    ).rejects.toThrow('NEXT_REDIRECT:/login');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('lỗi khác trả về thông báo lỗi chung', async () => {
    staffControllerCreate.mockRejectedValue(new Error('server error'));

    const result = await addStaff(
      'venue-1',
      undefined,
      buildFormData({ fullName: 'Nguyễn Văn A', phone: '0900000000', position: 'Lễ tân' }),
    );

    expect(result.error).toBe('Không thể thêm nhân viên, vui lòng thử lại');
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('deactivateStaff', () => {
  it('gọi API cập nhật isActive=false và revalidate', async () => {
    staffControllerUpdate.mockResolvedValue({ data: {} });

    await deactivateStaff('venue-1', 'staff-1');

    expect(staffControllerUpdate).toHaveBeenCalledWith('staff-1', { isActive: false });
    expect(revalidatePath).toHaveBeenCalledWith('/merchant/venues/venue-1/staff');
  });

  it('401 redirect về /login', async () => {
    staffControllerUpdate.mockRejectedValue(
      new AxiosError('Unauthorized', '401', undefined, undefined, {
        status: 401,
        data: {},
        statusText: 'Unauthorized',
        headers: {},
        config: {} as never,
      }),
    );

    await expect(deactivateStaff('venue-1', 'staff-1')).rejects.toThrow('NEXT_REDIRECT:/login');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('lỗi khác ném ra ngoài cho error boundary xử lý', async () => {
    staffControllerUpdate.mockRejectedValue(new Error('server error'));

    await expect(deactivateStaff('venue-1', 'staff-1')).rejects.toThrow('server error');
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
