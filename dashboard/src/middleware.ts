import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    // Tenant-scoped routes: verify slug matches JWT
    if (pathname.startsWith('/t/')) {
      const slugMatch = pathname.match(/^\/t\/([^/]+)/);
      if (slugMatch && token?.tenantSlug && slugMatch[1] !== token.tenantSlug) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    // Protect all routes except login and auth API
    '/((?!login|api/auth|community|_next/static|_next/image|favicon.ico).*)',
  ],
};
