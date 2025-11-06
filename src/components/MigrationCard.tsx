import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FiDatabase, FiCheck, FiLoader, FiAlertCircle } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabase';

import { migrateLabelProgress } from '@/lib/runMigration';
import { migrateDatasetActiveStatus } from '@/lib/migrateDatasetActiveStatus';
import { runLabelingTypeMigration } from '@/lib/runLabelingTypeMigration';

export default function MigrationCard() {
  const [isLoading, setIsLoading] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  
  const runMigrations = async () => {
    setMigrationStatus('running');
    
    try {
      // Run label progress migration
      const labelProgressResult = await migrateLabelProgress();
      if (!labelProgressResult.success) {
        throw new Error('Label progress migration failed');
      }
      
      // Run dataset active status migration
      const activeStatusResult = await migrateDatasetActiveStatus();
      if (!activeStatusResult.success) {
        throw new Error('Dataset active status migration failed');
      }
      
      // Run labeling type migration
      const labelingTypeResult = await runLabelingTypeMigration();
      if (!labelingTypeResult.success) {
        throw new Error('Labeling type migration failed');
      }
      
      setMigrationStatus('success');
    } catch (error) {
      console.error('Migration error:', error);
      setMigrationStatus('error');
    }
  };

  return (
    <Card className="overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
      <CardHeader>
        <CardTitle className="flex items-center text-gray-900 dark:text-white">
          <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-md mr-3">
            <FiDatabase className="text-indigo-600 dark:text-indigo-400" />
          </div>
          Database Migration
        </CardTitle>
        <CardDescription>
          Update the database schema with new features
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h3 className="font-medium text-gray-900 dark:text-white mb-2">Migration Details</h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
            This migration adds new features to the database schema:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-2">
            <li>Date tracking for when users start and complete labeling tasks</li>
            <li>Active/inactive status for datasets</li>
            <li>User-specific entry order for randomized labeling</li>
            <li>Binary/Multi-class labeling type for datasets</li>
          </ul>
          
          {migrationStatus === 'success' && (
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-md flex items-start">
              <FiCheck className="text-green-500 mr-2 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-green-700 dark:text-green-300">
                All migrations completed successfully. The dataset details page will now show start and completion dates for labelers, admins can set datasets as active or inactive, and users will see randomized entry orders when labeling.
              </p>
            </div>
          )}
          
          {migrationStatus === 'error' && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-md flex items-start">
              <FiAlertCircle className="text-red-500 mr-2 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-300">
                Migration failed. Please check the console for more details or try again later.
              </p>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <Button
          onClick={runMigrations}
          disabled={isLoading}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {isLoading ? (
            <>
              <FiLoader className="mr-2 animate-spin" /> Running Migration...
            </>
          ) : (
            <>
              <FiDatabase className="mr-2" /> Run Migration
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}