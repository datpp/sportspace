import Link from 'next/link';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
        <p className="text-sm text-muted-foreground">
          <Link href={`/merchant/venues/${venueId}/courts`} className="hover:underline">
            Sân con
          </Link>{' '}
          / {courtName}
        </p>
        <h1 className="text-xl font-semibold">Chặn giờ — {courtName}</h1>
      </div>

      <div className="flex flex-col gap-3">
        {blocks.length === 0 && (
          <p className="text-sm text-muted-foreground">Chưa có khoảng giờ nào bị chặn.</p>
        )}
        {blocks.map((block) => (
          <Card key={block.id}>
            <CardContent className="flex items-center justify-between text-sm">
              <span>
                {block.blockDate} {formatTime(block.startTime)}–{formatTime(block.endTime)}:{' '}
                {block.reason}
              </span>
              <form action={removeBlock.bind(null, venueId, courtId, block.id)}>
                <Button type="submit" variant="destructive">
                  Xoá
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 text-sm">
          <h2 className="font-medium">Chặn khoảng giờ mới</h2>
          <BlockForm venueId={venueId} courtId={courtId} />
        </CardContent>
      </Card>
    </div>
  );
}
