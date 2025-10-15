'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Dataset, LabelProgress, User } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FiUpload, FiTag, FiGrid, FiChevronRight, FiActivity, FiBarChart2, FiBox, FiUser, FiLoader, FiPlusCircle, FiUsers } from 'react-icons/fi';
import Link from 'next/link';
import { calculateProgress, cn } from '@/lib/utils';
import { motion } from 'framer-motion';

// Local Badge component implementation to avoid import case issues
type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success';

interface BadgeProps {
  variant?: BadgeVariant;
  className?: string;
  children: React.ReactNode;
}

function Badge({ className, variant = 'default', children }: BadgeProps) {
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
    >
      {children}
    </div>
  );
}

// Local Skeleton component
interface SkeletonProps {
  className?: string;
}

function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-gray-200 dark:bg-gray-700", className)}
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
  const [datasetLabelers, setDatasetLabelers] = useState<Record<string, { users: User[], progress: LabelProgress[] }>>({});

  const fetchData = useCallback(async () => {
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
      
      // Fetch labelers progress for all datasets (owned and joined)
      const datasetLabelersData: Record<string, { users: User[], progress: LabelProgress[] }> = {};
      
      // Process owned datasets
      for (const dataset of ownedDatasets || []) {
        await fetchLabelersForDataset(dataset.id, datasetLabelersData);
      }
      
      // Process joined datasets
      for (const dataset of invitedDatasetsArray || []) {
        // Only fetch labelers if user is the owner or if it's a joined dataset
        if (dataset.owner_id !== user?.id) {
          await fetchLabelersForDataset(dataset.id, datasetLabelersData);
        }
      }
      
      setMyDatasets(ownedDatasets || []);
      setInvitedDatasets(invitedDatasetsArray);
      setProgress(progressData || []);
      setDatasetLabelers(datasetLabelersData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoadingData(false);
    }
  }, [user?.id]);

  // Helper function to fetch labelers for a dataset
  const fetchLabelersForDataset = async (datasetId: string, datasetLabelersData: Record<string, { users: User[], progress: LabelProgress[] }>) => {
    // Fetch all progress records for this dataset
    const { data: datasetProgress, error: progressError } = await supabase
      .from('label_progress')
      .select('*')
      .eq('dataset_id', datasetId);
    
    if (!progressError && datasetProgress) {
      // Get unique user IDs
      const userIds = [...new Set(datasetProgress.map(p => p.user_id))];
      
      // Fetch user data for these users
      let usersData: User[] = [];
      if (userIds.length > 0) {
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('*')
          .in('id', userIds);
        
        if (!usersError) {
          usersData = users || [];
        }
      }
      
      datasetLabelersData[datasetId] = {
        users: usersData,
        progress: datasetProgress
      };
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);

  useEffect(() => {
    // Redirect if not logged in or is admin
    if (!loading && (!user || isAdmin)) {
      router.push('/');
    }
  }, [user, loading, isAdmin, router]);

  const getProgressForDataset = useCallback((datasetId: string): number => {
    const datasetProgress = progress.find((p: LabelProgress) => p.dataset_id === datasetId);
    if (!datasetProgress) return 0;
    return calculateProgress(datasetProgress.completed, datasetProgress.total);
  }, [progress]);

  const totalLabelsContributed = progress.reduce((total: number, current: LabelProgress) => total + current.completed, 0);

  if (loading || !user) {
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
              <Button className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white shadow-lg hover:shadow-xl transition-all cursor-pointer">
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
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="w-full space-y-10"
            >
              {/* Render hanya tombol jika user belum punya dataset sama sekali */}
              {myDatasets.length === 0 && invitedDatasets.filter(dataset => dataset.owner_id !== user.id).length === 0 ? (
                <div className="flex flex-col items-center justify-center mt-16">
                  <div className="backdrop-blur-md bg-white/80 dark:bg-gray-900/80 border border-white/30 dark:border-gray-700/60 shadow-2xl rounded-2xl p-8 flex flex-col items-center max-w-md w-full">
                    <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg mb-6">
                      <FiTag className="text-white text-4xl" />
                    </div>
                    <p className="mb-4 text-xl text-gray-800 dark:text-white font-semibold text-center">You don't have any datasets yet</p>
                    <p className="mb-6 text-base text-gray-600 dark:text-gray-300 text-center">Get started by uploading your own dataset or joining an existing one!</p>
                    <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                      <Link href="/datasets/upload" className="w-full sm:w-auto flex-1 flex justify-center">
                        <Button className="min-w-[180px] px-6 py-4 text-base sm:text-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-indigo-700 hover:to-blue-700 transition-all duration-200 text-white shadow-xl font-bold rounded-full transform hover:scale-105 focus:ring-4 focus:ring-blue-300 focus:outline-none w-full flex items-center justify-center">
                          <FiUpload className="mr-2 text-xl sm:text-2xl" /> <span className="truncate">Upload Dataset</span>
                        </Button>
                      </Link>
                      <Link href="/datasets/join" className="w-full sm:w-auto flex-1 flex justify-center">
                        <Button className="min-w-[180px] px-6 py-4 text-base sm:text-lg bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-pink-600 hover:to-indigo-600 transition-all duration-200 text-white shadow-xl font-bold rounded-full transform hover:scale-105 focus:ring-4 focus:ring-pink-300 focus:outline-none w-full flex items-center justify-center">
                          <FiPlusCircle className="mr-2 text-xl sm:text-2xl" /> <span className="truncate">Join Dataset</span>
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Section: My Datasets */}
                  <div>
                    <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">My Datasets</h2>
                    {myDatasets.length === 0 ? (
                      <div className="text-gray-500 dark:text-gray-400 italic mb-6">You have not uploaded any datasets yet.</div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {myDatasets.map((dataset) => {
                          const datasetProgress = progress.find((p: LabelProgress) => p.dataset_id === dataset.id);
                          const labelersData = datasetLabelers[dataset.id];
                          return (
                            <Card key={dataset.id} className="backdrop-blur-sm bg-white/80 dark:bg-gray-800/80 border border-white/20 dark:border-gray-700/50 shadow-lg hover:shadow-xl transition-all overflow-hidden rounded-xl">
                              <div className="absolute top-0 left-0 h-1.5 w-full bg-gradient-to-r from-blue-500 to-indigo-500"></div>
                              <CardHeader className="pb-3">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <CardTitle className="text-gray-900 dark:text-white font-bold text-lg">{dataset.name}</CardTitle>
                                  <Badge variant="success" className="text-xs py-1 px-2">Owner</Badge>
                                </div>
                                <CardDescription className="text-gray-600 dark:text-gray-300 text-sm line-clamp-2 min-h-[2.5rem]">
                                  {dataset.description || 'No description provided'}
                                </CardDescription>
                              </CardHeader>
                              <CardContent>
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <FiBox className="text-gray-500 dark:text-gray-400" />
                                      <span className="text-sm text-gray-700 dark:text-gray-300">
                                        {dataset.total_entries} entries
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <FiActivity className="text-gray-500 dark:text-gray-400" />
                                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                                        {datasetProgress ? datasetProgress.completed : 0}/{dataset.total_entries}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="text-gray-600 dark:text-gray-400">Progress</span>
                                      <span className="font-medium text-gray-900 dark:text-white">
                                        {getProgressForDataset(dataset.id)}%
                                      </span>
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                      <div 
                                        className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full" 
                                        style={{ width: `${getProgressForDataset(dataset.id)}%` }}
                                      ></div>
                                    </div>
                                  </div>
                                  
                                  {/* Labelers Progress Section */}
                                  {labelersData && labelersData.users.length > 0 && (
                                    <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-2">
                                      <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                                          <FiUsers className="mr-1.5" size={14} /> Labelers Progress
                                        </h4>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                          {labelersData.users.length} {labelersData.users.length === 1 ? 'labeler' : 'labelers'}
                                        </span>
                                      </div>
                                      <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                                        {labelersData.users.map((labelerUser) => {
                                          const labelerProgress = labelersData.progress.find(p => p.user_id === labelerUser.id);
                                          const progressPercent = labelerProgress 
                                            ? calculateProgress(labelerProgress.completed, labelerProgress.total)
                                            : 0;
                                          
                                          return (
                                            <div key={labelerUser.id} className="flex items-center justify-between text-xs">
                                              <div className="flex items-center truncate">
                                                <div className="bg-indigo-100 dark:bg-indigo-900/30 h-5 w-5 rounded-full flex items-center justify-center text-indigo-700 dark:text-indigo-300 mr-2 font-medium text-[10px]">
                                                  {labelerUser.username.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-gray-600 dark:text-gray-400 truncate">
                                                  {labelerUser.username}
                                                </span>
                                              </div>
                                              <div className="flex items-center">
                                                <span className="text-gray-900 dark:text-white mr-2">
                                                  {labelerProgress?.completed || 0}/{dataset.total_entries}
                                                </span>
                                                <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                                  <div 
                                                    className={`h-1.5 rounded-full ${
                                                      progressPercent >= 80 ? 'bg-green-500' : 
                                                      progressPercent >= 40 ? 'bg-blue-500' : 'bg-red-500'
                                                    }`}
                                                    style={{ width: `${progressPercent}%` }}
                                                  ></div>
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                  
                                  <div className="flex gap-2 pt-1">
                                    <Link href={`/datasets/${dataset.id}`} className="flex-1">
                                      <Button className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white shadow-md hover:shadow-lg transition-all cursor-pointer">
                                        View Details <FiChevronRight className="ml-2" />
                                      </Button>
                                    </Link>
                                    <Link href={`/labeling/${dataset.id}`} className="flex-1">
                                      <Button className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-md hover:shadow-lg transition-all cursor-pointer">
                                        Continue <FiTag className="ml-2" />
                                      </Button>
                                    </Link>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {/* Section: Invited Datasets */}
                  <div>
                    <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Invited Datasets</h2>
                    {invitedDatasets.filter(dataset => dataset.owner_id !== user.id).length === 0 ? (
                      <div className="text-gray-500 dark:text-gray-400 italic mb-6">You have not joined any datasets yet.</div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {invitedDatasets
                          .filter(dataset => dataset.owner_id !== user.id)
                          .map((dataset) => {
                            const datasetProgress = progress.find((p: LabelProgress) => p.dataset_id === dataset.id);
                            const labelersData = datasetLabelers[dataset.id];
                            return (
                              <Card key={dataset.id} className="backdrop-blur-sm bg-white/80 dark:bg-gray-800/80 border border-white/20 dark:border-gray-700/50 shadow-lg hover:shadow-xl transition-all overflow-hidden rounded-xl">
                                <div className="absolute top-0 left-0 h-1.5 w-full bg-gradient-to-r from-green-500 to-emerald-500"></div>
                                <CardHeader className="pb-3">
                                  <div className="flex items-start justify-between gap-2 mb-2">
                                    <CardTitle className="text-gray-900 dark:text-white font-bold text-lg">{dataset.name}</CardTitle>
                                    <Badge variant="secondary" className="text-xs py-1 px-2">Joined</Badge>
                                  </div>
                                  <CardDescription className="text-gray-600 dark:text-gray-300 text-sm line-clamp-2 min-h-[2.5rem]">
                                    {dataset.description || 'No description provided'}
                                  </CardDescription>
                                </CardHeader>
                                <CardContent>
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <FiBox className="text-gray-500 dark:text-gray-400" />
                                        <span className="text-sm text-gray-700 dark:text-gray-300">
                                          {dataset.total_entries} entries
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <FiActivity className="text-gray-500 dark:text-gray-400" />
                                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                                          {datasetProgress ? datasetProgress.completed : 0}/{dataset.total_entries}
                                        </span>
                                      </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600 dark:text-gray-400">Progress</span>
                                        <span className="font-medium text-gray-900 dark:text-white">
                                          {getProgressForDataset(dataset.id)}%
                                        </span>
                                      </div>
                                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                        <div 
                                          className={`h-2 rounded-full ${getProgressForDataset(dataset.id) >= 80 ? 'bg-gradient-to-r from-green-500 to-emerald-500' : getProgressForDataset(dataset.id) >= 40 ? 'bg-gradient-to-r from-blue-500 to-indigo-500' : 'bg-gradient-to-r from-red-500 to-orange-500'}`}
                                          style={{ width: `${getProgressForDataset(dataset.id)}%` }}
                                        ></div>
                                      </div>
                                    </div>
                                    
                                    {/* Labelers Progress Section for joined datasets */}
                                    {labelersData && labelersData.users.length > 0 && (
                                      <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-2">
                                        <div className="flex items-center justify-between mb-2">
                                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                                            <FiUsers className="mr-1.5" size={14} /> Labelers Progress
                                          </h4>
                                          <span className="text-xs text-gray-500 dark:text-gray-400">
                                            {labelersData.users.length} {labelersData.users.length === 1 ? 'labeler' : 'labelers'}
                                          </span>
                                        </div>
                                        <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                                          {labelersData.users.map((labelerUser) => {
                                            const labelerProgress = labelersData.progress.find(p => p.user_id === labelerUser.id);
                                            const progressPercent = labelerProgress 
                                              ? calculateProgress(labelerProgress.completed, labelerProgress.total)
                                              : 0;
                                            
                                            return (
                                              <div key={labelerUser.id} className="flex items-center justify-between text-xs">
                                                <div className="flex items-center truncate">
                                                  <div className="bg-indigo-100 dark:bg-indigo-900/30 h-5 w-5 rounded-full flex items-center justify-center text-indigo-700 dark:text-indigo-300 mr-2 font-medium text-[10px]">
                                                    {labelerUser.username.charAt(0).toUpperCase()}
                                                  </div>
                                                  <span className="text-gray-600 dark:text-gray-400 truncate">
                                                    {labelerUser.username}
                                                  </span>
                                                </div>
                                                <div className="flex items-center">
                                                  <span className="text-gray-900 dark:text-white mr-2">
                                                    {labelerProgress?.completed || 0}/{dataset.total_entries}
                                                  </span>
                                                  <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                                    <div 
                                                      className={`h-1.5 rounded-full ${
                                                        progressPercent >= 80 ? 'bg-green-500' : 
                                                        progressPercent >= 40 ? 'bg-blue-500' : 'bg-red-500'
                                                      }`}
                                                      style={{ width: `${progressPercent}%` }}
                                                    ></div>
                                                  </div>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                    
                                    <div className="flex gap-2 pt-1">
                                      <Link href={`/datasets/${dataset.id}`} className="flex-1">
                                        <Button className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white shadow-md hover:shadow-lg transition-all cursor-pointer">
                                          View Details <FiChevronRight className="ml-2" />
                                        </Button>
                                      </Link>
                                      <Link href={`/labeling/${dataset.id}`} className="flex-1">
                                        <Button className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-md hover:shadow-lg transition-all cursor-pointer">
                                          Continue <FiTag className="ml-2" />
                                        </Button>
                                      </Link>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}