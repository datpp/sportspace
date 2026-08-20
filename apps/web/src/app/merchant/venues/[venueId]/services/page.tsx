import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { ServiceForm } from './service-form';
import { deactivateService } from './actions';

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  const session = await requireSession();
  const { addonServices } = createAuthenticatedApiClient(session.accessToken);

  let serviceList;
  try {
    const res = await addonServices.addonServicesControllerFindAll({ venueId });
    serviceList = res.data;
  } catch (err) {
    handleApiError(err);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Dịch vụ đi kèm</h1>
      </div>

      <div className="flex flex-col gap-2">
        {serviceList.length === 0 && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Chưa có dịch vụ nào.</p>
        )}
        {serviceList.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between rounded border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800"
          >
            <span>
              {s.name} — {s.price.toLocaleString('vi-VN')} đ
              {!s.isActive && ' — đã vô hiệu hoá'}
            </span>
            {s.isActive && (
              <form action={deactivateService.bind(null, venueId, s.id)}>
                <button type="submit" className="text-red-600 hover:underline dark:text-red-400">
                  Vô hiệu hoá
                </button>
              </form>
            )}
          </div>
        ))}
      </div>

      <div className="rounded border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
        <h2 className="mb-3 text-sm font-medium">Thêm dịch vụ mới</h2>
        <ServiceForm venueId={venueId} />
      </div>
    </div>
  );
}
