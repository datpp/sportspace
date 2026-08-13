'use server';

import { isAxiosError } from 'axios';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';

async function setLocked(userId: string, locked: boolean): Promise<void> {
  const session = await requireSession();
  const { users } = createAuthenticatedApiClient(session.accessToken);

  try {
    if (locked) {
      await users.userControllerLock(userId);
    } else {
      await users.userControllerUnlock(userId);
    }
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 401) {
      redirect('/login');
    }
    throw err;
  }

  revalidatePath('/admin/users');
}

export async function lockUser(userId: string): Promise<void> {
  await setLocked(userId, true);
}

export async function unlockUser(userId: string): Promise<void> {
  await setLocked(userId, false);
}
