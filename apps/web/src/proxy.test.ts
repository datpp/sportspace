import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { AuthResponseDtoRole } from '@sportspace/shared';
import { proxy } from './proxy';
import { SESSION_COOKIE_NAME, type Session } from './lib/session';

function requestFor(pathname: string, session?: Session) {
  const url = `https://sportspace.test${pathname}`;
  const headers = new Headers();
  if (session) {
    headers.set('cookie', `${SESSION_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(session))}`);
  }
  return new NextRequest(url, { headers });
}

function redirectPathname(response: ReturnType<typeof proxy>): string | null {
  const location = response.headers.get('location');
  return location ? new URL(location).pathname : null;
}

function isPassThrough(response: ReturnType<typeof proxy>): boolean {
  return response.headers.get('location') === null;
}

const merchantSession: Session = {
  accessToken: 'a',
  refreshToken: 'r',
  userId: 'u1',
  role: AuthResponseDtoRole.MERCHANT,
};
const adminSession: Session = { ...merchantSession, role: AuthResponseDtoRole.ADMIN };
const playerSession: Session = { ...merchantSession, role: AuthResponseDtoRole.PLAYER };

describe('proxy — chưa đăng nhập', () => {
  it('vào /merchant bị đá về /login', () => {
    expect(redirectPathname(proxy(requestFor('/merchant')))).toBe('/login');
  });

  it('vào /admin bị đá về /login', () => {
    expect(redirectPathname(proxy(requestFor('/admin')))).toBe('/login');
  });

  it('vào / bị đá về /login', () => {
    expect(redirectPathname(proxy(requestFor('/')))).toBe('/login');
  });

  it('vào /login vẫn cho qua', () => {
    expect(isPassThrough(proxy(requestFor('/login')))).toBe(true);
  });
});

describe('proxy — role PLAYER', () => {
  it('vào /merchant bị đá về /login', () => {
    expect(redirectPathname(proxy(requestFor('/merchant', playerSession)))).toBe('/login');
  });

  it('vào /admin bị đá về /login', () => {
    expect(redirectPathname(proxy(requestFor('/admin', playerSession)))).toBe('/login');
  });
});

describe('proxy — role MERCHANT', () => {
  it('vào /merchant/venues được cho qua', () => {
    expect(isPassThrough(proxy(requestFor('/merchant/venues', merchantSession)))).toBe(true);
  });

  it('vào /admin bị đá về /merchant', () => {
    expect(redirectPathname(proxy(requestFor('/admin', merchantSession)))).toBe('/merchant');
  });

  it('vào /login bị đá về /merchant', () => {
    expect(redirectPathname(proxy(requestFor('/login', merchantSession)))).toBe('/merchant');
  });
});

describe('proxy — role ADMIN', () => {
  it('vào /merchant/venues được cho qua', () => {
    expect(isPassThrough(proxy(requestFor('/merchant/venues', adminSession)))).toBe(true);
  });

  it('vào /admin/users được cho qua', () => {
    expect(isPassThrough(proxy(requestFor('/admin/users', adminSession)))).toBe(true);
  });

  it('vào /login bị đá về /admin', () => {
    expect(redirectPathname(proxy(requestFor('/login', adminSession)))).toBe('/admin');
  });
});
