import Link from 'next/link';
import { VenueStatus } from '@sportspace/shared';
import type { MerchantControllerGetVenuesStatus } from '@sportspace/shared';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { SearchInput } from '@/components/list/search-input';
import { FilterSelect } from '@/components/list/filter-select';
import { Pagination } from '@/components/list/pagination';

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
        <Link
          href="/merchant/venues/new"
          className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
        >
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
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Không có cụm sân nào phù hợp. Bấm &quot;Tạo cụm sân mới&quot; để bắt đầu.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {venueList.map((venue) => (
          <Link
            key={venue.id}
            href={`/merchant/venues/${venue.id}/courts`}
            className="flex flex-col gap-1 rounded border border-zinc-200 p-4 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            <span className="font-medium">{venue.name}</span>
            <span className="text-zinc-500">{venue.address}</span>
            <span className="text-xs uppercase text-zinc-400">{venue.status}</span>
          </Link>
        ))}
      </div>

      <Pagination page={venuesPage.meta.page} totalPages={venuesPage.meta.totalPages} />
    </div>
  );
}
