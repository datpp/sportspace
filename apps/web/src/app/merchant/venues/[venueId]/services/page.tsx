import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
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

      <div className="flex flex-col gap-3">
        {serviceList.length === 0 && (
          <p className="text-sm text-muted-foreground">Chưa có dịch vụ nào.</p>
        )}
        {serviceList.map((s) => (
          <Card key={s.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span>
                {s.name} — {s.price.toLocaleString('vi-VN')} đ
              </span>
              {!s.isActive && <StatusBadge variant="neutral">Đã vô hiệu hoá</StatusBadge>}
              {s.isActive && (
                <form action={deactivateService.bind(null, venueId, s.id)}>
                  <Button type="submit" variant="destructive">
                    Vô hiệu hoá
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="rounded-lg border border-dashed border-border p-4">
        <h2 className="mb-3 text-sm font-medium">Thêm dịch vụ mới</h2>
        <ServiceForm venueId={venueId} />
      </div>
    </div>
  );
}
