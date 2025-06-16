'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { User } from '@/types';
import { FiPlus, FiEdit2, FiTrash2, FiUser, FiUsers, FiSearch } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';

export default function AdminUsers() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingData, setLoadingData] = useState(true);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  
  useEffect(() => {
    // Redirect if not admin
    if (!loading && (!user || !isAdmin)) {
      router.push('/');
    }
  }, [user, loading, isAdmin, router]);
  
  useEffect(() => {
    if (user && isAdmin) {
      fetchUsers();
    }
  }, [user, isAdmin]);
  
  useEffect(() => {
    // Filter users based on search query
    if (searchQuery.trim() === '') {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredUsers(
        users.filter(u => 
          u.username.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, users]);
  
  const fetchUsers = async () => {
    try {
      setLoadingData(true);
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('username', { ascending: true });
      
      if (error) throw error;
      
      setUsers(data || []);
      setFilteredUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoadingData(false);
    }
  };
  
  const handleDeleteUser = async (userId: string) => {
    try {
      setDeletingUserId(userId);
      
      // Make sure we're not deleting ourselves
      if (userId === user?.id) {
        toast.error('You cannot delete your own account');
        return;
      }
      
      // First check if user owns any datasets
      const { data: userDatasets, error: datasetsError } = await supabase
        .from('datasets')
        .select('id')
        .eq('owner_id', userId);
      
      if (datasetsError) throw datasetsError;
      
      if (userDatasets && userDatasets.length > 0) {
        toast.error('Cannot delete user who owns datasets');
        return;
      }
      
      // Delete user
      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);
      
      if (deleteError) throw deleteError;
      
      // Update local state
      setUsers(prev => prev.filter(u => u.id !== userId));
      
      toast.success('User deleted successfully');
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    } finally {
      setDeletingUserId(null);
    }
  };
  
  if (loading || !user) {
    return <div className="flex justify-center py-10">Loading...</div>;
  }
  
  if (!isAdmin) {
    return <div className="text-center py-10">You do not have permission to access this page.</div>;
  }
  
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manage Users</h1>
          <p className="text-gray-500 dark:text-gray-400">Create, update, and delete user accounts</p>
        </div>
        <Link href="/admin/users/create">
          <Button>
            <FiPlus className="mr-2" /> Create New User
          </Button>
        </Link>
      </div>
      
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle>User Accounts</CardTitle>
              <CardDescription>
                {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} found
              </CardDescription>
            </div>
            <div className="w-full md:w-64 relative">
              <FiSearch className="absolute left-3 top-3 text-gray-400" />
              <Input
                placeholder="Search users..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingData ? (
            <div className="text-center py-6">Loading users...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-6 text-gray-500 dark:text-gray-400">
              {searchQuery.trim() !== '' ? 'No users matching your search' : 'No users found'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3">Username</th>
                    <th className="px-6 py-3">Role</th>
                    <th className="px-6 py-3">Created</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(userItem => (
                    <tr key={userItem.id} className="border-b dark:border-gray-700">
                      <td className="px-6 py-4 font-medium">
                        <div className="flex items-center">
                          <FiUser className="mr-2 text-gray-400" />
                          {userItem.username}
                          {userItem.id === user.id && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 px-2 py-0.5 rounded-full">
                              (You)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {userItem.is_admin ? (
                          <span className="inline-flex items-center bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300 text-xs font-medium px-2.5 py-0.5 rounded-full">
                            <FiUsers className="mr-1" /> Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 text-xs font-medium px-2.5 py-0.5 rounded-full">
                            <FiUser className="mr-1" /> Regular
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">{formatDate(userItem.created_at)}</td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <Link href={`/admin/users/edit/${userItem.id}`}>
                          <Button variant="outline" size="sm">
                            <FiEdit2 className="mr-1" /> Edit
                          </Button>
                        </Link>
                        {userItem.id !== user.id && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteUser(userItem.id)}
                            isLoading={deletingUserId === userItem.id}
                            disabled={deletingUserId === userItem.id}
                          >
                            <FiTrash2 className="mr-1" /> Delete
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 