'use client';

import { useActionState } from 'react';
import type { Court } from '@sportspace/shared';
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
      <div className="flex flex-col gap-1">
        <label htmlFor={`name-${court?.id ?? 'new'}`} className="text-xs font-medium">
          Tên sân
        </label>
        <input
          id={`name-${court?.id ?? 'new'}`}
          name="name"
          required
          defaultValue={court?.name}
          className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`sport-${court?.id ?? 'new'}`} className="text-xs font-medium">
          Bộ môn
        </label>
        <input
          id={`sport-${court?.id ?? 'new'}`}
          name="sport"
          required
          defaultValue={court?.sport}
          className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`basePrice-${court?.id ?? 'new'}`} className="text-xs font-medium">
          Giá cơ bản (đ)
        </label>
        <input
          id={`basePrice-${court?.id ?? 'new'}`}
          name="basePrice"
          type="number"
          min="0"
          step="1000"
          required
          defaultValue={court?.basePrice}
          className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
      >
        {pending ? 'Đang lưu...' : court !== undefined ? 'Lưu' : 'Thêm sân'}
      </button>
      {state?.error && (
        <p role="alert" className="w-full text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
