import { redirect } from 'next/navigation';
import { AuthResponseDtoRole } from '@sportspace/shared';
import { getSession } from '@/lib/session';
import { LogoutButton } from '@/components/logout-button';
import { DashboardSidebar } from '@/components/dashboard-sidebar';

const NAV_ITEMS = [
  { href: '/merchant', label: 'Tổng quan' },
  { href: '/merchant/venues', label: 'Cụm sân' },
  { href: '/merchant/venues/new', label: 'Tạo cụm sân mới' },
  { href: '/merchant/bookings', label: 'Đơn đặt sân' },
  { href: '/merchant/revenue', label: 'Doanh thu' },
];

export default async function MerchantLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (
    !session ||
    (session.role !== AuthResponseDtoRole.MERCHANT && session.role !== AuthResponseDtoRole.ADMIN)
  ) {
    redirect('/login');
  }

  return (
    <div className="flex min-h-full flex-1 flex-col sm:flex-row">
      <DashboardSidebar label="Merchant" navItems={NAV_ITEMS} />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-border bg-card p-4">
          <LogoutButton />
        </header>
        <main className="flex-1 bg-background p-6">{children}</main>
      </div>
    </div>
  );
}
