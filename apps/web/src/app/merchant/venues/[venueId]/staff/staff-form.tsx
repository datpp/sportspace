'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { addStaff, type StaffActionState } from './actions';

const initialState: StaffActionState = {};

export function StaffForm({ venueId }: { venueId: string }) {
  const action = addStaff.bind(null, venueId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fullName">Họ tên</Label>
        <Input id="fullName" name="fullName" type="text" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="phone">Số điện thoại</Label>
        <Input id="phone" name="phone" type="tel" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="position">Chức vụ</Label>
        <Input id="position" name="position" type="text" required />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? 'Đang thêm...' : 'Thêm nhân viên'}
      </Button>
      {state?.error && (
        <p role="alert" className="w-full text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
