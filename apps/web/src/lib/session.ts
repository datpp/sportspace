import { cookies } from 'next/headers';
import type { AuthResponseDtoRole } from '@sportspace/shared';

export const SESSION_COOKIE_NAME = 'sspace_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // khớp TTL refresh token (7 ngày)

export interface Session {
  accessToken: string;
  refreshToken: string;
  userId: string;
  role: AuthResponseDtoRole;
}

export function parseSessionCookie(raw: string | undefined | null): Session | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof parsed.accessToken === 'string' &&
      typeof parsed.refreshToken === 'string' &&
      typeof parsed.userId === 'string' &&
      typeof parsed.role === 'string'
    ) {
      return parsed as Session;
    }
    return null;
  } catch {
    return null;
  }
}

export async function setSession(session: Session): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, JSON.stringify(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  return parseSessionCookie(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
