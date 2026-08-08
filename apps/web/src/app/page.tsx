import { redirect } from 'next/navigation';
import { AuthResponseDtoRole } from '@sportspace/shared';
import { getSession } from '@/lib/session';

export default async function RootPage() {
  const session = await getSession();
  if (session?.role === AuthResponseDtoRole.ADMIN) {
    redirect('/admin');
  }
  if (session?.role === AuthResponseDtoRole.MERCHANT) {
    redirect('/merchant');
  }
  redirect('/login');
}
