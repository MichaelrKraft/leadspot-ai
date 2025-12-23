import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Skip auth in development mode
const SKIP_AUTH_IN_DEV = process.env.NODE_ENV === 'development';

// Define public routes that don't require authentication
const publicRoutes = ['/login', '/register', '/forgot-password', '/reset-password'];

// Define routes that should redirect authenticated users
const authRoutes = ['/login', '/register'];

export function middleware(request: NextRequest) {
  // In development, skip auth checks but still allow access to auth pages
  if (SKIP_AUTH_IN_DEV) {
    // Allow all routes in development without redirecting auth pages
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // Get token from cookie - backend sets httpOnly 'access_token' cookie
  const token = request.cookies.get('access_token')?.value;

  // Check if the route is public
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  // If user is authenticated and trying to access auth pages, redirect to dashboard
  if (token && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // If route requires authentication and user is not authenticated
  if (!isPublicRoute && !token) {
    // Store the attempted URL to redirect after login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Configure which routes should be processed by the middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
