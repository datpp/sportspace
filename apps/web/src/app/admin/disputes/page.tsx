import { DisputeStatus, ResolveDisputeDtoStatus } from '@sportspace/shared';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { resolveDispute } from './actions';

export default async function AdminDisputesPage() {
  const session = await requireSession();
  const { disputes } = createAuthenticatedApiClient(session.accessToken);

  let openDisputes;
  try {
    const { data } = await disputes.disputeControllerFindAll({
      status: DisputeStatus.OPEN,
    });
    openDisputes = data;
  } catch (err) {
    handleApiError(err);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Khiếu nại</h1>

      {openDisputes.length === 0 && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Không có khiếu nại nào đang chờ xử lý.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {openDisputes.map((dispute) => (
          <div
            key={dispute.id}
            className="flex flex-col gap-3 rounded border border-zinc-200 p-4 text-sm dark:border-zinc-800"
          >
            <p className="font-medium">Đơn #{dispute.booking.id}</p>
            <p className="text-zinc-600 dark:text-zinc-400">{dispute.reason}</p>
            <form
              action={resolveDispute.bind(null, dispute.id)}
              className="flex flex-col gap-2 sm:flex-row sm:items-end"
            >
              <label className="flex flex-col gap-1 text-xs">
                Ghi chú xử lý
                <textarea
                  name="resolutionNote"
                  required
                  minLength={5}
                  className="rounded border border-zinc-300 p-1.5 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                Số tiền hoàn (VNĐ, nếu có)
                <input
                  type="number"
                  name="refundAmount"
                  min={1}
                  className="rounded border border-zinc-300 p-1.5 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="submit"
                  name="status"
                  value={ResolveDisputeDtoStatus.RESOLVED}
                  className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
                >
                  Chấp nhận
                </button>
                <button
                  type="submit"
                  name="status"
                  value={ResolveDisputeDtoStatus.REJECTED}
                  className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 dark:border-red-800 dark:text-red-400"
                >
                  Từ chối
                </button>
              </div>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
