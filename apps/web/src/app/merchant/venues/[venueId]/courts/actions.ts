'use server';

import { isAxiosError } from 'axios';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';

const courtSchema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên sân'),
  sport: z.string().min(1, 'Vui lòng nhập bộ môn'),
  basePrice: z.coerce.number('Giá không hợp lệ').positive('Giá phải lớn hơn 0'),
});

export interface CourtActionState {
  error?: string;
}

function coursePath(venueId: string): string {
  return `/merchant/venues/${venueId}/courts`;
}

export async function createCourt(
  venueId: string,
  _prevState: CourtActionState | undefined,
  formData: FormData,
): Promise<CourtActionState> {
  const parsed = courtSchema.safeParse({
    name: formData.get('name'),
    sport: formData.get('sport'),
    basePrice: formData.get('basePrice'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' };
  }

  const session = await requireSession();
  const { courts } = createAuthenticatedApiClient(session.accessToken);

  try {
    await courts.courtControllerCreate({ venueId, ...parsed.data });
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 401) {
      redirect('/login');
    }
    return { error: 'Không thể tạo sân, vui lòng thử lại' };
  }

  revalidatePath(coursePath(venueId));
  return {};
}

export async function updateCourt(
  venueId: string,
  courtId: string,
  _prevState: CourtActionState | undefined,
  formData: FormData,
): Promise<CourtActionState> {
  const parsed = courtSchema.safeParse({
    name: formData.get('name'),
    sport: formData.get('sport'),
    basePrice: formData.get('basePrice'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' };
  }

  const session = await requireSession();
  const { courts } = createAuthenticatedApiClient(session.accessToken);

  try {
    await courts.courtControllerUpdate(courtId, parsed.data);
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 401) {
      redirect('/login');
    }
    return { error: 'Không thể cập nhật sân, vui lòng thử lại' };
  }

  revalidatePath(coursePath(venueId));
  return {};
}

export async function deleteCourt(venueId: string, courtId: string): Promise<void> {
  const session = await requireSession();
  const { courts } = createAuthenticatedApiClient(session.accessToken);
  await courts.courtControllerRemove(courtId);
  revalidatePath(coursePath(venueId));
}

export async function toggleCourtStatus(
  venueId: string,
  courtId: string,
  nextStatus: 'ACTIVE' | 'MAINTENANCE',
): Promise<void> {
  const session = await requireSession();
  const { courts } = createAuthenticatedApiClient(session.accessToken);
  await courts.courtControllerUpdate(courtId, { status: nextStatus });
  revalidatePath(coursePath(venueId));
}
