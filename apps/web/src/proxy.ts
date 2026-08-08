import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AuthResponseDtoRole } from '@sportspace/shared';
import { SESSION_COOKIE_NAME, parseSessionCookie } from '@/lib/session';

function roleHomePath(role: AuthResponseDtoRole): string {
  return role === AuthResponseDtoRole.ADMIN ? '/admin' : '/merchant';
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = parseSessionCookie(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  const isMerchantRoute = pathname.startsWith('/merchant');
  const isAdminRoute = pathname.startsWith('/admin');
  const isLoginRoute = pathname === '/login';

  // Chưa đăng nhập hoặc role PLAYER: không có quyền vào dashboard merchant/admin.
  if (!session || session.role === AuthResponseDtoRole.PLAYER) {
    if (isMerchantRoute || isAdminRoute || pathname === '/') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }

  // Từ đây session.role chỉ còn MERCHANT hoặc ADMIN.
  // MERCHANT không được vào /admin/**; ADMIN được vào cả /merchant/** và /admin/**.
  if (isAdminRoute && session.role === AuthResponseDtoRole.MERCHANT) {
    return NextResponse.redirect(new URL('/merchant', request.url));
  }

  if (isLoginRoute || pathname === '/') {
    return NextResponse.redirect(new URL(roleHomePath(session.role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
