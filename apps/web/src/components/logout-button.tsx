'use client';

import { logout } from '@/app/logout/actions';

export function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
      >
        Đăng xuất
      </button>
    </form>
  );
}
