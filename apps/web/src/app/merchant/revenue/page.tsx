import Link from 'next/link';
import { MerchantControllerGetRevenueRange } from '@sportspace/shared';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';

const RANGE_ORDER = ['day', 'week', 'month', 'year'] as const;
type Range = (typeof RANGE_ORDER)[number];

const RANGE_LABELS: Record<Range, string> = {
  day: 'Hôm nay',
  week: 'Tuần này',
  month: 'Tháng này',
  year: 'Năm nay',
};

function isValidRange(value: string | undefined): value is Range {
  return value !== undefined && (RANGE_ORDER as readonly string[]).includes(value);
}

function formatVnd(value: number): string {
  return `${value.toLocaleString('vi-VN')}đ`;
}

export default async function RevenuePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rangeParam } = await searchParams;
  const selectedRange = isValidRange(rangeParam) ? rangeParam : 'month';

  const session = await requireSession();
  const { merchant } = createAuthenticatedApiClient(session.accessToken);

  let totalRevenue: number;
  let totalBookings: number;
  try {
    const { data } = await merchant.merchantControllerGetRevenue({
      range: selectedRange as MerchantControllerGetRevenueRange,
    });
    totalRevenue = Number(data.totalRevenue);
    totalBookings = Number(data.totalBookings);
  } catch (err) {
    handleApiError(err);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Thống kê doanh thu</h1>
        <nav className="mt-3 flex gap-2">
          {RANGE_ORDER.map((range) => (
            <Link
              key={range}
              href={`/merchant/revenue?range=${range}`}
              className={`rounded px-3 py-1.5 text-sm ${
                range === selectedRange
                  ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900'
                  : 'border border-zinc-300 dark:border-zinc-700'
              }`}
            >
              {RANGE_LABELS[range]}
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex flex-wrap gap-8">
        <div>
          <p className="text-sm text-zinc-500">Doanh thu — {RANGE_LABELS[selectedRange]}</p>
          <p className="text-5xl font-semibold tabular-nums">{formatVnd(totalRevenue)}</p>
        </div>
        <div>
          <p className="text-sm text-zinc-500">Số đơn đã xác nhận</p>
          <p className="text-2xl font-semibold tabular-nums">{totalBookings}</p>
        </div>
      </div>

      {totalRevenue === 0 && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Chưa có doanh thu trong khoảng thời gian này.
        </p>
      )}
    </div>
  );
}
