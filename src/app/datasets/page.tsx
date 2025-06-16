'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Dataset } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatDate, cn } from '@/lib/utils';
import Link from 'next/link';
import { FiPlus, FiDatabase, FiUsers, FiTag, FiShield, FiSearch, FiChevronRight, FiFilter, FiRefreshCw, FiLoader } from 'react-icons/fi';
import { motion } from 'framer-motion';

// Local Badge component
type BadgeVariant = 'default' | 'secondary' | 'outline';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variantClasses = {
    default: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 border-transparent",
    secondary: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100 border-transparent",
    outline: "text-gray-700 border border-gray-200 dark:text-gray-300 dark:border-gray-700",
  };

  return (
    <div 
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", 
        variantClasses[variant],
        className
      )} 
      {...props} 
    />
  );
}

// Local Skeleton component
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-gray-200 dark:bg-gray-700", className)}
      {...props}
    />
  );
}

// Loading screen component
function LoadingScreen() {
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
              Loading Datasets...
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              Preparing your data collections
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

export default function DatasetsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) {
      fetchDatasets();
      checkAdminStatus();
    }
  }, [user]);

  const checkAdminStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user?.id)
        .single();
      
      if (error) throw error;
      
      setIsAdmin(data?.is_admin || false);
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    }
  };

  const fetchDatasets = async () => {
    try {
      setLoading(true);
      
      // Fetch datasets owned by the user
      const { data, error } = await supabase
        .from('datasets')
        .select('*')
        .eq('owner_id', user?.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      setDatasets(data || []);
    } catch (error) {
      console.error('Error fetching datasets:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await fetchDatasets();
    setTimeout(() => setRefreshing(false), 800);
  };

  const filteredDatasets = datasets.filter(dataset => 
    dataset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (dataset.description && dataset.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="pt-16 fixed inset-0 overflow-y-auto bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 dark:bg-purple-900 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-300 dark:bg-indigo-900 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-pink-300 dark:bg-pink-900 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative container mx-auto px-4 py-6 space-y-8 min-h-screen pb-20"
      >
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="backdrop-blur-sm bg-white/70 dark:bg-gray-800/70 rounded-2xl shadow-xl p-6 border border-white/20 dark:border-gray-700/50 mt-2"
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <motion.h1 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent"
              >
                Your Datasets
              </motion.h1>
              <div className="mt-2 text-gray-600 dark:text-gray-300">
                Manage your data collections for labeling projects
              </div>
            </div>
            <div className="flex gap-2">
              {isAdmin && (
                <Link href="/admin/datasets">
                  <Button className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white border-gray-200 dark:border-gray-600 transition-all">
                    <FiShield className="mr-2" /> Admin View
                  </Button>
                </Link>
              )}
              <Button 
                onClick={() => router.push('/datasets/upload')}
                className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white shadow-lg hover:shadow-xl transition-all"
              >
                <FiPlus className="mr-2" /> Create New Dataset
              </Button>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="backdrop-blur-sm bg-white/70 dark:bg-gray-800/70 rounded-lg shadow-lg p-4 border border-white/20 dark:border-gray-700/50"
        >
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
            <div className="relative w-full sm:w-auto">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <FiSearch className="text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full sm:w-64 pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white/70 dark:bg-gray-800/70 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 backdrop-blur-sm shadow-sm"
                placeholder="Search datasets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-100 border-white/20 dark:border-gray-700/50 shadow-sm">
                {datasets.length} Total Datasets
              </Badge>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={refreshData}
                className="relative border-white/20 dark:border-gray-700/50 hover:border-indigo-300 dark:hover:border-indigo-700 bg-white/70 dark:bg-gray-800/70 text-gray-700 dark:text-gray-300 backdrop-blur-sm shadow-sm"
                disabled={refreshing}
              >
                <FiRefreshCw className={`mr-2 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
              </Button>
            </div>
          </div>
        </motion.div>

        {filteredDatasets.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="backdrop-blur-sm bg-white/70 dark:bg-gray-800/70 rounded-xl shadow-lg border border-white/20 dark:border-gray-700/50 p-8"
          >
            {searchTerm ? (
              <div className="text-center">
                <div className="w-20 h-20 mx-auto bg-gray-100/70 dark:bg-gray-700/70 rounded-full flex items-center justify-center mb-4">
                  <FiSearch className="text-gray-400 h-8 w-8" />
                </div>
                <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">No matching datasets</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                  No datasets match your search "{searchTerm}".
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => setSearchTerm('')}
                  className="bg-white/70 dark:bg-gray-700/70 border-white/20 dark:border-gray-700/50 hover:border-indigo-300 dark:hover:border-indigo-700"
                >
                  Clear Search
                </Button>
              </div>
            ) : (
              <div className="text-center">
                <div className="h-24 w-24 mx-auto bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg mb-6 rotate-3">
                  <FiDatabase className="text-white h-10 w-10" />
                </div>
                <h3 className="text-xl font-medium bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">No datasets yet</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                  Upload a CSV file to create your first dataset for labeling.
                </p>
                <Button 
                  onClick={() => router.push('/datasets/upload')} 
                  className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white shadow-lg"
                >
                  <FiPlus className="mr-2" /> Create Dataset
                </Button>
              </div>
            )}
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-10">
            {filteredDatasets.map((dataset, index) => (
              <motion.div
                key={dataset.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                whileHover={{ y: -5, scale: 1.02 }}
                className="transform transition-all duration-300"
              >
                <Card className="backdrop-blur-sm bg-white/70 dark:bg-gray-800/70 border border-white/20 dark:border-gray-700/50 shadow-lg hover:shadow-xl transition-all h-full overflow-hidden">
                  <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600"></div>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-gray-900 dark:text-white font-bold">
                        {dataset.name}
                      </CardTitle>
                      <Badge variant="secondary" className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-100">
                        {dataset.total_entries} entries
                      </Badge>
                    </div>
                    <CardDescription className="text-gray-500 dark:text-gray-400">
                      Created on {formatDate(dataset.created_at)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <div className="space-y-3">
                      <p className="text-gray-600 dark:text-gray-300 text-sm min-h-[3em] line-clamp-2">
                        {dataset.description || "No description provided"}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <div className="flex items-center backdrop-blur-sm bg-white/50 dark:bg-gray-800/50 border border-white/20 dark:border-gray-700/50 px-3 py-1 rounded-full text-xs shadow-sm">
                          <FiUsers className="mr-2 text-indigo-500 dark:text-indigo-400" />
                          <span className="text-gray-700 dark:text-gray-300">Team labeling</span>
                        </div>
                        <div className="flex items-center backdrop-blur-sm bg-white/50 dark:bg-gray-800/50 border border-white/20 dark:border-gray-700/50 px-3 py-1 rounded-full text-xs shadow-sm">
                          <FiTag className="mr-2 text-pink-500 dark:text-pink-400" />
                          <span className="text-gray-700 dark:text-gray-300">Code: {dataset.invite_code}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="border-t border-gray-200 dark:border-gray-700/30 pt-4 flex justify-between">
                    <Link href={`/datasets/${dataset.id}`} className="w-full">
                      <Button 
                        variant="outline" 
                        className="w-full bg-white/50 dark:bg-gray-800/50 border-white/20 dark:border-gray-700/50 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 dark:hover:from-indigo-900/20 dark:hover:to-purple-900/20 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all text-gray-700 dark:text-gray-300"
                      >
                        View Details
                        <FiChevronRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

