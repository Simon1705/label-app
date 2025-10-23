'use client';

import { useEffect, useState } from 'react';

export default function DebugMaintenancePage() {
  const [cookieStatus, setCookieStatus] = useState('');
  const [maintenanceStatus, setMaintenanceStatus] = useState('');

  useEffect(() => {
    // Check maintenance cookie
    const cookie = document.cookie
      .split('; ')
      .find(row => row.startsWith('maintenanceAccessGranted='));
    setCookieStatus(cookie || 'No maintenance cookie found');
    
    // Check maintenance status via API
    fetch('/api/maintenance')
      .then(response => response.json())
      .then(data => {
        setMaintenanceStatus(JSON.stringify(data, null, 2));
      })
      .catch(error => {
        setMaintenanceStatus('Error fetching maintenance status: ' + error.message);
      });
  }, []);

  const clearMaintenanceCookie = () => {
    document.cookie = "maintenanceAccessGranted=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    // Refresh the page
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-3xl font-bold mb-6">Maintenance Mode Debug</h1>
        
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Cookie Status</h2>
          <pre className="bg-gray-100 p-4 rounded-md overflow-x-auto">{cookieStatus}</pre>
          <button 
            onClick={clearMaintenanceCookie}
            className="mt-4 px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
          >
            Clear Maintenance Cookie
          </button>
        </div>
        
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Maintenance API Status</h2>
          <pre className="bg-gray-100 p-4 rounded-md overflow-x-auto">{maintenanceStatus}</pre>
        </div>
        
        <div>
          <h2 className="text-xl font-semibold mb-4">Instructions</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>Click "Clear Maintenance Cookie" to remove any existing access</li>
            <li>Refresh the page or navigate to the home page</li>
            <li>If maintenance mode is properly configured, you should be redirected to the maintenance page</li>
            <li>Press Ctrl+M on the maintenance page to enter the access code "admin123"</li>
          </ol>
        </div>
      </div>
    </div>
  );
}