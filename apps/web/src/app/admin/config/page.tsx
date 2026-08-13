import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { updateSystemConfig } from './actions';

export default async function AdminConfigPage() {
  const session = await requireSession();
  const { systemConfig } = createAuthenticatedApiClient(session.accessToken);

  let config;
  try {
    const { data } = await systemConfig.systemConfigControllerGet();
    config = data;
  } catch (err) {
    handleApiError(err);
  }

  const field = (name: string, label: string, value: number) => (
    <label className="flex flex-col gap-1 text-sm" key={name}>
      {label}
      <input
        type="number"
        name={name}
        defaultValue={value}
        min={0}
        className="rounded border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-900"
      />
    </label>
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Cấu hình hệ thống</h1>
      <form action={updateSystemConfig} className="flex max-w-md flex-col gap-4">
        {field(
          'cancellationFullRefundHours',
          'Hoàn 100% nếu hủy trước (giờ)',
          config.cancellationFullRefundHours,
        )}
        {field(
          'cancellationPartialRefundHours',
          'Hoàn một phần nếu hủy trước (giờ)',
          config.cancellationPartialRefundHours,
        )}
        {field(
          'cancellationPartialRefundPercent',
          'Tỷ lệ hoàn một phần (%)',
          config.cancellationPartialRefundPercent,
        )}
        {field(
          'platformCommissionPercent',
          'Hoa hồng nền tảng (%)',
          config.platformCommissionPercent,
        )}
        <button
          type="submit"
          className="self-start rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
        >
          Lưu
        </button>
      </form>
    </div>
  );
}
