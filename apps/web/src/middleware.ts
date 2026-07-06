import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const publicPaths = [
  '/login',
  '/register',
  '/forgot-password',
  '/magic-link',
  '/api/auth',
];

export function middleware(request: NextRequest) {
  const sessionToken = request.cookies.get('session_token')?.value;
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    // If already logged in and visiting login, redirect to dashboard
    if (pathname === '/login' && sessionToken) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // Allow static files and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/fonts') ||
    pathname.startsWith('/images')
  ) {
    return NextResponse.next();
  }

  // Redirect to login if not authenticated
  if (!sessionToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
