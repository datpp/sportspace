'use client';

import { Button } from '@/components/ui/button';

export function PageLoading({ message }: { message: string }) {
  return <p className="text-sm text-muted-foreground">{message}</p>;
}

export function PageError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-3">
      <p role="alert" className="text-sm text-destructive">
        {message}
      </p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        Thử lại
      </Button>
    </div>
  );
}
