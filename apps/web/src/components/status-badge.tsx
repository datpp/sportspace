import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const VARIANT_CLASSES = {
  success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  danger: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
  neutral: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  info: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
} as const;

export type StatusBadgeVariant = keyof typeof VARIANT_CLASSES;

export function StatusBadge({
  variant,
  children,
}: {
  variant: StatusBadgeVariant;
  children: React.ReactNode;
}) {
  return (
    <Badge className={cn('font-semibold', VARIANT_CLASSES[variant])} variant="outline">
      {children}
    </Badge>
  );
}
