import { isAxiosError } from 'axios';
import { notFound, redirect } from 'next/navigation';

export function handleApiError(err: unknown): never {
  if (isAxiosError(err)) {
    if (err.response?.status === 401) {
      redirect('/login');
    }
    if (err.response?.status === 404) {
      notFound();
    }
  }
  throw err;
}
