import Link from 'next/link';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { PriceRuleForm } from './price-rule-form';
import { removePriceRule } from './actions';

const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function formatTime(time: string): string {
  return time.slice(0, 5);
}

export default async function PriceRulesPage({
  params,
}: {
  params: Promise<{ venueId: string; courtId: string }>;
}) {
  const { venueId, courtId } = await params;
  const session = await requireSession();
  const { courts } = createAuthenticatedApiClient(session.accessToken);

  let courtName: string;
  let priceRules;
  try {
    const [courtRes, priceRulesRes] = await Promise.all([
      courts.courtControllerFindOne(courtId),
      courts.courtControllerListPriceRules(courtId),
    ]);
    courtName = courtRes.data.name;
    priceRules = priceRulesRes.data;
  } catch (err) {
    handleApiError(err);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-sm text-zinc-500">
          <Link href={`/merchant/venues/${venueId}/courts`} className="hover:underline">
            Sân con
          </Link>{' '}
          / {courtName}
        </p>
        <h1 className="text-xl font-semibold">Giá theo khung giờ — {courtName}</h1>
      </div>

      <div className="flex flex-col gap-2">
        {priceRules.length === 0 && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Chưa có khung giá nào.</p>
        )}
        {priceRules.map((rule) => (
          <div
            key={rule.id}
            className="flex items-center justify-between rounded border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800"
          >
            <span>
              {DAY_LABELS[rule.dayOfWeek]} {formatTime(rule.startTime)}–{formatTime(rule.endTime)}:{' '}
              {Number(rule.price).toLocaleString('vi-VN')}đ
            </span>
            <form action={removePriceRule.bind(null, venueId, courtId, rule.id)}>
              <button type="submit" className="text-red-600 hover:underline dark:text-red-400">
                Xoá
              </button>
            </form>
          </div>
        ))}
      </div>

      <div className="rounded border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
        <h2 className="mb-3 text-sm font-medium">Thêm khung giá mới</h2>
        <PriceRuleForm venueId={venueId} courtId={courtId} />
      </div>
    </div>
  );
}
