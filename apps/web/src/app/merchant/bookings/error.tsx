'use client';

import { PageError } from '@/components/page-state';

export default function MerchantBookingsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageError
      message="Có lỗi xảy ra khi tải hoặc cập nhật danh sách đơn đặt sân."
      onRetry={reset}
    />
  );
}
