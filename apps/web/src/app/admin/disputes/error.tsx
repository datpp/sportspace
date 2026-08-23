'use client';

import { PageError } from '@/components/page-state';

export default function AdminDisputesError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageError
      message="Có lỗi xảy ra khi tải hoặc xử lý danh sách khiếu nại."
      onRetry={reset}
    />
  );
}
