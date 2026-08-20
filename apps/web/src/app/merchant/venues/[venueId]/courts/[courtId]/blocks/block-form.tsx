'use client';

import { useActionState } from 'react';
import { addBlock, type BlockActionState } from './actions';

const initialState: BlockActionState = {};

export function BlockForm({ venueId, courtId }: { venueId: string; courtId: string }) {
  const action = addBlock.bind(null, venueId, courtId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="blockDate" className="text-xs font-medium">
          Ngày
        </label>
        <input
          id="blockDate"
          name="blockDate"
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
      <div className="flex flex-col gap-1">
        <label htmlFor="reason" className="text-xs font-medium">
          Lý do
        </label>
        <input
          id="reason"
          name="reason"
          required
          className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
      >
        {pending ? 'Đang chặn...' : 'Chặn khoảng giờ'}
      </button>
      {state?.error && (
        <p role="alert" className="w-full text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
