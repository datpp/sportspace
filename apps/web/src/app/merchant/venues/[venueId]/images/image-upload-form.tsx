'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
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
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? 'Đang tải lên...' : 'Tải ảnh lên'}
      </Button>
    </form>
  );
}
