'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { toast } from 'react-hot-toast';

export default function MaintenanceAdminPage() {
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check current maintenance mode status
  useEffect(() => {
    const checkMaintenanceStatus = async () => {
      try {
        const response = await fetch('/api/maintenance');
        const data = await response.json();
        setIsMaintenanceMode(data.isMaintenanceMode);
      } catch (error) {
        console.error('Failed to fetch maintenance status:', error);
        toast.error('Failed to fetch maintenance status');
      } finally {
        setIsLoading(false);
      }
    };

    checkMaintenanceStatus();
  }, []);

  const toggleMaintenanceMode = async () => {
    try {
      setIsLoading(true);
      
      // Call the API to toggle maintenance mode
      const response = await fetch('/api/admin/maintenance-toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (data.success) {
        setIsMaintenanceMode(data.isMaintenanceMode);
        toast.success(data.message);
      } else {
        throw new Error(data.message || 'Failed to toggle maintenance mode');
      }
    } catch (error) {
      console.error('Failed to toggle maintenance mode:', error);
      toast.error('Failed to toggle maintenance mode');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Maintenance Settings</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Configure maintenance mode for the application
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Maintenance Mode</CardTitle>
          <CardDescription>
            Enable or disable maintenance mode for the application. When enabled, 
            only users with the access code can access the application.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Maintenance Status</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Current status: {isLoading ? 'Loading...' : isMaintenanceMode ? 'Enabled' : 'Disabled'}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={isMaintenanceMode}
                onChange={toggleMaintenanceMode}
                disabled={isLoading}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-300">
                {isMaintenanceMode ? 'Enabled' : 'Disabled'}
              </span>
            </label>
          </div>
          
          {isMaintenanceMode && (
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <h4 className="font-medium text-yellow-800 dark:text-yellow-200">Important Notice</h4>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                Maintenance mode is enabled. Only users who know the access code can access the application.
                The access code is: <span className="font-mono font-bold">admin123</span>
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-2">
                <strong>Note:</strong> Server restart may be required for changes to take effect in production.
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={toggleMaintenanceMode} disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}