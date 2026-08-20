'use server';

import { isAxiosError } from 'axios';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createAnonymousApiClient } from '@/lib/api-client';

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Thiếu token'),
  newPassword: z.string().min(8, 'Mật khẩu phải có ít nhất 8 ký tự'),
});

export interface ResetPasswordActionState {
  error?: string;
}

export async function resetPassword(
  _prevState: ResetPasswordActionState | undefined,
  formData: FormData,
): Promise<ResetPasswordActionState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get('token'),
    newPassword: formData.get('newPassword'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' };
  }

  const { auth } = createAnonymousApiClient();
  try {
    await auth.authControllerResetPassword(parsed.data);
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 400) {
      return { error: 'Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn' };
    }
    return { error: 'Không thể đặt lại mật khẩu, vui lòng thử lại' };
  }

  redirect('/login');
}
