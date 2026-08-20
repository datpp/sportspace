import Link from 'next/link';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { BlockForm } from './block-form';
import { removeBlock } from './actions';

function formatTime(time: string): string {
  return time.slice(0, 5);
}

export default async function BlocksPage({
  params,
}: {
  params: Promise<{ venueId: string; courtId: string }>;
}) {
  const { venueId, courtId } = await params;
  const session = await requireSession();
  const { courts } = createAuthenticatedApiClient(session.accessToken);

  let courtName: string;
  let blocks;
  try {
    const [courtRes, blocksRes] = await Promise.all([
      courts.courtControllerFindOne(courtId),
      courts.courtControllerListBlocks(courtId),
    ]);
    courtName = courtRes.data.name;
    blocks = blocksRes.data;
  } catch (err) {
    handleApiError(err);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-sm text-zinc-500">
          <Link href={`/merchant/venues/${venueId}/courts`} className="hover:underline">
            Sân con
          </Link>{' '}
          / {courtName}
        </p>
        <h1 className="text-xl font-semibold">Chặn giờ — {courtName}</h1>
      </div>

      <div className="flex flex-col gap-2">
        {blocks.length === 0 && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Chưa có khoảng giờ nào bị chặn.</p>
        )}
        {blocks.map((block) => (
          <div
            key={block.id}
            className="flex items-center justify-between rounded border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800"
          >
            <span>
              {block.blockDate} {formatTime(block.startTime)}–{formatTime(block.endTime)}: {block.reason}
            </span>
            <form action={removeBlock.bind(null, venueId, courtId, block.id)}>
              <button type="submit" className="text-red-600 hover:underline dark:text-red-400">
                Xoá
              </button>
            </form>
          </div>
        ))}
      </div>

      <div className="rounded border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
        <h2 className="mb-3 text-sm font-medium">Chặn khoảng giờ mới</h2>
        <BlockForm venueId={venueId} courtId={courtId} />
      </div>
    </div>
  );
}
