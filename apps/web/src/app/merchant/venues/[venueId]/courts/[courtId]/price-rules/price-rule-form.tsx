'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { addPriceRule, type PriceRuleActionState } from './actions';

const DAY_LABELS = [
  'Chủ nhật',
  'Thứ 2',
  'Thứ 3',
  'Thứ 4',
  'Thứ 5',
  'Thứ 6',
  'Thứ 7',
];

const initialState: PriceRuleActionState = {};

export function PriceRuleForm({ venueId, courtId }: { venueId: string; courtId: string }) {
  const action = addPriceRule.bind(null, venueId, courtId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dayOfWeek">Ngày trong tuần</Label>
        <select
          id="dayOfWeek"
          name="dayOfWeek"
          required
          className="h-8 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
        >
          {DAY_LABELS.map((label, value) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
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
        <Label htmlFor="price">Giá (đ)</Label>
        <Input id="price" name="price" type="number" min="0" step="1000" required />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? 'Đang thêm...' : 'Thêm giá'}
      </Button>
      {state?.error && (
        <p role="alert" className="w-full text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
