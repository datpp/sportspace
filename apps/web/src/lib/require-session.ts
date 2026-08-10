import { redirect } from 'next/navigation';
import { getSession, type Session } from './session';

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  return session;
}
