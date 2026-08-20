'use server';

import { isAxiosError } from 'axios';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';

const serviceSchema = z.object({
  name: z.string().min(1, 'Tên dịch vụ không hợp lệ'),
  price: z.coerce.number('Giá không hợp lệ').min(0),
  description: z.string().optional(),
});

export interface ServiceActionState {
  error?: string;
}

function servicesPath(venueId: string): string {
  return `/merchant/venues/${venueId}/services`;
}

export async function addService(
  venueId: string,
  _prevState: ServiceActionState | undefined,
  formData: FormData,
): Promise<ServiceActionState> {
  const parsed = serviceSchema.safeParse({
    name: formData.get('name'),
    price: formData.get('price'),
    description: formData.get('description') || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' };
  }

  const session = await requireSession();
  const { addonServices } = createAuthenticatedApiClient(session.accessToken);

  try {
    await addonServices.addonServicesControllerCreate({ venueId, ...parsed.data });
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 401) {
      redirect('/login');
    }
    return { error: 'Không thể thêm dịch vụ, vui lòng thử lại' };
  }

  revalidatePath(servicesPath(venueId));
  return {};
}

export async function deactivateService(venueId: string, serviceId: string): Promise<void> {
  const session = await requireSession();
  const { addonServices } = createAuthenticatedApiClient(session.accessToken);

  try {
    await addonServices.addonServicesControllerUpdate(serviceId, { isActive: false });
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 401) {
      redirect('/login');
    }
    throw err;
  }

  revalidatePath(servicesPath(venueId));
}
