import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';

const courtControllerCreate = vi.fn();
const courtControllerUpdate = vi.fn();
const courtControllerRemove = vi.fn();
const requireSession = vi.fn();
const revalidatePath = vi.fn();
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock('@/lib/api-client', () => ({
  createAuthenticatedApiClient: () => ({
    courts: { courtControllerCreate, courtControllerUpdate, courtControllerRemove },
  }),
}));
vi.mock('@/lib/require-session', () => ({ requireSession }));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('next/navigation', () => ({ redirect }));

const { createCourt, updateCourt, deleteCourt } = await import('./actions');

function formDataFor(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value);
  }
  return fd;
}

const validFields = { name: 'Sân 1', sport: 'football', basePrice: '200000' };

beforeEach(() => {
  courtControllerCreate.mockReset();
  courtControllerUpdate.mockReset();
  courtControllerRemove.mockReset();
  requireSession.mockReset().mockResolvedValue({
    accessToken: 'at',
    refreshToken: 'rt',
    userId: 'u1',
    role: 'MERCHANT',
  });
  revalidatePath.mockClear();
  redirect.mockClear();
});

describe('createCourt', () => {
  it('thiếu tên trả lỗi, không gọi API', async () => {
    const state = await createCourt('venue-1', undefined, formDataFor({ ...validFields, name: '' }));
    expect(state.error).toBeTruthy();
    expect(courtControllerCreate).not.toHaveBeenCalled();
  });

  it('giá <= 0 trả lỗi', async () => {
    const state = await createCourt(
      'venue-1',
      undefined,
      formDataFor({ ...validFields, basePrice: '0' }),
    );
    expect(state.error).toBeTruthy();
  });

  it('thành công: gọi API với venueId, revalidate path', async () => {
    courtControllerCreate.mockResolvedValue({ data: { id: 'court-1' } });

    const state = await createCourt('venue-1', undefined, formDataFor(validFields));
    expect(state).toEqual({});
    expect(courtControllerCreate).toHaveBeenCalledWith(
      expect.objectContaining({ venueId: 'venue-1', name: 'Sân 1', sport: 'football', basePrice: 200000 }),
    );
    expect(revalidatePath).toHaveBeenCalledWith('/merchant/venues/venue-1/courts');
  });

  it('401 redirect về /login', async () => {
    courtControllerCreate.mockRejectedValue(
      new AxiosError('Unauthorized', '401', undefined, undefined, {
        status: 401,
        data: {},
        statusText: 'Unauthorized',
        headers: {},
        config: {} as never,
      }),
    );

    await expect(createCourt('venue-1', undefined, formDataFor(validFields))).rejects.toThrow(
      'NEXT_REDIRECT:/login',
    );
  });
});

describe('updateCourt', () => {
  it('thành công: gọi API update, revalidate path', async () => {
    courtControllerUpdate.mockResolvedValue({ data: { id: 'court-1' } });

    const state = await updateCourt('venue-1', 'court-1', undefined, formDataFor(validFields));
    expect(state).toEqual({});
    expect(courtControllerUpdate).toHaveBeenCalledWith(
      'court-1',
      expect.objectContaining({ name: 'Sân 1', sport: 'football', basePrice: 200000 }),
    );
    expect(revalidatePath).toHaveBeenCalledWith('/merchant/venues/venue-1/courts');
  });

  it('lỗi API trả thông báo lỗi', async () => {
    courtControllerUpdate.mockRejectedValue(new Error('server error'));

    const state = await updateCourt('venue-1', 'court-1', undefined, formDataFor(validFields));
    expect(state.error).toBeTruthy();
  });
});

describe('deleteCourt', () => {
  it('gọi API remove và revalidate path', async () => {
    courtControllerRemove.mockResolvedValue({});

    await deleteCourt('venue-1', 'court-1');
    expect(courtControllerRemove).toHaveBeenCalledWith('court-1');
    expect(revalidatePath).toHaveBeenCalledWith('/merchant/venues/venue-1/courts');
  });
});
