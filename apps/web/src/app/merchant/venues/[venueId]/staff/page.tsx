import Link from 'next/link';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { StaffForm } from './staff-form';
import { deactivateStaff } from './actions';

export default async function StaffPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  const session = await requireSession();
  const { staff: staffApi } = createAuthenticatedApiClient(session.accessToken);

  let staffList;
  try {
    const res = await staffApi.staffControllerFindAll({ venueId });
    staffList = res.data;
  } catch (err) {
    handleApiError(err);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Nhân viên</h1>
      </div>

      <div className="flex flex-col gap-2">
        {staffList.length === 0 && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Chưa có nhân viên nào.</p>
        )}
        {staffList.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between rounded border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800"
          >
            <Link
              href={`/merchant/venues/${venueId}/staff/${member.id}/shifts`}
              className="hover:underline"
            >
              {member.fullName} — {member.position} ({member.phone})
              {!member.isActive && ' — đã vô hiệu hoá'}
            </Link>
            {member.isActive && (
              <form action={deactivateStaff.bind(null, venueId, member.id)}>
                <button type="submit" className="text-red-600 hover:underline dark:text-red-400">
                  Vô hiệu hoá
                </button>
              </form>
            )}
          </div>
        ))}
      </div>

      <div className="rounded border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
        <h2 className="mb-3 text-sm font-medium">Thêm nhân viên mới</h2>
        <StaffForm venueId={venueId} />
      </div>
    </div>
  );
}
