import { AdminControllerGetVenuesStatus } from '@sportspace/shared';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { approveVenue, rejectVenue } from './actions';

export default async function AdminVenuesPage() {
  const session = await requireSession();
  const { admin } = createAuthenticatedApiClient(session.accessToken);

  let venues;
  try {
    const { data } = await admin.adminControllerGetVenues({
      status: AdminControllerGetVenuesStatus.PENDING,
    });
    venues = data;
  } catch (err) {
    handleApiError(err);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Duyệt cụm sân</h1>

      {venues.length === 0 && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Không có cụm sân nào đang chờ duyệt.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {venues.map((venue) => (
          <div
            key={venue.id}
            className="flex flex-col gap-2 rounded border border-zinc-200 p-4 text-sm dark:border-zinc-800"
          >
            <p className="font-medium">{venue.name}</p>
            <p className="text-zinc-500">{venue.address}</p>
            <p className="text-zinc-500">
              Chủ sở hữu: {venue.owner.fullName} ({venue.owner.email})
            </p>
            <p className="text-xs text-zinc-400">
              Đăng ký lúc {new Date(venue.createdAt).toLocaleString('vi-VN')}
            </p>
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
          </div>
        ))}
      </div>
    </div>
  );
}
