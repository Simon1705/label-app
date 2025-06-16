'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { toast } from 'react-hot-toast';
import { FiUser, FiSave, FiX, FiEdit2, FiShield, FiAlertCircle, FiLoader } from 'react-icons/fi';
import { motion } from 'framer-motion';

interface UserEditClientProps {
  id: string;
}

export default function UserEditClient({ id }: UserEditClientProps) {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const userId = id;
  
  const [username, setUsername] = useState('');
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userNotFound, setUserNotFound] = useState(false);
  const [errors, setErrors] = useState({
    username: '',
  });
  
  useEffect(() => {
    if (isAdmin) {
      fetchUser();
    }
  }, [isAdmin, userId]);
  
  const fetchUser = async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          setUserNotFound(true);
        }
        throw error;
      }
      
      if (data) {
        setUsername(data.username);
        setIsUserAdmin(data.is_admin);
      } else {
        setUserNotFound(true);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      toast.error('Failed to load user data');
    } finally {
      setIsLoading(false);
    }
  };
  
  const validateForm = () => {
    const formErrors = {
      username: '',
    };
    
    if (!username.trim()) {
      formErrors.username = 'Username is required';
    } else if (username.length < 3) {
      formErrors.username = 'Username must be at least 3 characters long';
    }
    
    setErrors(formErrors);
    return !Object.values(formErrors).some(error => error);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      // Check if username already exists (but not for this user)
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('username', username.trim())
        .neq('id', userId)
        .single();
      
      if (existingUser) {
        setErrors({
          ...errors,
          username: 'This username is already taken',
        });
        return;
      }
      
      // Update user
      const { error: updateError } = await supabase
        .from('users')
        .update({
          username: username.trim(),
          is_admin: isUserAdmin,
        })
        .eq('id', userId);
      
      if (updateError) throw updateError;
      
      toast.success('User updated successfully');
      router.push('/admin/users');
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Failed to update user');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh]">
        <FiAlertCircle className="text-red-500 mb-4" size={48} />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Access Denied</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">You do not have permission to access this page.</p>
        <Button 
          variant="outline" 
          className="mt-4"
          onClick={() => router.push('/')}
        >
          Return to Home
        </Button>
      </div>
    );
  }
  
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh]">
        <FiLoader className="text-blue-500 mb-4 animate-spin" size={48} />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Loading</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Fetching user data...</p>
      </div>
    );
  }
  
  if (userNotFound) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh]">
        <FiAlertCircle className="text-red-500 mb-4" size={48} />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">User Not Found</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">The user you're trying to edit doesn't exist or has been deleted.</p>
        <Button 
          variant="outline" 
          className="mt-4"
          onClick={() => router.push('/admin/users')}
        >
          Return to Users
        </Button>
      </div>
    );
  }
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-lg mx-auto py-6"
    >
      <div className="flex items-center mb-6">
        <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center text-white mr-3 shadow-md">
          <FiEdit2 size={20} />
        </div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Edit User</h1>
      </div>
      
      <Card className="shadow-lg border-0 overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border-b border-gray-200 dark:border-gray-700">
          <CardTitle className="flex items-center text-gray-800 dark:text-white">
            <FiUser className="mr-2" /> User Information
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Update user account details and permissions
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-5 pt-6">
            <div className="relative">
              <div className="absolute left-3 top-[34px] text-gray-400">
                <FiUser size={16} />
              </div>
              <Input
                label="Username"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                error={errors.username}
                className="rounded-lg focus:ring-2 focus:ring-blue-500 pl-9"
              />
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center mb-2">
                <FiShield className="text-blue-600 dark:text-blue-400 mr-2" />
                <h3 className="font-medium text-gray-700 dark:text-gray-300">User Permissions</h3>
              </div>
              
              <div className="flex items-center">
                <div className="relative inline-block w-10 mr-2 align-middle">
                  <input 
                    type="checkbox" 
                    id="is_admin"
                    checked={isUserAdmin}
                    onChange={(e) => setIsUserAdmin(e.target.checked)}
                    className="opacity-0 w-0 h-0 absolute"
                  />
                  <label 
                    htmlFor="is_admin" 
                    className={`block overflow-hidden h-6 rounded-full cursor-pointer transition-colors duration-200 ease-in-out ${isUserAdmin ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                  >
                    <span 
                      className={`block h-6 w-6 rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out ${isUserAdmin ? 'translate-x-4' : 'translate-x-0'}`} 
                    />
                  </label>
                </div>
                <label htmlFor="is_admin" className="cursor-pointer text-sm text-gray-700 dark:text-gray-300">
                  Admin user <span className="text-xs text-gray-500 dark:text-gray-400">(can manage all users and view all datasets)</span>
                </label>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between px-6 py-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/admin/users')}
              className="border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
            >
              <FiX className="mr-2" /> Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isSubmitting}
              disabled={isSubmitting}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all"
            >
              <FiSave className="mr-2" /> Save Changes
            </Button>
          </CardFooter>
        </form>
      </Card>
    </motion.div>
  );
} 