import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { SystemConfigForm } from './system-config-form';
import { updateSystemConfig } from './actions';

export default async function AdminConfigPage() {
  const session = await requireSession();
  const { systemConfig } = createAuthenticatedApiClient(session.accessToken);

  let config;
  try {
    const { data } = await systemConfig.systemConfigControllerGet();
    config = data;
  } catch (err) {
    handleApiError(err);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Cấu hình hệ thống</h1>
      <SystemConfigForm config={config} action={updateSystemConfig} />
    </div>
  );
}
