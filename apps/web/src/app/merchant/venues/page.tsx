import Link from 'next/link';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';

export default async function VenuesPage() {
  const session = await requireSession();
  const { merchant } = createAuthenticatedApiClient(session.accessToken);

  let venueList;
  try {
    venueList = (await merchant.merchantControllerGetVenues()).data;
  } catch (err) {
    handleApiError(err);
  }

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

      {venueList.length === 0 && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Bạn chưa có cụm sân nào. Bấm &quot;Tạo cụm sân mới&quot; để bắt đầu.
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
    </div>
  );
}
