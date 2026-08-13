import { BookingStatus } from '@sportspace/shared';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { confirmBooking, rejectBooking } from './actions';

export default async function MerchantBookingsPage() {
  const session = await requireSession();
  const { merchant } = createAuthenticatedApiClient(session.accessToken);

  let allBookings;
  try {
    const { data } = await merchant.merchantControllerGetBookings();
    allBookings = data;
  } catch (err) {
    handleApiError(err);
  }

  const pendingOrConfirmed = allBookings.filter(
    (b) => b.status === BookingStatus.PENDING || b.status === BookingStatus.CONFIRMED,
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Đơn đặt sân</h1>

      {pendingOrConfirmed.length === 0 && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Không có đơn đặt sân nào cần xử lý.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {pendingOrConfirmed.map((booking) => (
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
              <form action={rejectBooking.bind(null, booking.id, 'Chủ sân từ chối')}>
                <button
                  type="submit"
                  className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 dark:border-red-800 dark:text-red-400"
                >
                  Từ chối
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
