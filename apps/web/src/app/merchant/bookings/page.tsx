import { BookingStatus } from '@sportspace/shared';
import type { MerchantControllerGetBookingsStatus } from '@sportspace/shared';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { SearchInput } from '@/components/list/search-input';
import { FilterSelect } from '@/components/list/filter-select';
import { Pagination } from '@/components/list/pagination';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge, type StatusBadgeVariant } from '@/components/status-badge';
import { confirmBooking, rejectBooking } from './actions';

// Nhãn và biến thể lấy từ FilterSelect "Trạng thái" phía trên — không tự đặt chữ mới.
const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  [BookingStatus.PENDING]: 'Cần xử lý',
  [BookingStatus.CONFIRMED]: 'Đã xác nhận',
  [BookingStatus.CANCELLED]: 'Đã hủy',
};

const BOOKING_STATUS_VARIANT: Record<BookingStatus, StatusBadgeVariant> = {
  [BookingStatus.PENDING]: 'warning',
  [BookingStatus.CONFIRMED]: 'success',
  [BookingStatus.CANCELLED]: 'danger',
};

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
        <p className="text-sm text-muted-foreground">Không có đơn đặt sân nào phù hợp.</p>
      )}

      <div className="flex flex-col gap-3">
        {bookingList.map((booking) => (
          <Card key={booking.id}>
            <CardContent className="flex flex-col gap-2 text-sm">
              <p className="font-medium">{booking.court.name}</p>
              <p className="text-muted-foreground">
                {booking.bookingDate} · {booking.startTime}–{booking.endTime}
              </p>
              <p className="text-muted-foreground">
                Người đặt: {booking.user.fullName} ({booking.user.email})
              </p>
              <StatusBadge variant={BOOKING_STATUS_VARIANT[booking.status]}>
                {BOOKING_STATUS_LABEL[booking.status]}
              </StatusBadge>
              <div className="flex gap-3">
                {booking.status === BookingStatus.PENDING && (
                  <form action={confirmBooking.bind(null, booking.id)}>
                    <Button type="submit" size="sm">
                      Xác nhận
                    </Button>
                  </form>
                )}
                {booking.status !== BookingStatus.CANCELLED && (
                  <form
                    action={rejectBooking.bind(null, booking.id)}
                    className="flex items-center gap-2"
                  >
                    <Input type="text" name="reason" required placeholder="Lý do từ chối" />
                    <Button type="submit" variant="destructive" size="sm">
                      Từ chối
                    </Button>
                  </form>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Pagination page={bookingsPage.meta.page} totalPages={bookingsPage.meta.totalPages} />
    </div>
  );
}
