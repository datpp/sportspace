import { DisputeStatus, ResolveDisputeDtoStatus } from '@sportspace/shared';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { SearchInput } from '@/components/list/search-input';
import { FilterSelect } from '@/components/list/filter-select';
import { Pagination } from '@/components/list/pagination';
import { resolveDispute } from './actions';

export default async function AdminDisputesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page) || 1;
  const q = typeof sp.q === 'string' ? sp.q : undefined;
  const status = typeof sp.status === 'string' ? sp.status : undefined;

  const session = await requireSession();
  const { disputes } = createAuthenticatedApiClient(session.accessToken);

  let disputesPage;
  try {
    const { data } = await disputes.disputeControllerFindAll({ page, q, status } as never);
    disputesPage = data;
  } catch (err) {
    handleApiError(err);
  }

  const disputeList = disputesPage.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Khiếu nại</h1>

      <div className="flex flex-wrap gap-3">
        <SearchInput placeholder="Tìm theo lý do hoặc người khiếu nại" />
        <FilterSelect
          paramKey="status"
          label="Trạng thái"
          options={[
            { value: DisputeStatus.OPEN, label: 'Đang chờ' },
            { value: 'ALL', label: 'Tất cả' },
            { value: DisputeStatus.RESOLVED, label: 'Đã chấp nhận' },
            { value: DisputeStatus.REJECTED, label: 'Đã từ chối' },
          ]}
        />
      </div>

      {disputeList.length === 0 && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Không có khiếu nại nào phù hợp.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {disputeList.map((dispute) => (
          <div
            key={dispute.id}
            className="flex flex-col gap-3 rounded border border-zinc-200 p-4 text-sm dark:border-zinc-800"
          >
            <p className="font-medium">
              Đơn #{dispute.booking.id} — {dispute.status}
            </p>
            <p className="text-zinc-600 dark:text-zinc-400">{dispute.reason}</p>
            {dispute.status === DisputeStatus.OPEN && (
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
            )}
          </div>
        ))}
      </div>

      <Pagination page={disputesPage.meta.page} totalPages={disputesPage.meta.totalPages} />
    </div>
  );
}
