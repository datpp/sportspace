'use client';

import { useActionState } from 'react';
import { VIETNAM_PROVINCES } from '@sportspace/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createVenue, type CreateVenueActionState } from './actions';

const initialState: CreateVenueActionState = {};

export function VenueForm() {
  const [state, formAction, pending] = useActionState(createVenue, initialState);

  return (
    <form action={formAction} className="flex w-full max-w-md flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Tên cụm sân</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="address">Địa chỉ</Label>
        <Input id="address" name="address" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="province">Tỉnh/Thành phố</Label>
        <select
          id="province"
          name="province"
          required
          defaultValue=""
          className="h-8 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
        >
          <option value="" disabled>
            Chọn tỉnh/thành
          </option>
          {VIETNAM_PROVINCES.map((province) => (
            <option key={province} value={province}>
              {province}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lat">Vĩ độ (lat)</Label>
          <Input id="lat" name="lat" type="number" step="any" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lng">Kinh độ (lng)</Label>
          <Input id="lng" name="lng" type="number" step="any" required />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Mô tả (không bắt buộc)</Label>
        <textarea
          id="description"
          name="description"
          rows={3}
          className="rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        />
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? 'Đang tạo...' : 'Tạo cụm sân'}
      </Button>
    </form>
  );
}
