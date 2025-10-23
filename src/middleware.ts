import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { MAINTENANCE_MODE, ACCESS_CODE } from '@/lib/maintenanceConfig';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // If maintenance mode is not enabled, block access to maintenance page and remove access cookie
  if (!MAINTENANCE_MODE) {
    // If user is trying to access maintenance page when maintenance is off, redirect to home
    if (pathname === '/maintenance') {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
    
    // Remove maintenance access cookie if it exists
    const maintenanceCookie = request.cookies.get('maintenanceAccessGranted');
    if (maintenanceCookie) {
      const response = NextResponse.next();
      response.cookies.delete('maintenanceAccessGranted');
      return response;
    }
    
    return NextResponse.next();
  }
  
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
    // These logs are only shown in development mode, which is appropriate
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