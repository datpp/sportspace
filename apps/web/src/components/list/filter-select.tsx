'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { withParam } from './list-query';

export function FilterSelect({
  paramKey,
  label,
  options,
}: {
  paramKey: string;
  label: string;
  options: { value: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(paramKey) ?? '';

  function handleChange(next: string) {
    const query = withParam(searchParams, { [paramKey]: next });
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      {label}
      <select
        value={current}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
