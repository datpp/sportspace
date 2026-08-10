'use client';

import { useActionState } from 'react';
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
      <div className="flex flex-col gap-1">
        <label htmlFor="dayOfWeek" className="text-xs font-medium">
          Ngày trong tuần
        </label>
        <select
          id="dayOfWeek"
          name="dayOfWeek"
          required
          className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          {DAY_LABELS.map((label, value) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="startTime" className="text-xs font-medium">
          Giờ bắt đầu
        </label>
        <input
          id="startTime"
          name="startTime"
          type="time"
          required
          className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="endTime" className="text-xs font-medium">
          Giờ kết thúc
        </label>
        <input
          id="endTime"
          name="endTime"
          type="time"
          required
          className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="price" className="text-xs font-medium">
          Giá (đ)
        </label>
        <input
          id="price"
          name="price"
          type="number"
          min="0"
          step="1000"
          required
          className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
      >
        {pending ? 'Đang thêm...' : 'Thêm giá'}
      </button>
      {state?.error && (
        <p role="alert" className="w-full text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
