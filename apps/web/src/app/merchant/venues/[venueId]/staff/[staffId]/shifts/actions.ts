'use server';

import { isAxiosError } from 'axios';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const shiftSchema = z
  .object({
    shiftDate: z.string().min(1, 'Ngày không hợp lệ'),
    startTime: z.string().regex(TIME_PATTERN, 'Giờ bắt đầu không hợp lệ (HH:mm)'),
    endTime: z.string().regex(TIME_PATTERN, 'Giờ kết thúc không hợp lệ (HH:mm)'),
  })
  .refine((data) => data.startTime < data.endTime, {
    message: 'Giờ bắt đầu phải trước giờ kết thúc',
    path: ['endTime'],
  });

export interface ShiftActionState {
  error?: string;
}

function shiftsPath(venueId: string, staffId: string): string {
  return `/merchant/venues/${venueId}/staff/${staffId}/shifts`;
}

export async function addShift(
  venueId: string,
  staffId: string,
  _prevState: ShiftActionState | undefined,
  formData: FormData,
): Promise<ShiftActionState> {
  const parsed = shiftSchema.safeParse({
    shiftDate: formData.get('shiftDate'),
    startTime: formData.get('startTime'),
    endTime: formData.get('endTime'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' };
  }

  const session = await requireSession();
  const { staff } = createAuthenticatedApiClient(session.accessToken);

  try {
    await staff.staffControllerCreateShift(staffId, parsed.data);
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 401) {
      redirect('/login');
    }
    if (isAxiosError(err) && err.response?.status === 400) {
      return { error: 'Ca làm bị trùng giờ với ca đã có' };
    }
    return { error: 'Không thể thêm ca làm, vui lòng thử lại' };
  }

  revalidatePath(shiftsPath(venueId, staffId));
  return {};
}

export async function removeShift(
  venueId: string,
  staffId: string,
  shiftId: string,
): Promise<void> {
  const session = await requireSession();
  const { staff } = createAuthenticatedApiClient(session.accessToken);

  try {
    await staff.staffControllerRemoveShift(staffId, shiftId);
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 401) {
      redirect('/login');
    }
    throw err;
  }

  revalidatePath(shiftsPath(venueId, staffId));
}
