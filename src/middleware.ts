import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Environment variable to enable/disable maintenance mode
const IS_MAINTENANCE = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true';

export function middleware(request: NextRequest) {
  // Skip maintenance check for static files, API routes, and the maintenance page itself
  if (
    request.nextUrl.pathname.startsWith('/_next') ||
    request.nextUrl.pathname.startsWith('/api') ||
    request.nextUrl.pathname.startsWith('/favicon') ||
    request.nextUrl.pathname === '/maintenance'
  ) {
    return NextResponse.next();
  }

  // Check if maintenance mode is enabled
  if (IS_MAINTENANCE) {
    // Check if user has bypass permission (stored in cookie)
    const bypassCookie = request.cookies.get('maintenanceBypass');
    
    // If user doesn't have bypass permission, redirect to maintenance page
    if (!bypassCookie || bypassCookie.value !== 'true') {
      return NextResponse.redirect(new URL('/maintenance', request.url));
    }
  }

  return NextResponse.next();
}

// Configure which paths the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};