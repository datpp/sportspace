'use server';

import { isAxiosError } from 'axios';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';

async function withMerchantSession<T>(
  fn: (client: ReturnType<typeof createAuthenticatedApiClient>) => Promise<T>,
): Promise<T> {
  const session = await requireSession();
  const client = createAuthenticatedApiClient(session.accessToken);

  try {
    return await fn(client);
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 401) {
      redirect('/login');
    }
    throw err;
  }
}

export async function confirmBooking(bookingId: string): Promise<void> {
  await withMerchantSession(({ bookings }) => bookings.bookingControllerConfirm(bookingId));
  revalidatePath('/merchant/bookings');
}

export async function rejectBooking(bookingId: string, reason: string): Promise<void> {
  await withMerchantSession(({ bookings }) => bookings.bookingControllerReject(bookingId, { reason }));
  revalidatePath('/merchant/bookings');
}
