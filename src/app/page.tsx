'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMaintenance } from '@/contexts/MaintenanceContext';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { FiLogIn, FiUser, FiLoader, FiAlertTriangle } from 'react-icons/fi';
import Image from 'next/image';
import { motion } from 'framer-motion';

function LoadingPage() {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 dark:bg-purple-900 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-300 dark:bg-indigo-900 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-pink-300 dark:bg-pink-900 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative backdrop-blur-lg bg-white/70 dark:bg-gray-800/70 border border-white/20 dark:border-gray-700/50 shadow-2xl rounded-2xl p-8 max-w-md w-full mx-4"
      >
        <div className="flex flex-col items-center space-y-6">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="h-16 w-16 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg"
          >
            <FiLoader className="text-white text-3xl" />
          </motion.div>
          
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Loading...
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              Preparing your workspace
            </p>
          </div>

          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
            <motion.div
              className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-2.5 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  const { login, loading } = useAuth();
  const { isMaintenanceMode, isAccessGranted } = useMaintenance();
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim()) {
      setError('Username is required');
      return;
    }
    
    setError('');
    try {
      await login(username);
    } catch (err) {
      // Error toast is handled in the auth context
    }
  };

  if (loading) {
    return <LoadingPage />;
  }

  return (
    <div className="relative min-h-[calc(100vh-200px)]">
      {/* Background with full screen coverage */}
      <div className="fixed inset-0 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 -z-10">
        {/* Decorative background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 dark:bg-purple-900 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-300 dark:bg-indigo-900 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-pink-300 dark:bg-pink-900 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
        </div>
      </div>

      {/* Content */}
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)] p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative w-full max-w-md"
        >
          <Card className="backdrop-blur-lg bg-white/70 dark:bg-gray-800/70 border border-white/20 dark:border-gray-700/50 shadow-2xl">
            <CardHeader className="space-y-1">
              <motion.div 
                initial={{ scale: 0.8, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="flex justify-center mb-4"
              >
                <div className="h-24 w-24 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg transform rotate-3 hover:rotate-0 transition-transform duration-300">
                  <FiLogIn className="text-white text-4xl" />
                </div>
              </motion.div>
              <CardTitle className="text-4xl font-extrabold text-center bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Label App
              </CardTitle>
              <CardDescription className="text-center text-gray-600 dark:text-gray-300 text-lg">
                Welcome back! Please enter your credentials
              </CardDescription>
            </CardHeader>
            {isMaintenanceMode && !isAccessGranted && (
              <div className="mx-6 mb-4 p-3 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-lg flex items-center">
                <FiAlertTriangle className="mr-2 flex-shrink-0" />
                <span className="text-sm">
                  The application is currently under maintenance. Only authorized users can access it.
                </span>
              </div>
            )}
            <form onSubmit={handleLogin}>
              <CardContent className="space-y-6">
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-300"></div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FiUser className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                    </div>
                    <Input
                      label="Username"
                      placeholder="Enter your username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      error={error}
                      disabled={loading}
                      className="pl-10 dark:bg-gray-700/50 dark:border-gray-600/50 dark:text-white backdrop-blur-sm"
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  type="submit" 
                  fullWidth={true}
                  isLoading={loading}
                  className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white font-medium py-3 px-4 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-[1.02] dark:from-indigo-700 dark:via-purple-700 dark:to-pink-700 dark:hover:from-indigo-800 dark:hover:via-purple-800 dark:hover:to-pink-800"
                >
                  {loading ? 'Logging in...' : 'Login'}
                </Button>
              </CardFooter>
            </form>
          </Card>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="text-center mt-4 text-sm text-gray-500 dark:text-gray-400"
          >
            Contact admin to get your username
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}