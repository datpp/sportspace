import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';

const courtControllerAddPriceRule = vi.fn();
const courtControllerRemovePriceRule = vi.fn();
const requireSession = vi.fn();
const revalidatePath = vi.fn();
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock('@/lib/api-client', () => ({
  createAuthenticatedApiClient: () => ({
    courts: { courtControllerAddPriceRule, courtControllerRemovePriceRule },
  }),
}));
vi.mock('@/lib/require-session', () => ({ requireSession }));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('next/navigation', () => ({ redirect }));

const { addPriceRule, removePriceRule } = await import('./actions');

function formDataFor(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value);
  }
  return fd;
}

const validFields = { dayOfWeek: '1', startTime: '08:00', endTime: '10:00', price: '150000' };

beforeEach(() => {
  courtControllerAddPriceRule.mockReset();
  courtControllerRemovePriceRule.mockReset();
  requireSession.mockReset().mockResolvedValue({
    accessToken: 'at',
    refreshToken: 'rt',
    userId: 'u1',
    role: 'MERCHANT',
  });
  revalidatePath.mockClear();
  redirect.mockClear();
});

describe('addPriceRule', () => {
  it('startTime sau endTime trả lỗi, không gọi API', async () => {
    const state = await addPriceRule(
      'venue-1',
      'court-1',
      undefined,
      formDataFor({ ...validFields, startTime: '10:00', endTime: '08:00' }),
    );
    expect(state.error).toBeTruthy();
    expect(courtControllerAddPriceRule).not.toHaveBeenCalled();
  });

  it('dayOfWeek ngoài khoảng 0-6 trả lỗi', async () => {
    const state = await addPriceRule(
      'venue-1',
      'court-1',
      undefined,
      formDataFor({ ...validFields, dayOfWeek: '7' }),
    );
    expect(state.error).toBeTruthy();
  });

  it('thành công: gọi API đúng courtId, revalidate path', async () => {
    courtControllerAddPriceRule.mockResolvedValue({ data: { id: 'pr-1' } });

    const state = await addPriceRule('venue-1', 'court-1', undefined, formDataFor(validFields));
    expect(state).toEqual({});
    expect(courtControllerAddPriceRule).toHaveBeenCalledWith(
      'court-1',
      expect.objectContaining({ dayOfWeek: 1, startTime: '08:00', endTime: '10:00', price: 150000 }),
    );
    expect(revalidatePath).toHaveBeenCalledWith('/merchant/venues/venue-1/courts/court-1/price-rules');
  });

  it('401 redirect về /login', async () => {
    courtControllerAddPriceRule.mockRejectedValue(
      new AxiosError('Unauthorized', '401', undefined, undefined, {
        status: 401,
        data: {},
        statusText: 'Unauthorized',
        headers: {},
        config: {} as never,
      }),
    );

    await expect(
      addPriceRule('venue-1', 'court-1', undefined, formDataFor(validFields)),
    ).rejects.toThrow('NEXT_REDIRECT:/login');
  });
});

describe('removePriceRule', () => {
  it('gọi API remove và revalidate path', async () => {
    courtControllerRemovePriceRule.mockResolvedValue({});

    await removePriceRule('venue-1', 'court-1', 'pr-1');
    expect(courtControllerRemovePriceRule).toHaveBeenCalledWith('court-1', 'pr-1');
    expect(revalidatePath).toHaveBeenCalledWith('/merchant/venues/venue-1/courts/court-1/price-rules');
  });
});
