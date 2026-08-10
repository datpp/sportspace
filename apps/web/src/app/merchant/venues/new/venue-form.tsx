'use client';

import { useActionState } from 'react';
import { createVenue, type CreateVenueActionState } from './actions';

const initialState: CreateVenueActionState = {};

export function VenueForm() {
  const [state, formAction, pending] = useActionState(createVenue, initialState);

  return (
    <form action={formAction} className="flex w-full max-w-md flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium">
          Tên cụm sân
        </label>
        <input
          id="name"
          name="name"
          required
          className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="address" className="text-sm font-medium">
          Địa chỉ
        </label>
        <input
          id="address"
          name="address"
          required
          className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="lat" className="text-sm font-medium">
            Vĩ độ (lat)
          </label>
          <input
            id="lat"
            name="lat"
            type="number"
            step="any"
            required
            className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="lng" className="text-sm font-medium">
            Kinh độ (lng)
          </label>
          <input
            id="lng"
            name="lng"
            type="number"
            step="any"
            required
            className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="description" className="text-sm font-medium">
          Mô tả (không bắt buộc)
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
      >
        {pending ? 'Đang tạo...' : 'Tạo cụm sân'}
      </button>
    </form>
  );
}
