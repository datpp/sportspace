import Link from 'next/link';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
        <p className="text-sm text-muted-foreground">
          <Link href={`/merchant/venues/${venueId}/staff`} className="hover:underline">
            Nhân viên
          </Link>{' '}
          / {staffName}
        </p>
        <h1 className="text-xl font-semibold">Ca làm — {staffName}</h1>
      </div>

      <div className="flex flex-col gap-3">
        {shifts.length === 0 && (
          <p className="text-sm text-muted-foreground">Chưa có ca làm nào.</p>
        )}
        {shifts.map((shift) => (
          <Card key={shift.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span>
                {shift.shiftDate} {formatTime(shift.startTime)}–{formatTime(shift.endTime)}
              </span>
              <form action={removeShift.bind(null, venueId, staffId, shift.id)}>
                <Button type="submit" variant="destructive">
                  Xoá
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="rounded-lg border border-dashed border-border p-4">
        <h2 className="mb-3 text-sm font-medium">Thêm ca làm mới</h2>
        <ShiftForm venueId={venueId} staffId={staffId} />
      </div>
    </div>
  );
}
