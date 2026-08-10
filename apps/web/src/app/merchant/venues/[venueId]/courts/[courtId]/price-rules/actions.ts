'use server';

import { isAxiosError } from 'axios';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const priceRuleSchema = z
  .object({
    dayOfWeek: z.coerce.number('Ngày trong tuần không hợp lệ').int().min(0).max(6),
    startTime: z.string().regex(TIME_PATTERN, 'Giờ bắt đầu không hợp lệ (HH:mm)'),
    endTime: z.string().regex(TIME_PATTERN, 'Giờ kết thúc không hợp lệ (HH:mm)'),
    price: z.coerce.number('Giá không hợp lệ').positive('Giá phải lớn hơn 0'),
  })
  .refine((data) => data.startTime < data.endTime, {
    message: 'Giờ bắt đầu phải trước giờ kết thúc',
    path: ['endTime'],
  });

export interface PriceRuleActionState {
  error?: string;
}

function priceRulesPath(venueId: string, courtId: string): string {
  return `/merchant/venues/${venueId}/courts/${courtId}/price-rules`;
}

export async function addPriceRule(
  venueId: string,
  courtId: string,
  _prevState: PriceRuleActionState | undefined,
  formData: FormData,
): Promise<PriceRuleActionState> {
  const parsed = priceRuleSchema.safeParse({
    dayOfWeek: formData.get('dayOfWeek'),
    startTime: formData.get('startTime'),
    endTime: formData.get('endTime'),
    price: formData.get('price'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' };
  }

  const session = await requireSession();
  const { courts } = createAuthenticatedApiClient(session.accessToken);

  try {
    await courts.courtControllerAddPriceRule(courtId, parsed.data);
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 401) {
      redirect('/login');
    }
    return { error: 'Không thể thêm giá theo khung giờ, vui lòng thử lại' };
  }

  revalidatePath(priceRulesPath(venueId, courtId));
  return {};
}

export async function removePriceRule(
  venueId: string,
  courtId: string,
  priceRuleId: string,
): Promise<void> {
  const session = await requireSession();
  const { courts } = createAuthenticatedApiClient(session.accessToken);
  await courts.courtControllerRemovePriceRule(courtId, priceRuleId);
  revalidatePath(priceRulesPath(venueId, courtId));
}
