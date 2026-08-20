'use server';

import { z } from 'zod';
import { createAnonymousApiClient } from '@/lib/api-client';

const forgotPasswordSchema = z.object({
  email: z.email('Email không hợp lệ'),
});

export interface ForgotPasswordActionState {
  error?: string;
  success?: boolean;
}

export async function forgotPassword(
  _prevState: ForgotPasswordActionState | undefined,
  formData: FormData,
): Promise<ForgotPasswordActionState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' };
  }

  const { auth } = createAnonymousApiClient();
  try {
    await auth.authControllerForgotPassword(parsed.data);
  } catch {
    // Backend luôn trả 200 cho endpoint này theo thiết kế; lỗi mạng/5xx ở đây
    // là sự cố hạ tầng, không phải tín hiệu "email không tồn tại" — vẫn hiển
    // thị thông báo thành công chung để không lộ email có tồn tại hay không.
  }

  return { success: true };
}
