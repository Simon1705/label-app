'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Dataset, LabelProgress } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FiUpload, FiTag, FiGrid, FiChevronRight, FiActivity, FiBarChart2, FiBox, FiUser, FiLoader } from 'react-icons/fi';
import Link from 'next/link';
import { calculateProgress, cn } from '@/lib/utils';
import { motion } from 'framer-motion';

// Local Badge component implementation to avoid import case issues
type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variantClasses = {
    default: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 border-transparent",
    secondary: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100 border-transparent",
    destructive: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100 border-transparent",
    outline: "text-gray-700 border border-gray-200 dark:text-gray-300 dark:border-gray-700",
    success: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 border-transparent"
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
              Loading Dashboard...
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

export default function Dashboard() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const [myDatasets, setMyDatasets] = useState<Dataset[]>([]);
  const [invitedDatasets, setInvitedDatasets] = useState<Dataset[]>([]);
  const [progress, setProgress] = useState<LabelProgress[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    // Redirect if not logged in or is admin
    if (!loading && (!user || isAdmin)) {
      router.push('/');
    }
  }, [user, loading, isAdmin, router]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoadingData(true);
      
      // Fetch datasets owned by user
      const { data: ownedDatasets, error: ownedError } = await supabase
        .from('datasets')
        .select('*')
        .eq('owner_id', user?.id)
        .order('created_at', { ascending: false });
      
      if (ownedError) throw ownedError;
      
      // Fetch datasets user is invited to
      const { data: labelData, error: labelError } = await supabase
        .from('label_progress')
        .select('dataset_id')
        .eq('user_id', user?.id);
      
      if (labelError) throw labelError;
      
      // Use Set to get unique dataset IDs
      const invitedDatasetIds = [...new Set(labelData?.map((item: { dataset_id: string }) => item.dataset_id) || [])];
      
      let invitedDatasetsArray: Dataset[] = [];
      if (invitedDatasetIds.length > 0) {
        const { data, error } = await supabase
          .from('datasets')
          .select('*')
          .in('id', invitedDatasetIds)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        invitedDatasetsArray = data || [];
      }
      
      // Fetch labeling progress
      const { data: progressData, error: progressError } = await supabase
        .from('label_progress')
        .select('*')
        .eq('user_id', user?.id);
      
      if (progressError) throw progressError;
      
      setMyDatasets(ownedDatasets || []);
      setInvitedDatasets(invitedDatasetsArray);
      setProgress(progressData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  if (loading || !user) {
    return <LoadingScreen />;
  }

  const getProgressForDataset = (datasetId: string) => {
    const datasetProgress = progress.find(p => p.dataset_id === datasetId);
    if (!datasetProgress) return 0;
    return calculateProgress(datasetProgress.completed, datasetProgress.total);
  };

  const totalLabelsContributed = progress.reduce((total, current) => total + current.completed, 0);

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
                Welcome back, {user.username}!
              </motion.h1>
              <div className="mt-2 text-gray-600 dark:text-gray-300">
                {loadingData ? (
                  <Skeleton className="h-4 w-48 bg-white/20" />
                ) : (
                  <>Your labeling journey continues with {invitedDatasets.length} active tasks</>
                )}
              </div>
            </div>
            <Link href="/datasets/upload">
              <Button className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white shadow-lg hover:shadow-xl transition-all">
                <FiUpload className="mr-2" /> Upload New Dataset
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Custom Tabs Implementation */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="w-full space-y-6"
        >
          <div className="flex border-b border-gray-200 dark:border-gray-700 backdrop-blur-sm bg-white/70 dark:bg-gray-800/70 rounded-t-lg p-2">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 font-medium text-sm rounded-md transition-all ${
                activeTab === 'overview'
                  ? 'text-white bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 shadow-md'
                  : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Overview
            </button>
          </div>
          
          {activeTab === 'overview' && (
            <div className="space-y-8 pb-20">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  whileHover={{ y: -5 }}
                >
                  <Card className="backdrop-blur-sm bg-white/80 dark:bg-gray-800/80 border border-white/20 dark:border-gray-700/50 shadow-lg hover:shadow-xl transition-all overflow-hidden">
                    <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-blue-500 to-indigo-500"></div>
                    <CardHeader>
                      <CardTitle className="flex items-center text-gray-900 dark:text-white">
                        <FiBox className="mr-2 text-blue-500" /> My Datasets
                      </CardTitle>
                      <CardDescription className="text-gray-600 dark:text-gray-300">Datasets you have uploaded</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        {myDatasets.length}
                      </div>
                      <Link href="/datasets">
                        <Button variant="outline" className="mt-4 w-full group border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-all">
                          <FiGrid className="mr-2" /> View All
                          <FiChevronRight className="ml-auto group-hover:translate-x-1 transition-transform" />
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                </motion.div>
                
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                  whileHover={{ y: -5 }}
                >
                  <Card className="backdrop-blur-sm bg-white/80 dark:bg-gray-800/80 border border-white/20 dark:border-gray-700/50 shadow-lg hover:shadow-xl transition-all overflow-hidden">
                    <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-green-500 to-emerald-500"></div>
                    <CardHeader>
                      <CardTitle className="flex items-center text-gray-900 dark:text-white">
                        <FiTag className="mr-2 text-green-500" /> Invited Datasets
                      </CardTitle>
                      <CardDescription className="text-gray-600 dark:text-gray-300">Datasets you've been invited to label</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                        {loadingData ? (
                          <Skeleton className="h-10 w-10 bg-gray-200 dark:bg-gray-700" />
                        ) : (
                          invitedDatasets.length
                        )}
                      </div>
                      <Link href="/labeling">
                        <Button 
                          variant="outline" 
                          className="mt-4 w-full group border-gray-200 dark:border-gray-700 hover:border-green-500 dark:hover:border-green-500 transition-all"
                          disabled={loadingData}
                        >
                          <FiTag className="mr-2" /> 
                          {invitedDatasets.length > 0 ? 'Continue Labeling' : 'Join Datasets'}
                          <FiChevronRight className="ml-auto group-hover:translate-x-1 transition-transform" />
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                </motion.div>
                
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.3 }}
                  whileHover={{ y: -5 }}
                >
                  <Card className="backdrop-blur-sm bg-white/80 dark:bg-gray-800/80 border border-white/20 dark:border-gray-700/50 shadow-lg hover:shadow-xl transition-all overflow-hidden">
                    <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-purple-500 to-pink-500"></div>
                    <CardHeader>
                      <CardTitle className="flex items-center text-gray-900 dark:text-white">
                        <FiActivity className="mr-2 text-purple-500" /> Labeling Progress
                      </CardTitle>
                      <CardDescription className="text-gray-600 dark:text-gray-300">Your overall labeling activity</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                        {totalLabelsContributed}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Labels contributed
                      </p>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mt-4 overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, (totalLabelsContributed / Math.max(1, progress.reduce((total, current) => total + current.total, 0))) * 100)}%` }}
                          transition={{ duration: 1, delay: 0.5 }}
                          className="bg-gradient-to-r from-purple-500 to-pink-500 h-2.5 rounded-full" 
                        />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              {invitedDatasets.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                >
                  <div className="backdrop-blur-sm bg-white/80 dark:bg-gray-800/80 border border-white/20 dark:border-gray-700/50 shadow-lg rounded-xl p-6">
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-semibold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                        Recent Labeling Tasks
                      </h2>
                      <Link href="/labeling">
                        <Button variant="outline" size="sm" className="border-gray-200 dark:border-gray-700 hover:border-indigo-500 dark:hover:border-indigo-500 transition-all">
                          View All
                        </Button>
                      </Link>
                    </div>
                    <div className="grid grid-cols-1 gap-6">
                      {invitedDatasets.slice(0, 3).map((dataset, index) => (
                        <motion.div 
                          key={dataset.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: 0.1 * index }}
                          whileHover={{ scale: 1.02 }}
                          className="transform transition-all"
                        >
                          <Card className="backdrop-blur-sm bg-white/60 dark:bg-gray-800/60 border border-white/20 dark:border-gray-700/50 overflow-hidden hover:shadow-lg transition-all rounded-xl" 
                            style={{ 
                              borderLeftWidth: '4px',
                              borderLeftColor: getProgressForDataset(dataset.id) >= 80 
                                ? '#10b981' 
                                : getProgressForDataset(dataset.id) >= 40 
                                  ? '#6366f1' 
                                  : '#ef4444'
                            }}
                          >
                            <CardContent className="p-6">
                              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">{dataset.name}</h3>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="secondary">{dataset.total_entries} entries</Badge>
                                    <Badge 
                                      variant={getProgressForDataset(dataset.id) >= 80 ? "success" : 
                                              getProgressForDataset(dataset.id) >= 40 ? "default" : "destructive"}
                                    >
                                      {getProgressForDataset(dataset.id)}% complete
                                    </Badge>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end w-full md:w-auto">
                                  <div className="w-full md:w-48 bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-2 overflow-hidden">
                                    <motion.div 
                                      initial={{ width: 0 }}
                                      animate={{ width: `${getProgressForDataset(dataset.id)}%` }}
                                      transition={{ duration: 1, delay: 0.5 }}
                                      className={`h-2.5 rounded-full ${
                                        getProgressForDataset(dataset.id) >= 80 
                                          ? 'bg-gradient-to-r from-green-400 to-green-600' 
                                          : getProgressForDataset(dataset.id) >= 40 
                                            ? 'bg-gradient-to-r from-blue-400 to-indigo-600' 
                                            : 'bg-gradient-to-r from-red-400 to-red-600'
                                      }`}
                                    />
                                  </div>
                                  <Link href={`/labeling/${dataset.id}`}>
                                    <Button className="mt-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white shadow-md hover:shadow-lg transition-all">
                                      Continue Labeling <FiChevronRight className="ml-2" />
                                    </Button>
                                  </Link>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
} 