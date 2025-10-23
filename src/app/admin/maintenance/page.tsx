'use client';

import { useState, useEffect } from 'react';
import { useMaintenance } from '@/contexts/MaintenanceContext';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { toast } from 'react-hot-toast';

export default function MaintenancePage() {
  const { isMaintenanceMode, setIsMaintenanceMode } = useMaintenance();
  const [tempMaintenanceMode, setTempMaintenanceMode] = useState(isMaintenanceMode);

  useEffect(() => {
    setTempMaintenanceMode(isMaintenanceMode);
  }, [isMaintenanceMode]);

  const handleSave = () => {
    setIsMaintenanceMode(tempMaintenanceMode);
    localStorage.setItem('maintenanceMode', tempMaintenanceMode.toString());
    toast.success(`Maintenance mode ${tempMaintenanceMode ? 'enabled' : 'disabled'}`);
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
            only users with the access code can use the application.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Maintenance Status</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Current status: {isMaintenanceMode ? 'Enabled' : 'Disabled'}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={tempMaintenanceMode}
                onChange={(e) => setTempMaintenanceMode(e.target.checked)}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-300">
                {tempMaintenanceMode ? 'Enabled' : 'Disabled'}
              </span>
            </label>
          </div>
          
          {tempMaintenanceMode && (
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <h4 className="font-medium text-yellow-800 dark:text-yellow-200">Important Notice</h4>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                Maintenance mode is enabled. Only users who know the access code can access the application.
                The access code is: <span className="font-mono font-bold">admin123</span>
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}