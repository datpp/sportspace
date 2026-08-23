import Link from 'next/link';
import { VenueStatus } from '@sportspace/shared';
import type { MerchantControllerGetVenuesStatus } from '@sportspace/shared';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { SearchInput } from '@/components/list/search-input';
import { FilterSelect } from '@/components/list/filter-select';
import { Pagination } from '@/components/list/pagination';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge, type StatusBadgeVariant } from '@/components/status-badge';
import { cn } from '@/lib/utils';

// Nhãn và biến thể lấy từ FilterSelect "Trạng thái" phía trên — không tự đặt chữ mới.
const VENUE_STATUS_LABEL: Record<VenueStatus, string> = {
  [VenueStatus.PENDING]: 'Chờ duyệt',
  [VenueStatus.APPROVED]: 'Đã duyệt',
  [VenueStatus.REJECTED]: 'Từ chối',
};

const VENUE_STATUS_VARIANT: Record<VenueStatus, StatusBadgeVariant> = {
  [VenueStatus.PENDING]: 'warning',
  [VenueStatus.APPROVED]: 'success',
  [VenueStatus.REJECTED]: 'danger',
};

export default async function VenuesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page) || 1;
  const q = typeof sp.q === 'string' ? sp.q : undefined;
  const status = typeof sp.status === 'string' ? sp.status : undefined;

  const session = await requireSession();
  const { merchant } = createAuthenticatedApiClient(session.accessToken);

  let venuesPage;
  try {
    venuesPage = (
      await merchant.merchantControllerGetVenues({
        page,
        q,
        status: status as MerchantControllerGetVenuesStatus | undefined,
      })
    ).data;
  } catch (err) {
    handleApiError(err);
  }

  const venueList = venuesPage.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Cụm sân của tôi</h1>
        <Link href="/merchant/venues/new" className={cn(buttonVariants())}>
          Tạo cụm sân mới
        </Link>
      </div>

      <div className="flex flex-wrap gap-3">
        <SearchInput placeholder="Tìm theo tên hoặc địa chỉ" />
        <FilterSelect
          paramKey="status"
          label="Trạng thái"
          options={[
            { value: '', label: 'Tất cả' },
            { value: VenueStatus.PENDING, label: 'Chờ duyệt' },
            { value: VenueStatus.APPROVED, label: 'Đã duyệt' },
            { value: VenueStatus.REJECTED, label: 'Từ chối' },
          ]}
        />
      </div>

      {venueList.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Không có cụm sân nào phù hợp. Bấm &quot;Tạo cụm sân mới&quot; để bắt đầu.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {venueList.map((venue) => (
          <Link key={venue.id} href={`/merchant/venues/${venue.id}/courts`} className="block">
            <Card className="transition-colors hover:bg-muted">
              <CardContent className="flex flex-col gap-1 text-sm">
                <span className="font-medium">{venue.name}</span>
                <span className="text-muted-foreground">{venue.address}</span>
                <StatusBadge variant={VENUE_STATUS_VARIANT[venue.status]}>
                  {VENUE_STATUS_LABEL[venue.status]}
                </StatusBadge>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Pagination page={venuesPage.meta.page} totalPages={venuesPage.meta.totalPages} />
    </div>
  );
}
