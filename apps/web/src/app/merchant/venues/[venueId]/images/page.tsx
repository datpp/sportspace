import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { assetUrl } from '@/lib/asset-url';
import { Button } from '@/components/ui/button';
import { ImageUploadForm } from './image-upload-form';
import { deleteImage } from './actions';

export default async function VenueImagesPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  const session = await requireSession();
  const { venues } = createAuthenticatedApiClient(session.accessToken);

  let venue;
  try {
    const res = await venues.venueControllerFindOne(venueId);
    venue = res.data;
  } catch (err) {
    handleApiError(err);
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">Ảnh cụm sân — {venue.name}</h1>

      {venue.images.length === 0 && (
        <p className="text-sm text-muted-foreground">Chưa có ảnh nào.</p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {venue.images.map((img) => (
          <div key={img} className="flex flex-col gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={assetUrl(img)}
              alt=""
              className="aspect-square w-full rounded object-cover"
            />
            <form action={deleteImage.bind(null, venueId, img)}>
              <Button type="submit" variant="destructive">
                Xoá
              </Button>
            </form>
          </div>
        ))}
      </div>

      {venue.images.length < 8 && (
        <div className="rounded-lg border border-dashed border-border p-4">
          <h2 className="mb-3 text-sm font-medium">Thêm ảnh mới ({venue.images.length}/8)</h2>
          <ImageUploadForm venueId={venueId} />
        </div>
      )}
    </div>
  );
}
