'use client';

import { PageError } from '@/components/page-state';

export default function AdminConfigError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageError
      message="Có lỗi xảy ra khi tải hoặc lưu cấu hình hệ thống."
      onRetry={reset}
    />
  );
}
