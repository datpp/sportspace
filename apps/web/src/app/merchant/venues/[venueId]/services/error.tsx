'use client';

import { PageError } from '@/components/page-state';

export default function ServicesError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageError
      message="Có lỗi xảy ra khi tải hoặc cập nhật danh sách dịch vụ."
      onRetry={reset}
    />
  );
}
