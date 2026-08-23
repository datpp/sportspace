import { redirect } from 'next/navigation';
import { AuthResponseDtoRole } from '@sportspace/shared';
import { getSession } from '@/lib/session';
import { LogoutButton } from '@/components/logout-button';
import { DashboardSidebar } from '@/components/dashboard-sidebar';

const NAV_ITEMS = [
  { href: '/admin', label: 'Tổng quan' },
  { href: '/admin/venues', label: 'Duyệt sân' },
  { href: '/admin/users', label: 'Người dùng' },
  { href: '/admin/disputes', label: 'Khiếu nại' },
  { href: '/admin/config', label: 'Cấu hình hệ thống' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== AuthResponseDtoRole.ADMIN) {
    redirect('/login');
  }

  return (
    <div className="flex min-h-full flex-1 flex-col sm:flex-row">
      <DashboardSidebar label="Admin" navItems={NAV_ITEMS} />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-border bg-card p-4">
          <LogoutButton />
        </header>
        <main className="flex-1 bg-background p-6">{children}</main>
      </div>
    </div>
  );
}
