import Link from 'next/link';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { SearchInput } from '@/components/list/search-input';
import { FilterSelect } from '@/components/list/filter-select';
import { Pagination } from '@/components/list/pagination';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
import { StaffForm } from './staff-form';
import { deactivateStaff } from './actions';

export default async function StaffPage({
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
  const isActive = typeof sp.isActive === 'string' ? sp.isActive : undefined;

  const session = await requireSession();
  const { staff: staffApi } = createAuthenticatedApiClient(session.accessToken);

  let staffPage;
  try {
    const res = await staffApi.staffControllerFindAll({ venueId, page, q, isActive });
    staffPage = res.data;
  } catch (err) {
    handleApiError(err);
  }

  const staffList = staffPage.data ?? [];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Nhân viên</h1>
      </div>

      <div className="flex flex-wrap gap-3">
        <SearchInput placeholder="Tìm theo tên hoặc số điện thoại" />
        <FilterSelect
          paramKey="isActive"
          label="Trạng thái"
          options={[
            { value: '', label: 'Tất cả' },
            { value: 'true', label: 'Đang làm việc' },
            { value: 'false', label: 'Đã vô hiệu hoá' },
          ]}
        />
      </div>

      <div className="flex flex-col gap-3">
        {staffList.length === 0 && (
          <p className="text-sm text-muted-foreground">Không có nhân viên nào phù hợp.</p>
        )}
        {staffList.map((member) => (
          <Card key={member.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <Link
                href={`/merchant/venues/${venueId}/staff/${member.id}/shifts`}
                className="text-primary hover:underline"
              >
                {member.fullName} — {member.position} ({member.phone})
              </Link>
              {!member.isActive && <StatusBadge variant="neutral">Đã vô hiệu hoá</StatusBadge>}
              {member.isActive && (
                <form action={deactivateStaff.bind(null, venueId, member.id)}>
                  <Button type="submit" variant="destructive">
                    Vô hiệu hoá
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Pagination page={staffPage.meta.page} totalPages={staffPage.meta.totalPages} />

      <div className="rounded-lg border border-dashed border-border p-4">
        <h2 className="mb-3 text-sm font-medium">Thêm nhân viên mới</h2>
        <StaffForm venueId={venueId} />
      </div>
    </div>
  );
}
