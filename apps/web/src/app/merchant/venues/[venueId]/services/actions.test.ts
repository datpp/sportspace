import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';

const addonServicesControllerCreate = vi.fn();
const addonServicesControllerUpdate = vi.fn();
const requireSession = vi.fn();
const revalidatePath = vi.fn();
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock('@/lib/api-client', () => ({
  createAuthenticatedApiClient: () => ({
    addonServices: { addonServicesControllerCreate, addonServicesControllerUpdate },
  }),
}));
vi.mock('@/lib/require-session', () => ({ requireSession }));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('next/navigation', () => ({ redirect }));

const { addService, deactivateService } = await import('./actions');

function buildFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  Object.entries(fields).forEach(([key, value]) => fd.set(key, value));
  return fd;
}

beforeEach(() => {
  addonServicesControllerCreate.mockReset();
  addonServicesControllerUpdate.mockReset();
  requireSession.mockReset().mockResolvedValue({
    accessToken: 'at',
    refreshToken: 'rt',
    userId: 'merchant-1',
    role: 'MERCHANT',
  });
  revalidatePath.mockClear();
  redirect.mockClear();
});

describe('addService', () => {
  it('trả về lỗi khi thiếu tên dịch vụ', async () => {
    const result = await addService(
      'venue-1',
      undefined,
      buildFormData({ name: '', price: '20000' }),
    );

    expect(result.error).toBeDefined();
    expect(addonServicesControllerCreate).not.toHaveBeenCalled();
  });

  it('trả về lỗi khi giá không hợp lệ', async () => {
    const result = await addService(
      'venue-1',
      undefined,
      buildFormData({ name: 'Thuê bóng', price: '-1' }),
    );

    expect(result.error).toBeDefined();
    expect(addonServicesControllerCreate).not.toHaveBeenCalled();
  });

  it('gọi API và revalidate khi dữ liệu hợp lệ', async () => {
    addonServicesControllerCreate.mockResolvedValue({ data: {} });

    const result = await addService(
      'venue-1',
      undefined,
      buildFormData({ name: 'Thuê bóng', price: '20000' }),
    );

    expect(result.error).toBeUndefined();
    expect(addonServicesControllerCreate).toHaveBeenCalledWith({
      venueId: 'venue-1',
      name: 'Thuê bóng',
      price: 20000,
    });
    expect(revalidatePath).toHaveBeenCalledWith('/merchant/venues/venue-1/services');
  });

  it('401 redirect về /login', async () => {
    addonServicesControllerCreate.mockRejectedValue(
      new AxiosError('Unauthorized', '401', undefined, undefined, {
        status: 401,
        data: {},
        statusText: 'Unauthorized',
        headers: {},
        config: {} as never,
      }),
    );

    await expect(
      addService('venue-1', undefined, buildFormData({ name: 'Thuê bóng', price: '20000' })),
    ).rejects.toThrow('NEXT_REDIRECT:/login');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('lỗi khác trả về thông báo lỗi chung', async () => {
    addonServicesControllerCreate.mockRejectedValue(new Error('server error'));

    const result = await addService(
      'venue-1',
      undefined,
      buildFormData({ name: 'Thuê bóng', price: '20000' }),
    );

    expect(result.error).toBe('Không thể thêm dịch vụ, vui lòng thử lại');
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('deactivateService', () => {
  it('gọi API cập nhật isActive=false và revalidate', async () => {
    addonServicesControllerUpdate.mockResolvedValue({ data: {} });

    await deactivateService('venue-1', 'service-1');

    expect(addonServicesControllerUpdate).toHaveBeenCalledWith('service-1', { isActive: false });
    expect(revalidatePath).toHaveBeenCalledWith('/merchant/venues/venue-1/services');
  });

  it('401 redirect về /login', async () => {
    addonServicesControllerUpdate.mockRejectedValue(
      new AxiosError('Unauthorized', '401', undefined, undefined, {
        status: 401,
        data: {},
        statusText: 'Unauthorized',
        headers: {},
        config: {} as never,
      }),
    );

    await expect(deactivateService('venue-1', 'service-1')).rejects.toThrow('NEXT_REDIRECT:/login');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('lỗi khác ném ra ngoài cho error boundary xử lý', async () => {
    addonServicesControllerUpdate.mockRejectedValue(new Error('server error'));

    await expect(deactivateService('venue-1', 'service-1')).rejects.toThrow('server error');
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
