import Link from 'next/link';
import {
  MerchantControllerGetRevenueRange,
  MerchantControllerGetRevenueTimeseriesRange,
  type RevenueTimeseriesPointDto,
} from '@sportspace/shared';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { RevenueTrendChart } from './revenue-trend-chart';

const RANGE_ORDER = ['day', 'week', 'month', 'year'] as const;
type Range = (typeof RANGE_ORDER)[number];
type TimeseriesRange = Exclude<Range, 'day'>;

const RANGE_LABELS: Record<Range, string> = {
  day: 'Hôm nay',
  week: 'Tuần này',
  month: 'Tháng này',
  year: 'Năm nay',
};

function isValidRange(value: string | undefined): value is Range {
  return value !== undefined && (RANGE_ORDER as readonly string[]).includes(value);
}

function hasTimeseries(range: Range): range is TimeseriesRange {
  return range !== 'day';
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
  let timeseries: RevenueTimeseriesPointDto[] | undefined;
  try {
    const [revenueRes, timeseriesRes] = await Promise.all([
      merchant.merchantControllerGetRevenue({
        range: selectedRange as MerchantControllerGetRevenueRange,
      }),
      hasTimeseries(selectedRange)
        ? merchant.merchantControllerGetRevenueTimeseries({
            range: selectedRange as MerchantControllerGetRevenueTimeseriesRange,
          })
        : Promise.resolve(undefined),
    ]);
    totalRevenue = Number(revenueRes.data.totalRevenue);
    totalBookings = Number(revenueRes.data.totalBookings);
    timeseries = timeseriesRes?.data;
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
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                range === selectedRange
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border hover:bg-muted',
              )}
            >
              {RANGE_LABELS[range]}
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex flex-wrap gap-4">
        <Card className="min-w-56">
          <CardContent className="flex flex-col gap-1">
            <p className="text-sm text-muted-foreground">
              Doanh thu — {RANGE_LABELS[selectedRange]}
            </p>
            <p className="text-5xl font-semibold tabular-nums">{formatVnd(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card className="min-w-56">
          <CardContent className="flex flex-col gap-1">
            <p className="text-sm text-muted-foreground">Số đơn đã xác nhận</p>
            <p className="text-2xl font-semibold tabular-nums">{totalBookings}</p>
          </CardContent>
        </Card>
      </div>

      {totalRevenue === 0 && (
        <p className="text-sm text-muted-foreground">
          Chưa có doanh thu trong khoảng thời gian này.
        </p>
      )}

      {hasTimeseries(selectedRange) && timeseries ? (
        <div>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">Xu hướng doanh thu</h2>
          <RevenueTrendChart data={timeseries} range={selectedRange} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Chọn Tuần này, Tháng này hoặc Năm nay để xem biểu đồ xu hướng.
        </p>
      )}
    </div>
  );
}
