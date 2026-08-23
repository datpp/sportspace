import { VenueStatus } from '@sportspace/shared';
import type { AdminControllerGetVenuesStatus } from '@sportspace/shared';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { assetUrl } from '@/lib/asset-url';
import { SearchInput } from '@/components/list/search-input';
import { FilterSelect } from '@/components/list/filter-select';
import { Pagination } from '@/components/list/pagination';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge, type StatusBadgeVariant } from '@/components/status-badge';
import { approveVenue, rejectVenue } from './actions';

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

export default async function AdminVenuesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page) || 1;
  const q = typeof sp.q === 'string' ? sp.q : undefined;
  const status = typeof sp.status === 'string' ? sp.status : undefined;
  const province = typeof sp.province === 'string' ? sp.province : undefined;

  const session = await requireSession();
  const { admin } = createAuthenticatedApiClient(session.accessToken);

  let venuesPage;
  let provinces: string[] = [];
  try {
    const [venuesRes, provincesRes] = await Promise.all([
      admin.adminControllerGetVenues({
        page,
        q,
        province,
        status: status as AdminControllerGetVenuesStatus | undefined,
      }),
      admin.adminControllerGetVenueProvinces(),
    ]);
    venuesPage = venuesRes.data;
    provinces = provincesRes.data;
  } catch (err) {
    handleApiError(err);
  }

  const venueList = venuesPage.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Duyệt cụm sân</h1>

      <div className="flex flex-wrap gap-3">
        <SearchInput placeholder="Tìm theo tên, địa chỉ hoặc chủ sở hữu" />
        <FilterSelect
          paramKey="status"
          label="Trạng thái"
          options={[
            { value: VenueStatus.PENDING, label: 'Chờ duyệt' },
            { value: 'ALL', label: 'Tất cả' },
            { value: VenueStatus.APPROVED, label: 'Đã duyệt' },
            { value: VenueStatus.REJECTED, label: 'Từ chối' },
          ]}
        />
        <FilterSelect
          paramKey="province"
          label="Tỉnh/Thành"
          options={[
            { value: '', label: 'Tất cả' },
            ...provinces.map((p) => ({ value: p, label: p })),
          ]}
        />
      </div>

      {venueList.length === 0 && (
        <p className="text-sm text-muted-foreground">Không có cụm sân nào phù hợp.</p>
      )}

      <div className="flex flex-col gap-3">
        {venueList.map((venue) => (
          <Card key={venue.id}>
            <CardContent className="flex flex-col gap-2 text-sm">
              <p className="font-medium">{venue.name}</p>
              <p className="text-muted-foreground">
                {venue.address}
                {venue.province ? ` — ${venue.province}` : ''}
              </p>
              <p className="text-muted-foreground">
                Chủ sở hữu: {venue.owner.fullName} ({venue.owner.email})
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Đăng ký lúc {new Date(venue.createdAt).toLocaleString('vi-VN')}</span>
                <StatusBadge variant={VENUE_STATUS_VARIANT[venue.status]}>
                  {VENUE_STATUS_LABEL[venue.status]}
                </StatusBadge>
              </div>
              {venue.images.length > 0 && (
                <div className="flex gap-2 overflow-x-auto">
                  {venue.images.map((img) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={img}
                      src={assetUrl(img)}
                      alt=""
                      className="h-16 w-16 flex-shrink-0 rounded object-cover"
                    />
                  ))}
                </div>
              )}
              {venue.status === VenueStatus.PENDING && (
                <div className="flex gap-3">
                  <form action={approveVenue.bind(null, venue.id)}>
                    <Button type="submit">Duyệt</Button>
                  </form>
                  <form action={rejectVenue.bind(null, venue.id)}>
                    <Button type="submit" variant="destructive">
                      Từ chối
                    </Button>
                  </form>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Pagination page={venuesPage.meta.page} totalPages={venuesPage.meta.totalPages} />
    </div>
  );
}
