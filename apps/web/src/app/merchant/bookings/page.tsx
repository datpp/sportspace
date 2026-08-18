import { BookingStatus } from '@sportspace/shared';
import type { MerchantControllerGetBookingsStatus } from '@sportspace/shared';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { SearchInput } from '@/components/list/search-input';
import { FilterSelect } from '@/components/list/filter-select';
import { Pagination } from '@/components/list/pagination';
import { confirmBooking, rejectBooking } from './actions';

export default async function MerchantBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page) || 1;
  const q = typeof sp.q === 'string' ? sp.q : undefined;
  const status = typeof sp.status === 'string' ? sp.status : undefined;
  const venueId = typeof sp.venueId === 'string' ? sp.venueId : undefined;
  const from = typeof sp.from === 'string' ? sp.from : undefined;
  const to = typeof sp.to === 'string' ? sp.to : undefined;

  const session = await requireSession();
  const { merchant } = createAuthenticatedApiClient(session.accessToken);

  let bookingsPage;
  let venueOptions: { value: string; label: string }[] = [];
  try {
    const [bookingsRes, venuesRes] = await Promise.all([
      merchant.merchantControllerGetBookings({
        page,
        q,
        venueId,
        from,
        to,
        status: status as MerchantControllerGetBookingsStatus | undefined,
      }),
      merchant.merchantControllerGetVenues({ limit: 100 }),
    ]);
    bookingsPage = bookingsRes.data;
    venueOptions = (venuesRes.data.data ?? []).map((v) => ({ value: v.id, label: v.name }));
  } catch (err) {
    handleApiError(err);
  }

  const bookingList = bookingsPage.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Đơn đặt sân</h1>

      <div className="flex flex-wrap gap-3">
        <SearchInput placeholder="Tìm theo tên khách hoặc tên sân" />
        <FilterSelect
          paramKey="status"
          label="Trạng thái"
          options={[
            { value: '', label: 'Cần xử lý' },
            { value: 'ALL', label: 'Tất cả' },
            { value: BookingStatus.CANCELLED, label: 'Đã hủy' },
          ]}
        />
        {venueOptions.length > 1 && (
          <FilterSelect
            paramKey="venueId"
            label="Cụm sân"
            options={[{ value: '', label: 'Tất cả' }, ...venueOptions]}
          />
        )}
      </div>

      {bookingList.length === 0 && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Không có đơn đặt sân nào phù hợp.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {bookingList.map((booking) => (
          <div
            key={booking.id}
            className="flex flex-col gap-2 rounded border border-zinc-200 p-4 text-sm dark:border-zinc-800"
          >
            <p className="font-medium">{booking.court.name}</p>
            <p className="text-zinc-500">
              {booking.bookingDate} · {booking.startTime}–{booking.endTime}
            </p>
            <p className="text-zinc-500">
              Người đặt: {booking.user.fullName} ({booking.user.email})
            </p>
            <p className="text-xs text-zinc-400">Trạng thái: {booking.status}</p>
            <div className="flex gap-3">
              {booking.status === BookingStatus.PENDING && (
                <form action={confirmBooking.bind(null, booking.id)}>
                  <button
                    type="submit"
                    className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
                  >
                    Xác nhận
                  </button>
                </form>
              )}
              {booking.status !== BookingStatus.CANCELLED && (
                <form
                  action={rejectBooking.bind(null, booking.id)}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    name="reason"
                    required
                    placeholder="Lý do từ chối"
                    className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  />
                  <button
                    type="submit"
                    className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 dark:border-red-800 dark:text-red-400"
                  >
                    Từ chối
                  </button>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>

      <Pagination page={bookingsPage.meta.page} totalPages={bookingsPage.meta.totalPages} />
    </div>
  );
}
