'use client';

import { useActionState } from 'react';
import { addShift, type ShiftActionState } from './actions';

const initialState: ShiftActionState = {};

export function ShiftForm({ venueId, staffId }: { venueId: string; staffId: string }) {
  const action = addShift.bind(null, venueId, staffId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="shiftDate" className="text-xs font-medium">
          Ngày
        </label>
        <input
          id="shiftDate"
          name="shiftDate"
          type="date"
          required
          className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
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
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
      >
        {pending ? 'Đang thêm...' : 'Thêm ca làm'}
      </button>
      {state?.error && (
        <p role="alert" className="w-full text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
