'use client';

import { useActionState } from 'react';
import { addStaff, type StaffActionState } from './actions';

const initialState: StaffActionState = {};

export function StaffForm({ venueId }: { venueId: string }) {
  const action = addStaff.bind(null, venueId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="fullName" className="text-xs font-medium">
          Họ tên
        </label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          required
          className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="phone" className="text-xs font-medium">
          Số điện thoại
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          required
          className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="position" className="text-xs font-medium">
          Chức vụ
        </label>
        <input
          id="position"
          name="position"
          type="text"
          required
          className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
      >
        {pending ? 'Đang thêm...' : 'Thêm nhân viên'}
      </button>
      {state?.error && (
        <p role="alert" className="w-full text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
