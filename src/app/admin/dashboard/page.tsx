'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { User, Dataset } from '@/types';
import { FiUsers, FiDatabase, FiPlus } from 'react-icons/fi';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import MigrationCard from '@/components/MigrationCard';

export default function AdminDashboard() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  
  const [users, setUsers] = useState<User[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const fetchData = useCallback(async () => {
    try {
      setLoadingData(true);
      
      // Fetch all users
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*');
      
      if (usersError) throw usersError;
      
      // Fetch all datasets
      const { data: datasetsData, error: datasetsError } = await supabase
        .from('datasets')
        .select('*');
      
      if (datasetsError) throw datasetsError;
      
      setUsers(usersData || []);
      setDatasets(datasetsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoadingData(false);
    }
  }, []);
  
  useEffect(() => {
    // Redirect if not admin
    if (!loading && (!user || !isAdmin)) {
      router.push('/');
    }
  }, [user, loading, isAdmin, router]);
  
  useEffect(() => {
    if (user && isAdmin) {
      fetchData();
    }
  }, [user, isAdmin, fetchData]);
  
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
      setDatasets(prev => prev.filter(d => d.id !== datasetId));
    } catch (error) {
      console.error('Error deleting dataset:', error);
      toast.error('Failed to delete dataset');
    } finally {
      setDeletingId(null);
    }
  };
  
  if (loading || !user) {
    return <div className="flex justify-center py-10">Loading...</div>;
  }
  
  if (!isAdmin) {
    return <div className="text-center py-10">You do not have permission to access this page.</div>;
  }
  
  const regularUsers = users.filter(u => !u.is_admin);
  const adminUsers = users.filter(u => u.is_admin);
  
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage users and monitor datasets</p>
        </div>
        <Link href="/admin/users/create">
          <Button>
            <FiPlus className="mr-2" /> Create New User
          </Button>
        </Link>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Total Users</CardTitle>
            <CardDescription>All registered users</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-500">
              {users.length}
            </div>
            <Link href="/admin/users">
              <Button variant="outline" className="mt-4 w-full">
                <FiUsers className="mr-2" /> Manage Users
              </Button>
            </Link>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Regular Users</CardTitle>
            <CardDescription>Non-admin users</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600 dark:text-green-500">
              {regularUsers.length}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Users who can upload and label datasets
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Admin Users</CardTitle>
            <CardDescription>Users with admin privileges</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-500">
              {adminUsers.length}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Users who can manage the system
            </p>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Recent Datasets</CardTitle>
          <CardDescription>Latest uploaded datasets</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingData ? (
            <div className="text-center py-4">Loading...</div>
          ) : datasets.length === 0 ? (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400">
              No datasets have been uploaded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3">Name</th>
                    <th className="px-6 py-3">Owner</th>
                    <th className="px-6 py-3">Entries</th>
                    <th className="px-6 py-3">Created</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {datasets.slice(0, 5).map(dataset => {
                    const owner = users.find(u => u.id === dataset.owner_id);
                    return (
                      <tr key={dataset.id} className="border-b dark:border-gray-700">
                        <td className="px-6 py-4 font-medium">{dataset.name}</td>
                        <td className="px-6 py-4">{owner?.username || 'Unknown'}</td>
                        <td className="px-6 py-4">{dataset.total_entries}</td>
                        <td className="px-6 py-4">
                          {new Date(dataset.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${dataset.is_active === false ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200' : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'}`}>
                            {dataset.is_active === false ? 'Inactive' : 'Active'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteDataset(dataset.id)}
                            isLoading={deletingId === dataset.id}
                            disabled={deletingId === dataset.id}
                            className="text-white text-xs"
                          >
                            Delete
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          
          {datasets.length > 5 && (
            <div className="mt-4 text-center">
              <Link href="/admin/datasets">
                <Button variant="link">
                  View All Datasets <FiDatabase className="ml-1" />
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 