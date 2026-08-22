'use client';

import { useActionState } from 'react';
import { uploadImage, type ImageActionState } from './actions';

const initialState: ImageActionState = {};

export function ImageUploadForm({ venueId }: { venueId: string }) {
  const boundAction = uploadImage.bind(null, venueId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input
        type="file"
        name="file"
        accept="image/jpeg,image/png,image/webp"
        required
        className="text-sm"
      />
      {state?.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
      >
        {pending ? 'Đang tải lên...' : 'Tải ảnh lên'}
      </button>
    </form>
  );
}
