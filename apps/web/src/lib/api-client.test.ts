import { describe, expect, it, vi, beforeEach } from 'vitest';
import axios from 'axios';

vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>();
  return { ...actual, default: { ...actual.default, create: vi.fn(actual.default.create) } };
});

const { createAnonymousApiClient, createAuthenticatedApiClient } = await import('./api-client');

beforeEach(() => {
  vi.mocked(axios.create).mockClear();
});

describe('createAnonymousApiClient', () => {
  it('tạo axios instance không có Authorization header', () => {
    createAnonymousApiClient();
    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: expect.any(String) }),
    );
    const config = vi.mocked(axios.create).mock.calls[0][0];
    expect(config?.headers).toBeUndefined();
  });
});

describe('createAuthenticatedApiClient', () => {
  it('gắn đúng Authorization Bearer header', () => {
    createAuthenticatedApiClient('my-token');
    const config = vi.mocked(axios.create).mock.calls[0][0];
    expect(config?.headers).toEqual({ Authorization: 'Bearer my-token' });
  });

  it('trả về client cho venues, courts, merchant, admin', () => {
    const client = createAuthenticatedApiClient('my-token');
    expect(client.venues.venueControllerFindAll).toBeInstanceOf(Function);
    expect(client.courts.courtControllerFindAll).toBeInstanceOf(Function);
    expect(client.merchant.merchantControllerGetRevenue).toBeInstanceOf(Function);
    expect(client.admin.adminControllerGetVenues).toBeInstanceOf(Function);
  });
});
