import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { MAINTENANCE_MODE } from '@/lib/maintenanceConfig';

export function middleware(request: NextRequest) {
  // If maintenance mode is not enabled, continue normally
  if (!MAINTENANCE_MODE) {
    return NextResponse.next();
  }
  
  const pathname = request.nextUrl.pathname;
  
  // Define paths that should be accessible even during maintenance
  const isAllowedPath = 
    pathname === '/maintenance' ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/static/');
  
  // Check if user has maintenance access (via cookie)
  const maintenanceCookie = request.cookies.get('maintenanceAccessGranted');
  const hasAccess = maintenanceCookie?.value === 'true';
  
  // Log for debugging (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log('Maintenance mode active:', MAINTENANCE_MODE);
    console.log('Current path:', pathname);
    console.log('Is allowed path:', isAllowedPath);
    console.log('Maintenance cookie:', maintenanceCookie);
    console.log('Has access:', hasAccess);
  }
  
  // If it's not an allowed path and user doesn't have access, redirect to maintenance page
  if (!isAllowedPath && !hasAccess) {
    // Only redirect if not already on maintenance page
    if (pathname !== '/maintenance') {
      const url = request.nextUrl.clone();
      url.pathname = '/maintenance';
      return NextResponse.redirect(url);
    }
  }
  
  return NextResponse.next();
}

// Apply middleware to all routes
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg)).*)'],
};