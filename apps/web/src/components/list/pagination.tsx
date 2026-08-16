'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { withParam } from './list-query';

export function Pagination({
  page,
  totalPages,
}: {
  page: number;
  totalPages: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function goTo(next: number) {
    const query = withParam(searchParams, { page: String(next) });
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between text-sm">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => goTo(page - 1)}
        className="rounded border border-zinc-300 px-3 py-1.5 disabled:opacity-40 dark:border-zinc-700"
      >
        Trước
      </button>
      <span className="text-zinc-500">
        Trang {page} / {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => goTo(page + 1)}
        className="rounded border border-zinc-300 px-3 py-1.5 disabled:opacity-40 dark:border-zinc-700"
      >
        Sau
      </button>
    </div>
  );
}
