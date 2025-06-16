'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Dataset, User } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import { FiDatabase, FiUsers, FiTag, FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-hot-toast';

interface DatasetWithOwner extends Dataset {
  owner?: User;
}

export default function AdminDatasetsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [datasets, setDatasets] = useState<DatasetWithOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchAllDatasets = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch all datasets
      const { data, error } = await supabase
        .from('datasets')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Fetch all users to get owner information
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*');
      
      if (usersError) throw usersError;
      
      // Map owners to datasets
      const datasetsWithOwners = data?.map((dataset: Dataset) => {
        const owner = users?.find((u: User) => u.id === dataset.owner_id);
        return {
          ...dataset,
          owner
        };
      }) || [];
      
      setDatasets(datasetsWithOwners);
    } catch (error) {
      console.error('Error fetching datasets:', error);
      toast.error('Failed to load datasets');
    } finally {
      setLoading(false);
    }
  }, []);

  const checkAdminStatus = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user?.id)
        .single();
      
      if (error) throw error;
      
      const adminStatus = data?.is_admin || false;
      setIsAdmin(adminStatus);
      
      if (adminStatus) {
        fetchAllDatasets();
      } else {
        // Redirect non-admin users
        toast.error('You do not have permission to access this page');
        router.push('/datasets');
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
      toast.error('Failed to verify admin status');
      router.push('/datasets');
    }
  }, [user?.id, router, fetchAllDatasets]);

  useEffect(() => {
    if (user) {
      checkAdminStatus();
    }
  }, [user, checkAdminStatus]);

  const handleDeleteDataset = async (datasetId: string) => {
    try {
      setDeletingId(datasetId);
      
      // First delete all related data
      // 1. Delete labels
      const { error: labelsError } = await supabase
        .from('dataset_labels')
        .delete()
        .eq('dataset_id', datasetId);
      
      if (labelsError) throw labelsError;
      
      // 2. Delete entries
      const { error: entriesError } = await supabase
        .from('dataset_entries')
        .delete()
        .eq('dataset_id', datasetId);
      
      if (entriesError) throw entriesError;
      
      // 3. Delete progress records
      const { error: progressError } = await supabase
        .from('label_progress')
        .delete()
        .eq('dataset_id', datasetId);
      
      if (progressError) throw progressError;
      
      // 4. Get file path before deleting dataset
      const { data: datasetData } = await supabase
        .from('datasets')
        .select('file_path')
        .eq('id', datasetId)
        .single();
      
      // 5. Delete dataset
      const { error: datasetError } = await supabase
        .from('datasets')
        .delete()
        .eq('id', datasetId);
      
      if (datasetError) throw datasetError;
      
      // 6. Delete CSV file from storage if exists
      if (datasetData?.file_path) {
        const { error: storageError } = await supabase.storage
          .from('csvfiles')
          .remove([datasetData.file_path]);
        
        if (storageError) {
          console.error('Failed to delete CSV file:', storageError);
          // Continue even if file deletion fails
        }
      }
      
      toast.success('Dataset deleted successfully');
      
      // Update the list
      setDatasets((prev: DatasetWithOwner[]) => prev.filter((d: DatasetWithOwner) => d.id !== datasetId));
    } catch (error) {
      console.error('Error deleting dataset:', error);
      toast.error('Failed to delete dataset');
    } finally {
      setDeletingId(null);
    }
  };

  if (!isAdmin) {
    return <div className="flex justify-center py-10">Checking permissions...</div>;
  }

  if (loading) {
    return <div className="flex justify-center py-10">Loading...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">All Datasets (Admin)</h1>
        <Link href="/datasets">
          <Button variant="outline">
            Back to My Datasets
          </Button>
        </Link>
      </div>

      {datasets.length === 0 ? (
        <Card className="text-center py-10">
          <CardContent>
            <FiDatabase className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No datasets found</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              There are no datasets in the system yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {datasets.map((dataset) => (
            <Card key={dataset.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{dataset.name}</CardTitle>
                    <CardDescription>
                      Created on {formatDate(dataset.created_at)}
                    </CardDescription>
                  </div>
                  <div className="flex space-x-2">
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => handleDeleteDataset(dataset.id)}
                      isLoading={deletingId === dataset.id}
                      disabled={deletingId === dataset.id}
                    >
                      <FiTrash2 className="mr-1" /> Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center">
                    <FiDatabase className="mr-2 text-gray-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {dataset.total_entries} Entries
                    </span>
                  </div>
                  <div className="flex items-center">
                    <FiUsers className="mr-2 text-gray-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      Owner: {dataset.owner?.username || 'Unknown'}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <FiTag className="mr-2 text-gray-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      Invite code: {dataset.invite_code}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
} 