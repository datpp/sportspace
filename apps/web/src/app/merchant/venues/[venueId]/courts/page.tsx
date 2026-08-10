import Link from 'next/link';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { CourtForm } from './court-form';
import { deleteCourt } from './actions';

export default async function CourtsPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  const session = await requireSession();
  const { venues, courts } = createAuthenticatedApiClient(session.accessToken);

  let venueName: string;
  let courtList;
  try {
    const [venueRes, courtsRes] = await Promise.all([
      venues.venueControllerFindOne(venueId),
      courts.courtControllerFindAll({ venueId }),
    ]);
    venueName = venueRes.data.name;
    courtList = courtsRes.data;
  } catch (err) {
    handleApiError(err);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-sm text-zinc-500">
          <Link href="/merchant" className="hover:underline">
            Merchant
          </Link>{' '}
          / {venueName}
        </p>
        <h1 className="text-xl font-semibold">Sân con của {venueName}</h1>
      </div>

      <div className="flex flex-col gap-4">
        {courtList.length === 0 && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Chưa có sân con nào.</p>
        )}
        {courtList.map((court) => (
          <div
            key={court.id}
            className="flex flex-col gap-2 rounded border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <CourtForm venueId={venueId} court={court} />
            <div className="flex items-center gap-3 text-sm text-zinc-500">
              <Link href={`/merchant/venues/${venueId}/courts/${court.id}/price-rules`} className="hover:underline">
                Giá theo khung giờ
              </Link>
              <form action={deleteCourt.bind(null, venueId, court.id)}>
                <button type="submit" className="text-red-600 hover:underline dark:text-red-400">
                  Xoá
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
        <h2 className="mb-3 text-sm font-medium">Thêm sân con mới</h2>
        <CourtForm venueId={venueId} />
      </div>
    </div>
  );
}
