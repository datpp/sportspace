'use client';

import { logout } from '@/app/logout/actions';
import { Button } from '@/components/ui/button';

export function LogoutButton() {
  return (
    <form action={logout}>
      <Button type="submit" variant="outline" size="sm">
        Đăng xuất
      </Button>
    </form>
  );
}
