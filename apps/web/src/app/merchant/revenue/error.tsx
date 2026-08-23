'use client';

import { PageError } from '@/components/page-state';

export default function RevenueError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageError
      message="Có lỗi xảy ra khi tải thống kê doanh thu."
      onRetry={reset}
    />
  );
}
