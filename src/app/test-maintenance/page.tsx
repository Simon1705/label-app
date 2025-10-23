'use client';

import { useEffect } from 'react';

export default function TestMaintenancePage() {
  useEffect(() => {
    // Clear maintenance access cookie for testing
    document.cookie = "maintenanceAccessGranted=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-4">Maintenance Test Page</h1>
        <p className="mb-4">The maintenance access cookie has been cleared.</p>
        <p className="mb-4">Try refreshing the page or navigating to the home page to see if maintenance mode works.</p>
        <a href="/" className="text-blue-500 hover:underline">Go to Home Page</a>
      </div>
    </div>
  );
}