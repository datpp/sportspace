import Link from 'next/link';

export interface DashboardNavItem {
  href: string;
  label: string;
}

export function DashboardSidebar({
  label,
  navItems,
}: {
  label: string;
  navItems: DashboardNavItem[];
}) {
  return (
    <aside className="flex flex-col gap-1 bg-sidebar p-4 sm:w-56 sm:border-r sm:border-sidebar-active-bg">
      <p className="mb-3 px-2 text-xs font-bold uppercase tracking-wide text-sidebar-muted">
        {label}
      </p>
      <div className="flex flex-row gap-1 overflow-x-auto sm:flex-col sm:overflow-visible">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="shrink-0 rounded-md border-l-2 border-transparent px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-active-bg hover:text-sidebar-foreground"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </aside>
  );
}
