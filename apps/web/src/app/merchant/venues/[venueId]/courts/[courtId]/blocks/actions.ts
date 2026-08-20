'use server';

import { isAxiosError } from 'axios';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const blockSchema = z
  .object({
    blockDate: z.string().min(1, 'Vui lòng chọn ngày'),
    startTime: z.string().regex(TIME_PATTERN, 'Giờ bắt đầu không hợp lệ (HH:mm)'),
    endTime: z.string().regex(TIME_PATTERN, 'Giờ kết thúc không hợp lệ (HH:mm)'),
    reason: z.string().min(1, 'Vui lòng nhập lý do'),
  })
  .refine((data) => data.startTime < data.endTime, {
    message: 'Giờ bắt đầu phải trước giờ kết thúc',
    path: ['endTime'],
  });

export interface BlockActionState {
  error?: string;
}

function blocksPath(venueId: string, courtId: string): string {
  return `/merchant/venues/${venueId}/courts/${courtId}/blocks`;
}

export async function addBlock(
  venueId: string,
  courtId: string,
  _prevState: BlockActionState | undefined,
  formData: FormData,
): Promise<BlockActionState> {
  const parsed = blockSchema.safeParse({
    blockDate: formData.get('blockDate'),
    startTime: formData.get('startTime'),
    endTime: formData.get('endTime'),
    reason: formData.get('reason'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' };
  }

  const session = await requireSession();
  const { courts } = createAuthenticatedApiClient(session.accessToken);

  try {
    await courts.courtControllerCreateBlock(courtId, parsed.data);
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 401) {
      redirect('/login');
    }
    if (isAxiosError(err) && err.response?.status === 409) {
      return { error: 'Đã có đơn đặt sân trong khung giờ này, không thể chặn' };
    }
    return { error: 'Không thể chặn khoảng giờ, vui lòng thử lại' };
  }

  revalidatePath(blocksPath(venueId, courtId));
  return {};
}

export async function removeBlock(venueId: string, courtId: string, blockId: string): Promise<void> {
  const session = await requireSession();
  const { courts } = createAuthenticatedApiClient(session.accessToken);
  await courts.courtControllerRemoveBlock(courtId, blockId);
  revalidatePath(blocksPath(venueId, courtId));
}
