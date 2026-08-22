'use server';

import { isAxiosError } from 'axios';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';

export interface ImageActionState {
  error?: string;
}

function imagesPath(venueId: string): string {
  return `/merchant/venues/${venueId}/images`;
}

export async function uploadImage(
  venueId: string,
  _prevState: ImageActionState | undefined,
  formData: FormData,
): Promise<ImageActionState> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Vui lòng chọn một ảnh' };
  }

  const session = await requireSession();
  const { venues } = createAuthenticatedApiClient(session.accessToken);

  try {
    await venues.venueControllerUploadImage(venueId, { file });
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 401) {
      redirect('/login');
    }
    if (isAxiosError(err) && err.response?.status === 413) {
      return { error: 'Ảnh vượt quá 5MB' };
    }
    if (isAxiosError(err) && err.response?.status === 400) {
      return { error: 'Ảnh không hợp lệ hoặc đã đủ số lượng tối đa (8 ảnh)' };
    }
    return { error: 'Không thể tải ảnh lên, vui lòng thử lại' };
  }

  revalidatePath(imagesPath(venueId));
  return {};
}

export async function deleteImage(venueId: string, url: string): Promise<void> {
  const session = await requireSession();
  const { venues } = createAuthenticatedApiClient(session.accessToken);

  try {
    await venues.venueControllerRemoveImage(venueId, { url });
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 401) {
      redirect('/login');
    }
    throw err;
  }

  revalidatePath(imagesPath(venueId));
}
