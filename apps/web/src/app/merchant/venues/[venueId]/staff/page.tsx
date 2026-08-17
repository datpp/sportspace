import Link from 'next/link';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { SearchInput } from '@/components/list/search-input';
import { FilterSelect } from '@/components/list/filter-select';
import { Pagination } from '@/components/list/pagination';
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

      <div className="flex flex-col gap-2">
        {staffList.length === 0 && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Không có nhân viên nào phù hợp.
          </p>
        )}
        {staffList.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between rounded border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800"
          >
            <Link
              href={`/merchant/venues/${venueId}/staff/${member.id}/shifts`}
              className="hover:underline"
            >
              {member.fullName} — {member.position} ({member.phone})
              {!member.isActive && ' — đã vô hiệu hoá'}
            </Link>
            {member.isActive && (
              <form action={deactivateStaff.bind(null, venueId, member.id)}>
                <button type="submit" className="text-red-600 hover:underline dark:text-red-400">
                  Vô hiệu hoá
                </button>
              </form>
            )}
          </div>
        ))}
      </div>

      <Pagination page={staffPage.meta.page} totalPages={staffPage.meta.totalPages} />

      <div className="rounded border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
        <h2 className="mb-3 text-sm font-medium">Thêm nhân viên mới</h2>
        <StaffForm venueId={venueId} />
      </div>
    </div>
  );
}
