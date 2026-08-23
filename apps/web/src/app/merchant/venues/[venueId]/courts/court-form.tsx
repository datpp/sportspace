'use client';

import { useActionState } from 'react';
import type { Court } from '@sportspace/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createCourt, updateCourt, type CourtActionState } from './actions';

const initialState: CourtActionState = {};

export function CourtForm({ venueId, court }: { venueId: string; court?: Court }) {
  const action =
    court !== undefined
      ? updateCourt.bind(null, venueId, court.id)
      : createCourt.bind(null, venueId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`name-${court?.id ?? 'new'}`}>Tên sân</Label>
        <Input
          id={`name-${court?.id ?? 'new'}`}
          name="name"
          required
          defaultValue={court?.name}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`sport-${court?.id ?? 'new'}`}>Bộ môn</Label>
        <Input
          id={`sport-${court?.id ?? 'new'}`}
          name="sport"
          required
          defaultValue={court?.sport}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`basePrice-${court?.id ?? 'new'}`}>Giá cơ bản (đ)</Label>
        <Input
          id={`basePrice-${court?.id ?? 'new'}`}
          name="basePrice"
          type="number"
          min="0"
          step="1000"
          required
          defaultValue={court?.basePrice}
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? 'Đang lưu...' : court !== undefined ? 'Lưu' : 'Thêm sân'}
      </Button>
      {state?.error && (
        <p role="alert" className="w-full text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
