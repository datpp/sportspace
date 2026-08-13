'use server';

import { isAxiosError } from 'axios';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';

export async function updateSystemConfig(formData: FormData): Promise<void> {
  const session = await requireSession();
  const { systemConfig } = createAuthenticatedApiClient(session.accessToken);

  const num = (key: string) => Number(formData.get(key));

  try {
    await systemConfig.systemConfigControllerUpdate({
      cancellationFullRefundHours: num('cancellationFullRefundHours'),
      cancellationPartialRefundHours: num('cancellationPartialRefundHours'),
      cancellationPartialRefundPercent: num('cancellationPartialRefundPercent'),
      platformCommissionPercent: num('platformCommissionPercent'),
    });
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 401) {
      redirect('/login');
    }
    throw err;
  }

  revalidatePath('/admin/config');
}
