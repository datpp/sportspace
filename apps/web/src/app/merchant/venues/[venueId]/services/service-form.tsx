'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { addService, type ServiceActionState } from './actions';

const initialState: ServiceActionState = {};

export function ServiceForm({ venueId }: { venueId: string }) {
  const action = addService.bind(null, venueId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Tên dịch vụ</Label>
        <Input id="name" name="name" type="text" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="price">Giá</Label>
        <Input id="price" name="price" type="number" min={0} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Mô tả</Label>
        <Input id="description" name="description" type="text" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? 'Đang thêm...' : 'Thêm dịch vụ'}
      </Button>
      {state?.error && (
        <p role="alert" className="w-full text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
