'use server';

import { isAxiosError } from 'axios';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';

async function updateVenueStatus(
  venueId: string,
  action: 'approve' | 'reject',
): Promise<void> {
  const session = await requireSession();
  const { venues } = createAuthenticatedApiClient(session.accessToken);

  try {
    if (action === 'approve') {
      await venues.venueControllerApprove(venueId);
    } else {
      await venues.venueControllerReject(venueId);
    }
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 401) {
      redirect('/login');
    }
    throw err;
  }

  revalidatePath('/admin/venues');
}

export async function approveVenue(venueId: string): Promise<void> {
  await updateVenueStatus(venueId, 'approve');
}

export async function rejectVenue(venueId: string): Promise<void> {
  await updateVenueStatus(venueId, 'reject');
}
