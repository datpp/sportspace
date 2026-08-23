'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { addShift, type ShiftActionState } from './actions';

const initialState: ShiftActionState = {};

export function ShiftForm({ venueId, staffId }: { venueId: string; staffId: string }) {
  const action = addShift.bind(null, venueId, staffId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="shiftDate">Ngày</Label>
        <Input id="shiftDate" name="shiftDate" type="date" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="startTime">Giờ bắt đầu</Label>
        <Input id="startTime" name="startTime" type="time" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="endTime">Giờ kết thúc</Label>
        <Input id="endTime" name="endTime" type="time" required />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? 'Đang thêm...' : 'Thêm ca làm'}
      </Button>
      {state?.error && (
        <p role="alert" className="w-full text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
