import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const isAuth = request.cookies.has('judge_access');

  // If already authenticated, just let them through
  if (isAuth) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // We split logic: API routes get a JSON 401. Page routes get a redirect.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: 'Unauthorized Access. Please log in.' },
      { status: 401 }
    );
  }

  // Redirect page requests to login
  const loginUrl = new URL('/login', request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Apply middleware to all paths EXCEPT:
  // - /api/auth (the login endpoint)
  // - /login (the login page)
  // - /_next/ (Next.js internals, static files, data)
  // - /favicon.ico, images, etc
  matcher: [
    '/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)',
  ],
};
