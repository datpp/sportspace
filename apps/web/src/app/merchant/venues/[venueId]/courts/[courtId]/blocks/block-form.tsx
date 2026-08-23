'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { addBlock, type BlockActionState } from './actions';

const initialState: BlockActionState = {};

export function BlockForm({ venueId, courtId }: { venueId: string; courtId: string }) {
  const action = addBlock.bind(null, venueId, courtId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="blockDate">Ngày</Label>
        <Input id="blockDate" name="blockDate" type="date" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="startTime">Giờ bắt đầu</Label>
        <Input id="startTime" name="startTime" type="time" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="endTime">Giờ kết thúc</Label>
        <Input id="endTime" name="endTime" type="time" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reason">Lý do</Label>
        <Input id="reason" name="reason" required />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? 'Đang chặn...' : 'Chặn khoảng giờ'}
      </Button>
      {state?.error && (
        <p role="alert" className="w-full text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
