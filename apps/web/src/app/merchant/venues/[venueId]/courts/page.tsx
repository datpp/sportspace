import Link from 'next/link';
import { CourtStatus } from '@sportspace/shared';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { SearchInput } from '@/components/list/search-input';
import { Pagination } from '@/components/list/pagination';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge, type StatusBadgeVariant } from '@/components/status-badge';
import { CourtForm } from './court-form';
import { deleteCourt, toggleCourtStatus } from './actions';

// Nhãn suy ra từ vốn từ đã dùng trong trang ("Mở lại sân" / "Đóng bảo trì")
// và khớp tiền lệ "Đang hoạt động" ở admin/users.
const COURT_STATUS_LABEL: Record<CourtStatus, string> = {
  [CourtStatus.ACTIVE]: 'Đang hoạt động',
  [CourtStatus.MAINTENANCE]: 'Đang bảo trì',
};

const COURT_STATUS_VARIANT: Record<CourtStatus, StatusBadgeVariant> = {
  [CourtStatus.ACTIVE]: 'success',
  [CourtStatus.MAINTENANCE]: 'warning',
};

export default async function CourtsPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { venueId } = await params;
  const sp = await searchParams;
  const page = Number(sp.page) || 1;
  const q = typeof sp.q === 'string' ? sp.q : undefined;

  const session = await requireSession();
  const { venues, courts } = createAuthenticatedApiClient(session.accessToken);

  let venueName: string;
  let courtsPage;
  try {
    const [venueRes, courtsRes] = await Promise.all([
      venues.venueControllerFindOne(venueId),
      courts.courtControllerFindAll({ venueId, page, q }),
    ]);
    venueName = venueRes.data.name;
    courtsPage = courtsRes.data;
  } catch (err) {
    handleApiError(err);
  }

  const courtList = courtsPage.data ?? [];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/merchant" className="hover:underline">
            Merchant
          </Link>{' '}
          / {venueName}
        </p>
        <h1 className="text-xl font-semibold">Sân con của {venueName}</h1>
        <div className="mt-1 flex gap-3">
          <Link
            href={`/merchant/venues/${venueId}/services`}
            className="text-sm text-primary hover:underline"
          >
            Dịch vụ đi kèm
          </Link>
          <Link
            href={`/merchant/venues/${venueId}/images`}
            className="text-sm text-primary hover:underline"
          >
            Ảnh cụm sân
          </Link>
        </div>
      </div>

      <SearchInput placeholder="Tìm theo tên sân hoặc bộ môn" />

      <div className="flex flex-col gap-4">
        {courtList.length === 0 && (
          <p className="text-sm text-muted-foreground">Không có sân con nào phù hợp.</p>
        )}
        {courtList.map((court) => (
          <Card key={court.id}>
            <CardContent className="flex flex-col gap-3 text-sm">
              <CourtForm venueId={venueId} court={court} />
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={`/merchant/venues/${venueId}/courts/${court.id}/price-rules`}
                  className="text-primary hover:underline"
                >
                  Giá theo khung giờ
                </Link>
                <Link
                  href={`/merchant/venues/${venueId}/courts/${court.id}/blocks`}
                  className="text-primary hover:underline"
                >
                  Chặn giờ
                </Link>
                <StatusBadge variant={COURT_STATUS_VARIANT[court.status]}>
                  {COURT_STATUS_LABEL[court.status]}
                </StatusBadge>
                <form
                  action={toggleCourtStatus.bind(
                    null,
                    venueId,
                    court.id,
                    court.status === 'MAINTENANCE' ? 'ACTIVE' : 'MAINTENANCE',
                  )}
                >
                  <Button type="submit" variant="outline">
                    {court.status === 'MAINTENANCE' ? 'Mở lại sân' : 'Đóng bảo trì'}
                  </Button>
                </form>
                <form action={deleteCourt.bind(null, venueId, court.id)}>
                  <Button type="submit" variant="destructive">
                    Xoá
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Pagination page={courtsPage.meta.page} totalPages={courtsPage.meta.totalPages} />

      <div className="rounded-lg border border-dashed border-border p-4">
        <h2 className="mb-3 text-sm font-medium">Thêm sân con mới</h2>
        <CourtForm venueId={venueId} />
      </div>
    </div>
  );
}
