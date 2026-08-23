import { DisputeStatus, ResolveDisputeDtoStatus } from '@sportspace/shared';
import type { DisputeControllerFindAllStatus } from '@sportspace/shared';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { SearchInput } from '@/components/list/search-input';
import { FilterSelect } from '@/components/list/filter-select';
import { Pagination } from '@/components/list/pagination';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge, type StatusBadgeVariant } from '@/components/status-badge';
import { resolveDispute } from './actions';

// Nhãn và biến thể lấy từ FilterSelect "Trạng thái" phía trên — không tự đặt chữ mới.
const DISPUTE_STATUS_LABEL: Record<DisputeStatus, string> = {
  [DisputeStatus.OPEN]: 'Đang chờ',
  [DisputeStatus.RESOLVED]: 'Đã chấp nhận',
  [DisputeStatus.REJECTED]: 'Đã từ chối',
};

const DISPUTE_STATUS_VARIANT: Record<DisputeStatus, StatusBadgeVariant> = {
  [DisputeStatus.OPEN]: 'warning',
  [DisputeStatus.RESOLVED]: 'success',
  [DisputeStatus.REJECTED]: 'danger',
};

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
    const { data } = await disputes.disputeControllerFindAll({
      page,
      q,
      status: status as DisputeControllerFindAllStatus | undefined,
    });
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
        <p className="text-sm text-muted-foreground">Không có khiếu nại nào phù hợp.</p>
      )}

      <div className="flex flex-col gap-4">
        {disputeList.map((dispute) => (
          <Card key={dispute.id}>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <span>Đơn #{dispute.booking.id}</span>
                <StatusBadge variant={DISPUTE_STATUS_VARIANT[dispute.status]}>
                  {DISPUTE_STATUS_LABEL[dispute.status]}
                </StatusBadge>
              </div>
              <p className="text-muted-foreground">{dispute.reason}</p>
              {dispute.status === DisputeStatus.OPEN && (
                <form
                  action={resolveDispute.bind(null, dispute.id)}
                  className="flex flex-col gap-2 sm:flex-row sm:items-end"
                >
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`resolutionNote-${dispute.id}`} className="text-xs">
                      Ghi chú xử lý
                    </Label>
                    <textarea
                      id={`resolutionNote-${dispute.id}`}
                      name="resolutionNote"
                      required
                      minLength={5}
                      className="rounded-lg border border-input bg-transparent p-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`refundAmount-${dispute.id}`} className="text-xs">
                      Số tiền hoàn (VNĐ, nếu có)
                    </Label>
                    <Input
                      id={`refundAmount-${dispute.id}`}
                      type="number"
                      name="refundAmount"
                      min={1}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" name="status" value={ResolveDisputeDtoStatus.RESOLVED}>
                      Chấp nhận
                    </Button>
                    <Button
                      type="submit"
                      name="status"
                      value={ResolveDisputeDtoStatus.REJECTED}
                      variant="destructive"
                    >
                      Từ chối
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Pagination page={disputesPage.meta.page} totalPages={disputesPage.meta.totalPages} />
    </div>
  );
}
