import Link from 'next/link';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { ShiftForm } from './shift-form';
import { removeShift } from './actions';

function formatTime(time: string): string {
  return time.slice(0, 5);
}

export default async function ShiftsPage({
  params,
}: {
  params: Promise<{ venueId: string; staffId: string }>;
}) {
  const { venueId, staffId } = await params;
  const session = await requireSession();
  const { staff } = createAuthenticatedApiClient(session.accessToken);

  let staffName: string;
  let shifts;
  try {
    const [staffRes, shiftsRes] = await Promise.all([
      staff.staffControllerFindOne(staffId),
      staff.staffControllerListShifts(staffId, {}),
    ]);
    staffName = staffRes.data.fullName;
    shifts = shiftsRes.data;
  } catch (err) {
    handleApiError(err);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-sm text-zinc-500">
          <Link href={`/merchant/venues/${venueId}/staff`} className="hover:underline">
            Nhân viên
          </Link>{' '}
          / {staffName}
        </p>
        <h1 className="text-xl font-semibold">Ca làm — {staffName}</h1>
      </div>

      <div className="flex flex-col gap-2">
        {shifts.length === 0 && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Chưa có ca làm nào.</p>
        )}
        {shifts.map((shift) => (
          <div
            key={shift.id}
            className="flex items-center justify-between rounded border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800"
          >
            <span>
              {shift.shiftDate} {formatTime(shift.startTime)}–{formatTime(shift.endTime)}
            </span>
            <form action={removeShift.bind(null, venueId, staffId, shift.id)}>
              <button type="submit" className="text-red-600 hover:underline dark:text-red-400">
                Xoá
              </button>
            </form>
          </div>
        ))}
      </div>

      <div className="rounded border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
        <h2 className="mb-3 text-sm font-medium">Thêm ca làm mới</h2>
        <ShiftForm venueId={venueId} staffId={staffId} />
      </div>
    </div>
  );
}
