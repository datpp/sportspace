'use client';

import { PageError } from '@/components/page-state';

export default function PriceRulesError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageError
      message="Có lỗi xảy ra khi tải hoặc cập nhật bảng giá."
      onRetry={reset}
    />
  );
}
