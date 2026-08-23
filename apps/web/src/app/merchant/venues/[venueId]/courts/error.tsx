'use client';

import { PageError } from '@/components/page-state';

export default function CourtsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageError
      message="Có lỗi xảy ra khi tải hoặc cập nhật dữ liệu sân."
      onRetry={reset}
    />
  );
}
