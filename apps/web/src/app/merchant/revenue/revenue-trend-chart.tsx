'use client';

import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import type { RevenueTimeseriesPointDto } from '@sportspace/shared';

const LINE_COLOR = 'var(--rc-line)';

function formatVnd(value: number): string {
  return `${value.toLocaleString('vi-VN')}đ`;
}

export function formatBucketShort(bucket: string, isMonthly: boolean): string {
  if (isMonthly) {
    const [year, month] = bucket.split('-');
    return `Thg ${Number(month)}/${year.slice(2)}`;
  }
  const [, month, day] = bucket.split('-');
  return `${day}/${month}`;
}

export function formatBucketFull(bucket: string, isMonthly: boolean): string {
  if (isMonthly) {
    const [year, month] = bucket.split('-');
    return `Tháng ${Number(month)}/${year}`;
  }
  const [year, month, day] = bucket.split('-');
  return `${day}/${month}/${year}`;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: RevenueTimeseriesPointDto }>;
  isMonthly: boolean;
}

function ChartTooltip({ active, payload, isMonthly }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as RevenueTimeseriesPointDto;
  return (
    <div
      className="rounded px-3 py-2 text-xs shadow-sm"
      style={{
        background: 'var(--rc-tooltip-bg)',
        border: '1px solid var(--rc-tooltip-border)',
        color: 'var(--rc-tooltip-text)',
      }}
    >
      <p className="font-medium">{formatBucketFull(point.bucket, isMonthly)}</p>
      <p style={{ color: 'var(--rc-tooltip-muted)' }}>Doanh thu: {formatVnd(point.revenue)}</p>
      <p style={{ color: 'var(--rc-tooltip-muted)' }}>Số đơn: {point.bookings}</p>
    </div>
  );
}

export function RevenueTrendChart({
  data,
  range,
}: {
  data: RevenueTimeseriesPointDto[];
  range: 'week' | 'month' | 'year';
}) {
  const isMonthly = range === 'year';

  return (
    <AreaChart
      responsive
      data={data}
      style={{ width: '100%', maxWidth: 720, aspectRatio: 2.2 }}
      margin={{ top: 16, right: 8, left: 8, bottom: 8 }}
    >
      <CartesianGrid vertical={false} stroke="var(--rc-grid)" />
      <XAxis
        dataKey="bucket"
        tickLine={false}
        axisLine={{ stroke: 'var(--rc-axis)' }}
        tick={{ fill: 'var(--rc-tick)', fontSize: 11 }}
        tickFormatter={(bucket: string) => formatBucketShort(bucket, isMonthly)}
        interval="preserveStartEnd"
        minTickGap={24}
      />
      <YAxis
        tickLine={false}
        axisLine={false}
        tick={{ fill: 'var(--rc-tick)', fontSize: 12 }}
        tickFormatter={(value: number) => value.toLocaleString('vi-VN')}
        width={64}
      />
      <Tooltip
        content={<ChartTooltip isMonthly={isMonthly} />}
        cursor={{ stroke: 'var(--rc-axis)', strokeWidth: 1 }}
      />
      <Area
        type="monotone"
        dataKey="revenue"
        stroke={LINE_COLOR}
        strokeWidth={2}
        fill={LINE_COLOR}
        fillOpacity={0.1}
        dot={false}
        activeDot={{ r: 4, fill: LINE_COLOR }}
      />
    </AreaChart>
  );
}
