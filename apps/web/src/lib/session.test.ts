import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AuthResponseDtoRole } from '@sportspace/shared';

const cookieStore = new Map<string, { value: string }>();

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => cookieStore.get(name),
    set: (name: string, value: string) => {
      cookieStore.set(name, { value });
    },
    delete: (name: string) => {
      cookieStore.delete(name);
    },
  })),
}));

const {
  SESSION_COOKIE_NAME,
  parseSessionCookie,
  setSession,
  getSession,
  clearSession,
} = await import('./session');

const validSession = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  userId: 'user-1',
  role: AuthResponseDtoRole.MERCHANT,
};

beforeEach(() => {
  cookieStore.clear();
});

describe('parseSessionCookie', () => {
  it('trả về null khi cookie rỗng', () => {
    expect(parseSessionCookie(undefined)).toBeNull();
    expect(parseSessionCookie(null)).toBeNull();
    expect(parseSessionCookie('')).toBeNull();
  });

  it('trả về null khi JSON không hợp lệ', () => {
    expect(parseSessionCookie('{not json')).toBeNull();
  });

  it('trả về null khi thiếu field bắt buộc', () => {
    expect(parseSessionCookie(JSON.stringify({ accessToken: 'a' }))).toBeNull();
  });

  it('parse đúng khi cookie hợp lệ', () => {
    expect(parseSessionCookie(JSON.stringify(validSession))).toEqual(validSession);
  });
});

describe('setSession / getSession / clearSession', () => {
  it('setSession rồi getSession trả về đúng session', async () => {
    await setSession(validSession);
    await expect(getSession()).resolves.toEqual(validSession);
  });

  it('getSession trả về null khi chưa có session', async () => {
    await expect(getSession()).resolves.toBeNull();
  });

  it('clearSession xoá cookie', async () => {
    await setSession(validSession);
    await clearSession();
    expect(cookieStore.has(SESSION_COOKIE_NAME)).toBe(false);
    await expect(getSession()).resolves.toBeNull();
  });
});
