'use server';

import { isAxiosError } from 'axios';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { AuthResponseDtoRole } from '@sportspace/shared';
import { createAnonymousApiClient } from '@/lib/api-client';
import { setSession } from '@/lib/session';

const loginSchema = z.object({
  email: z.email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

export interface LoginActionState {
  error?: string;
}

function roleHomePath(role: AuthResponseDtoRole): string {
  return role === AuthResponseDtoRole.ADMIN ? '/admin' : '/merchant';
}

export async function login(
  _prevState: LoginActionState | undefined,
  formData: FormData,
): Promise<LoginActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' };
  }

  const { auth } = createAnonymousApiClient();
  let response;
  try {
    response = await auth.authControllerLogin(parsed.data);
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 401) {
      return { error: 'Email hoặc mật khẩu không đúng' };
    }
    return { error: 'Không thể kết nối máy chủ, vui lòng thử lại' };
  }

  const { accessToken, refreshToken, userId, role } = response.data;

  if (role === AuthResponseDtoRole.PLAYER) {
    return { error: 'Tài khoản này không có quyền truy cập trang quản trị' };
  }

  await setSession({ accessToken, refreshToken, userId, role });
  redirect(roleHomePath(role));
}
