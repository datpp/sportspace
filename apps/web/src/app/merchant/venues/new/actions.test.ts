import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';

const venueControllerCreate = vi.fn();
const requireSession = vi.fn();
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock('@/lib/api-client', () => ({
  createAuthenticatedApiClient: () => ({ venues: { venueControllerCreate } }),
}));
vi.mock('@/lib/require-session', () => ({ requireSession }));
vi.mock('next/navigation', () => ({ redirect }));

const { createVenue } = await import('./actions');

function formDataFor(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value);
  }
  return fd;
}

const validFields = { name: 'Sân ABC', address: '123 Đường X', lat: '10.5', lng: '106.7' };

beforeEach(() => {
  venueControllerCreate.mockReset();
  requireSession.mockReset().mockResolvedValue({
    accessToken: 'at',
    refreshToken: 'rt',
    userId: 'u1',
    role: 'MERCHANT',
  });
  redirect.mockClear();
});

describe('createVenue action', () => {
  it('thiếu tên trả lỗi, không gọi API', async () => {
    const state = await createVenue(undefined, formDataFor({ ...validFields, name: '' }));
    expect(state.error).toBeTruthy();
    expect(venueControllerCreate).not.toHaveBeenCalled();
  });

  it('lat ngoài khoảng hợp lệ trả lỗi', async () => {
    const state = await createVenue(undefined, formDataFor({ ...validFields, lat: '999' }));
    expect(state.error).toBeTruthy();
    expect(venueControllerCreate).not.toHaveBeenCalled();
  });

  it('tạo thành công: redirect tới trang courts của venue mới', async () => {
    venueControllerCreate.mockResolvedValue({ data: { id: 'venue-123' } });

    await expect(createVenue(undefined, formDataFor(validFields))).rejects.toThrow(
      'NEXT_REDIRECT:/merchant/venues/venue-123/courts',
    );
    expect(venueControllerCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Sân ABC', address: '123 Đường X', lat: 10.5, lng: 106.7 }),
    );
  });

  it('401 từ API: redirect về /login', async () => {
    venueControllerCreate.mockRejectedValue(
      new AxiosError('Unauthorized', '401', undefined, undefined, {
        status: 401,
        data: {},
        statusText: 'Unauthorized',
        headers: {},
        config: {} as never,
      }),
    );

    await expect(createVenue(undefined, formDataFor(validFields))).rejects.toThrow(
      'NEXT_REDIRECT:/login',
    );
  });

  it('lỗi API khác trả thông báo lỗi form', async () => {
    venueControllerCreate.mockRejectedValue(new Error('server error'));

    const state = await createVenue(undefined, formDataFor(validFields));
    expect(state.error).toBeTruthy();
  });
});
