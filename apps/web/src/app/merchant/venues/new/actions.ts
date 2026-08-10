'use server';

import { isAxiosError } from 'axios';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';

const createVenueSchema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên cụm sân'),
  address: z.string().min(1, 'Vui lòng nhập địa chỉ'),
  lat: z.coerce.number('Vĩ độ không hợp lệ').min(-90).max(90),
  lng: z.coerce.number('Kinh độ không hợp lệ').min(-180).max(180),
  description: z.string().optional(),
});

export interface CreateVenueActionState {
  error?: string;
}

export async function createVenue(
  _prevState: CreateVenueActionState | undefined,
  formData: FormData,
): Promise<CreateVenueActionState> {
  const parsed = createVenueSchema.safeParse({
    name: formData.get('name'),
    address: formData.get('address'),
    lat: formData.get('lat'),
    lng: formData.get('lng'),
    description: formData.get('description') || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' };
  }

  const session = await requireSession();
  const { venues } = createAuthenticatedApiClient(session.accessToken);

  let response;
  try {
    response = await venues.venueControllerCreate(parsed.data);
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 401) {
      redirect('/login');
    }
    return { error: 'Không thể tạo cụm sân, vui lòng thử lại' };
  }

  redirect(`/merchant/venues/${response.data.id}/courts`);
}
