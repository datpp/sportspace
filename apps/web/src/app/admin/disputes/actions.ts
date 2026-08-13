'use server';

import { isAxiosError } from 'axios';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ResolveDisputeDtoStatus } from '@sportspace/shared';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';

function isResolveStatus(value: unknown): value is ResolveDisputeDtoStatus {
  return value === ResolveDisputeDtoStatus.RESOLVED || value === ResolveDisputeDtoStatus.REJECTED;
}

export async function resolveDispute(disputeId: string, formData: FormData): Promise<void> {
  const status = formData.get('status');
  if (!isResolveStatus(status)) {
    return;
  }

  const resolutionNote = String(formData.get('resolutionNote') ?? '').trim();
  if (resolutionNote.length === 0) {
    return;
  }

  const refundAmountRaw = formData.get('refundAmount');
  const refundAmount = refundAmountRaw ? Number(refundAmountRaw) : undefined;

  const session = await requireSession();
  const { disputes } = createAuthenticatedApiClient(session.accessToken);

  try {
    await disputes.disputeControllerResolve(disputeId, {
      status,
      resolutionNote,
      refundAmount,
    });
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 401) {
      redirect('/login');
    }
    throw err;
  }

  revalidatePath('/admin/disputes');
}
