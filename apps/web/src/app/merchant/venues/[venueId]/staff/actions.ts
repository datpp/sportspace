'use server';

import { isAxiosError } from 'axios';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';

const staffSchema = z.object({
  fullName: z.string().min(1, 'Họ tên không hợp lệ'),
  phone: z.string().min(1, 'Số điện thoại không hợp lệ'),
  position: z.string().min(1, 'Chức vụ không hợp lệ'),
});

export interface StaffActionState {
  error?: string;
}

function staffPath(venueId: string): string {
  return `/merchant/venues/${venueId}/staff`;
}

export async function addStaff(
  venueId: string,
  _prevState: StaffActionState | undefined,
  formData: FormData,
): Promise<StaffActionState> {
  const parsed = staffSchema.safeParse({
    fullName: formData.get('fullName'),
    phone: formData.get('phone'),
    position: formData.get('position'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' };
  }

  const session = await requireSession();
  const { staff } = createAuthenticatedApiClient(session.accessToken);

  try {
    await staff.staffControllerCreate({ venueId, ...parsed.data });
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 401) {
      redirect('/login');
    }
    return { error: 'Không thể thêm nhân viên, vui lòng thử lại' };
  }

  revalidatePath(staffPath(venueId));
  return {};
}

export async function deactivateStaff(venueId: string, staffId: string): Promise<void> {
  const session = await requireSession();
  const { staff } = createAuthenticatedApiClient(session.accessToken);

  try {
    await staff.staffControllerUpdate(staffId, { isActive: false });
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 401) {
      redirect('/login');
    }
    throw err;
  }

  revalidatePath(staffPath(venueId));
}
