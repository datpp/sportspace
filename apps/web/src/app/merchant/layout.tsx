import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthResponseDtoRole } from '@sportspace/shared';
import { getSession } from '@/lib/session';
import { LogoutButton } from '@/components/logout-button';

const NAV_ITEMS = [
  { href: '/merchant', label: 'Tổng quan' },
  { href: '/merchant/venues', label: 'Cụm sân' },
  { href: '/merchant/revenue', label: 'Doanh thu' },
  { href: '/merchant/staff', label: 'Nhân viên' },
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
    <div className="flex min-h-full flex-1">
      <aside className="flex w-56 flex-col gap-1 border-r border-zinc-200 p-4 dark:border-zinc-800">
        <p className="mb-2 px-2 text-xs font-semibold uppercase text-zinc-500">Merchant</p>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded px-2 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            {item.label}
          </Link>
        ))}
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-zinc-200 p-4 dark:border-zinc-800">
          <LogoutButton />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
