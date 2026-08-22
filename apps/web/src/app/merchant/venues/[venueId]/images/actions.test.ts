import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';

const venueControllerUploadImage = vi.fn();
const venueControllerRemoveImage = vi.fn();
const requireSession = vi.fn();
const revalidatePath = vi.fn();
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock('@/lib/api-client', () => ({
  createAuthenticatedApiClient: () => ({
    venues: { venueControllerUploadImage, venueControllerRemoveImage },
  }),
}));
vi.mock('@/lib/require-session', () => ({ requireSession }));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('next/navigation', () => ({ redirect }));

const { uploadImage, deleteImage } = await import('./actions');

function axiosErrorWithStatus(status: number): AxiosError {
  return new AxiosError('erro', String(status), undefined, undefined, {
    status,
    data: {},
    statusText: 'erro',
    headers: {},
    config: {} as never,
  });
}

function buildFormData(file?: File): FormData {
  const fd = new FormData();
  if (file) fd.set('file', file);
  return fd;
}

beforeEach(() => {
  venueControllerUploadImage.mockReset();
  venueControllerRemoveImage.mockReset();
  requireSession.mockReset().mockResolvedValue({
    accessToken: 'at',
    refreshToken: 'rt',
    userId: 'merchant-1',
    role: 'MERCHANT',
  });
  revalidatePath.mockClear();
  redirect.mockClear();
});

describe('uploadImage', () => {
  it('trả về lỗi khi chưa chọn file', async () => {
    const result = await uploadImage('venue-1', undefined, buildFormData());

    expect(result.error).toBeDefined();
    expect(venueControllerUploadImage).not.toHaveBeenCalled();
  });

  it('gọi API và revalidate khi có file hợp lệ', async () => {
    venueControllerUploadImage.mockResolvedValue({ data: {} });
    const file = new File(['abc'], 'a.jpg', { type: 'image/jpeg' });

    const result = await uploadImage('venue-1', undefined, buildFormData(file));

    expect(result.error).toBeUndefined();
    expect(venueControllerUploadImage).toHaveBeenCalledWith('venue-1', { file });
    expect(revalidatePath).toHaveBeenCalledWith('/merchant/venues/venue-1/images');
  });

  it('401 redirect về /login', async () => {
    venueControllerUploadImage.mockRejectedValue(axiosErrorWithStatus(401));
    const file = new File(['abc'], 'a.jpg', { type: 'image/jpeg' });

    await expect(uploadImage('venue-1', undefined, buildFormData(file))).rejects.toThrow(
      'NEXT_REDIRECT:/login',
    );
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('413 trả về lỗi ảnh vượt quá 5MB', async () => {
    venueControllerUploadImage.mockRejectedValue(axiosErrorWithStatus(413));
    const file = new File(['abc'], 'a.jpg', { type: 'image/jpeg' });

    const result = await uploadImage('venue-1', undefined, buildFormData(file));

    expect(result.error).toBe('Ảnh vượt quá 5MB');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('400 trả về lỗi ảnh không hợp lệ hoặc đủ số lượng tối đa', async () => {
    venueControllerUploadImage.mockRejectedValue(axiosErrorWithStatus(400));
    const file = new File(['abc'], 'a.jpg', { type: 'image/jpeg' });

    const result = await uploadImage('venue-1', undefined, buildFormData(file));

    expect(result.error).toBe('Ảnh không hợp lệ hoặc đã đủ số lượng tối đa (8 ảnh)');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('lỗi khác trả về thông báo lỗi chung', async () => {
    venueControllerUploadImage.mockRejectedValue(new Error('server error'));
    const file = new File(['abc'], 'a.jpg', { type: 'image/jpeg' });

    const result = await uploadImage('venue-1', undefined, buildFormData(file));

    expect(result.error).toBe('Không thể tải ảnh lên, vui lòng thử lại');
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('deleteImage', () => {
  it('gọi API xoá ảnh và revalidate', async () => {
    venueControllerRemoveImage.mockResolvedValue({ data: {} });

    await deleteImage('venue-1', '/uploads/venues/a.jpg');

    expect(venueControllerRemoveImage).toHaveBeenCalledWith('venue-1', {
      url: '/uploads/venues/a.jpg',
    });
    expect(revalidatePath).toHaveBeenCalledWith('/merchant/venues/venue-1/images');
  });

  it('401 redirect về /login', async () => {
    venueControllerRemoveImage.mockRejectedValue(axiosErrorWithStatus(401));

    await expect(deleteImage('venue-1', '/uploads/venues/a.jpg')).rejects.toThrow(
      'NEXT_REDIRECT:/login',
    );
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('lỗi khác ném ra ngoài cho error boundary xử lý', async () => {
    venueControllerRemoveImage.mockRejectedValue(new Error('server error'));

    await expect(deleteImage('venue-1', '/uploads/venues/a.jpg')).rejects.toThrow('server error');
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
