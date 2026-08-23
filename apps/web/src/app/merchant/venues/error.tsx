'use client';

import { PageError } from '@/components/page-state';

export default function VenuesError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageError
      message="Có lỗi xảy ra khi tải danh sách cụm sân."
      onRetry={reset}
    />
  );
}
