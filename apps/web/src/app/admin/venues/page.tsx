import { VenueStatus } from '@sportspace/shared';
import type { AdminControllerGetVenuesStatus } from '@sportspace/shared';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { SearchInput } from '@/components/list/search-input';
import { FilterSelect } from '@/components/list/filter-select';
import { Pagination } from '@/components/list/pagination';
import { approveVenue, rejectVenue } from './actions';

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
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Không có cụm sân nào phù hợp.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {venueList.map((venue) => (
          <div
            key={venue.id}
            className="flex flex-col gap-2 rounded border border-zinc-200 p-4 text-sm dark:border-zinc-800"
          >
            <p className="font-medium">{venue.name}</p>
            <p className="text-zinc-500">
              {venue.address}
              {venue.province ? ` — ${venue.province}` : ''}
            </p>
            <p className="text-zinc-500">
              Chủ sở hữu: {venue.owner.fullName} ({venue.owner.email})
            </p>
            <p className="text-xs text-zinc-400">
              Đăng ký lúc {new Date(venue.createdAt).toLocaleString('vi-VN')} — {venue.status}
            </p>
            {venue.status === VenueStatus.PENDING && (
              <div className="flex gap-3">
                <form action={approveVenue.bind(null, venue.id)}>
                  <button
                    type="submit"
                    className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
                  >
                    Duyệt
                  </button>
                </form>
                <form action={rejectVenue.bind(null, venue.id)}>
                  <button
                    type="submit"
                    className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 dark:border-red-800 dark:text-red-400"
                  >
                    Từ chối
                  </button>
                </form>
              </div>
            )}
          </div>
        ))}
      </div>

      <Pagination page={venuesPage.meta.page} totalPages={venuesPage.meta.totalPages} />
    </div>
  );
}
