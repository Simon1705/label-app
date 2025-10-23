import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// List of paths that should be accessible even during maintenance
const ALLOWED_PATHS = [
  '/maintenance',
  '/_next',
  '/favicon.ico',
  '/api',
  '/static',
];

export function middleware(request: NextRequest) {
  // Check if maintenance mode is enabled via environment variable
  const isMaintenanceMode = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true';
  
  // If not in maintenance mode, continue normally
  if (!isMaintenanceMode) {
    return NextResponse.next();
  }
  
  // Check if user has maintenance access
  const accessGranted = request.cookies.get('maintenanceAccessGranted')?.value === 'true';
  
  // If user has access, allow them to proceed
  if (accessGranted) {
    return NextResponse.next();
  }
  
  // Check if the requested path is allowed during maintenance
  const isAllowedPath = ALLOWED_PATHS.some(path => 
    request.nextUrl.pathname.startsWith(path)
  );
  
  // If it's an allowed path, continue normally
  if (isAllowedPath) {
    return NextResponse.next();
  }
  
  // Redirect to maintenance page
  const maintenanceUrl = new URL('/maintenance', request.url);
  return NextResponse.redirect(maintenanceUrl);
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