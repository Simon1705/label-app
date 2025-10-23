'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { User } from '@/types';
import { useMaintenance } from './MaintenanceContext';

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (username: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();
  const { isMaintenanceMode, isAccessGranted } = useMaintenance();

  useEffect(() => {
    // Check for user in localStorage on mount
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser) as User;
        setUser(parsedUser);
        setIsAdmin(parsedUser.is_admin);
      } catch (error) {
        console.error('Error parsing stored user:', error);
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (username: string) => {
    try {
      setLoading(true);
      
      // Check if maintenance mode is active and user doesn't have access
      if (isMaintenanceMode && !isAccessGranted) {
        toast.error('Application is currently under maintenance. Please try again later.');
        return;
      }
      
      // Cari user berdasarkan username
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single();
      
      if (error) {
        throw error;
      }
      
      if (!data) {
        throw new Error('User not found');
      }
      
      const userData = data as User;
      
      // Simpan user di state dan localStorage
      setUser(userData);
      setIsAdmin(userData.is_admin);
      localStorage.setItem('user', JSON.stringify(userData));
      
      // Redirect berdasarkan role
      if (userData.is_admin) {
        router.push('/admin/dashboard');
      } else {
        router.push('/dashboard');
      }
      
      toast.success('Login successful');
    } catch (error) {
      toast.error('Login failed. Please check your username.');
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      
      // Clear user from state and localStorage
      setUser(null);
      setIsAdmin(false);
      localStorage.removeItem('user');
      
      // Redirect to login
      router.push('/');
      
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Error logging out');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};