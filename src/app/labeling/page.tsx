'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import { FiSearch, FiTag, FiClock, FiEdit, FiArrowRight, FiCheck, FiAlertCircle, FiCheckCircle, FiRefreshCw, FiInfo, FiLoader } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// Local Badge component
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
              Loading Labeling Tasks...
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

interface LabelingTask {
  id: string;
  dataset_id: string;
  dataset_name: string;
  total_entries: number;
  completed: number;
  created_at: string;
  owner_username: string;
}

export default function LabelingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<LabelingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLabelingTasks = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch progress records for this user
      const { data: progressData, error: progressError } = await supabase
        .from('label_progress')
        .select('*')
        .eq('user_id', user?.id);
      
      if (progressError) throw progressError;
      
      // Fetch dataset details for each progress record
      const datasetIds = progressData?.map(p => p.dataset_id) || [];
      
      if (datasetIds.length === 0) {
        setTasks([]);
        return;
      }
      
      const { data: datasetsData, error: datasetsError } = await supabase
        .from('datasets')
        .select('*, users!datasets_owner_id_fkey(username)')
        .in('id', datasetIds)
        .eq('is_active', true); // Only show active datasets
      
      if (datasetsError) throw datasetsError;
      
      // Combine data - only include progress for active datasets
      const activeDatasetIds = datasetsData?.map(d => d.id) || [];
      const combinedTasks = progressData?.map(progress => {
        // Only process progress for active datasets
        if (!activeDatasetIds.includes(progress.dataset_id)) {
          return null; // Will be filtered out
        }
        
        const dataset = datasetsData?.find(d => d.id === progress.dataset_id);
        return {
          id: progress.id,
          dataset_id: progress.dataset_id,
          dataset_name: dataset?.name || 'Unknown Dataset',
          total_entries: progress.total,
          completed: progress.completed,
          created_at: progress.created_at,
          owner_username: dataset?.users?.username || 'Unknown',
        };
      }).filter(task => task !== null) || [];
      
      setTasks(combinedTasks);
    } catch (error) {
      console.error('Error fetching labeling tasks:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      fetchLabelingTasks();
    }
  }, [user, fetchLabelingTasks]);

  const refreshData = async () => {
    setRefreshing(true);
    await fetchLabelingTasks();
    setTimeout(() => setRefreshing(false), 800);
  };

  const calculateProgressPercent = (completed: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((completed / total) * 100);
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 80) return 'bg-gradient-to-r from-green-400 to-green-600';
    if (percent >= 40) return 'bg-gradient-to-r from-blue-400 to-indigo-600';
    return 'bg-gradient-to-r from-amber-400 to-orange-600';
  };

  const getProgressStatusIcon = (percent: number) => {
    if (percent === 100) return <FiCheckCircle className="text-green-500 dark:text-green-400" />;
    if (percent >= 50) return <FiClock className="text-blue-500 dark:text-blue-400" />;
    return <FiEdit className="text-amber-500 dark:text-amber-400" />;
  };

  const getProgressStatusText = (percent: number) => {
    if (percent === 100) return 'Completed';
    if (percent >= 50) return 'In progress';
    return 'Just started';
  }

  if (loading) {
    return <LoadingScreen />;
  }

  // Pisahkan tasks menjadi milik sendiri dan join
  const myDatasets = tasks.filter(task => user && task.owner_username === user.username);
  const joinedDatasets = tasks.filter(task => !user || task.owner_username !== user.username);

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
                Labeling Dashboard
              </motion.h1>
              <div className="mt-2 text-gray-600 dark:text-gray-300">
                Join and manage your labeling tasks
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="backdrop-blur-sm bg-white/70 dark:bg-gray-800/70 rounded-lg shadow-lg p-4 border border-white/20 dark:border-gray-700/50 flex justify-between items-center"
        >
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Your Tasks</h2>
            <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-100 border-white/20 dark:border-gray-700/50 shadow-sm">
              {tasks.length} Active
            </Badge>
          </div>
          
          <Button 
            onClick={refreshData}
            className="relative border-white/20 dark:border-gray-700/50 hover:border-indigo-300 dark:hover:border-indigo-700 bg-white/70 dark:bg-gray-800/70 text-gray-700 dark:text-gray-300 backdrop-blur-sm shadow-sm"
            disabled={refreshing}
          >
            <FiRefreshCw className={`mr-2 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </motion.div>

        {tasks.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="backdrop-blur-sm bg-white/70 dark:bg-gray-800/70 rounded-xl shadow-lg border border-white/20 dark:border-gray-700/50 p-8"
          >
            <div className="text-center">
              <div className="h-24 w-24 mx-auto bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg mb-6 rotate-3">
                <FiSearch className="text-white h-10 w-10" />
              </div>
              <h3 className="text-xl font-medium bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">No labeling tasks yet</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                Click the button below to join a dataset and start labeling, or ask a dataset owner for an invite code.
              </p>
              <Link href="/datasets/join">
                  <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg hover:shadow-xl transition-all">
                      Join a Dataset
                  </Button>
              </Link>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-10 pb-10">
            {/* Section: Datasets Saya */}
            <div>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Datasets Saya</h2>
              {myDatasets.length === 0 ? (
                <div className="text-gray-500 dark:text-gray-400 italic mb-6">Belum ada dataset yang Anda miliki.</div>
              ) : (
                <div className="space-y-5">
                  {myDatasets.map((task, index) => {
                    const progressPercent = calculateProgressPercent(task.completed, task.total_entries);
                    const progressColor = getProgressColor(progressPercent);
                    const remainingItems = task.total_entries - task.completed;
                    return (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        whileHover={{ y: -5, scale: 1.02 }}
                        className="transform transition-all duration-300"
                      >
                        <Card className="backdrop-blur-sm bg-white/70 dark:bg-gray-800/70 border border-white/20 dark:border-gray-700/50 shadow-lg hover:shadow-xl transition-all overflow-hidden">
                          <div className={`h-1 w-full ${progressColor}`}></div>
                          <CardHeader className="pb-2">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <CardTitle className="text-gray-900 dark:text-white font-bold">{task.dataset_name}</CardTitle>
                                  <Badge variant="success" className="ml-2">Owner</Badge>
                                </div>
                                <CardDescription className="flex items-center flex-wrap gap-1 mt-1">
                                  {getProgressStatusIcon(progressPercent)}
                                  <span className="text-gray-600 dark:text-gray-300">{getProgressStatusText(progressPercent)}</span>
                                  <Badge 
                                    variant={progressPercent === 100 ? 'success' : progressPercent >= 50 ? 'default' : 'secondary'} 
                                    className="ml-2 shadow-sm"
                                  >
                                    {progressPercent}% complete
                                  </Badge>
                                  <span className="ml-3 text-gray-500 dark:text-gray-400">
                                    Owner: <span className="font-medium">{task.owner_username}</span>
                                  </span>
                                </CardDescription>
                              </div>
                              <Link href={`/labeling/${task.dataset_id}`}>
                                <Button 
                                  className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white shadow-md hover:shadow-lg transition-all"
                                >
                                  <div className="flex items-center">
                                    {progressPercent === 100 ? 'Review Labels' : 'Continue Labeling'} 
                                    <FiArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                                  </div>
                                </Button>
                              </Link>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              <div>
                                <div className="flex justify-between text-sm mb-1 font-medium">
                                  <span className="text-gray-700 dark:text-gray-300">Progress</span>
                                  <span className="text-gray-900 dark:text-gray-100">
                                    <span className="font-bold">{task.completed}</span> of {task.total_entries} labeled
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progressPercent}%` }}
                                    transition={{ duration: 1, delay: 0.2 }}
                                    className={`${progressColor} h-2.5 rounded-full`}
                                  ></motion.div>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="flex items-center p-3 backdrop-blur-sm bg-white/50 dark:bg-gray-800/50 rounded-lg border border-white/20 dark:border-gray-700/50 shadow-sm">
                                  <div className={`w-8 h-8 flex items-center justify-center rounded-full ${progressPercent === 100 ? 'bg-gradient-to-br from-green-400 to-green-600 text-white' : 'bg-gradient-to-br from-blue-400 to-indigo-600 text-white'}`}>
                                    {progressPercent === 100 ? <FiCheck /> : <FiEdit />}
                                  </div>
                                  <div className="ml-3">
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">{task.completed}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">Labels completed</div>
                                  </div>
                                </div>
                                
                                <div className="flex items-center p-3 backdrop-blur-sm bg-white/50 dark:bg-gray-800/50 rounded-lg border border-white/20 dark:border-gray-700/50 shadow-sm">
                                  <div className={`w-8 h-8 flex items-center justify-center rounded-full ${remainingItems === 0 ? 'bg-gradient-to-br from-green-400 to-green-600 text-white' : 'bg-gradient-to-br from-amber-400 to-orange-600 text-white'}`}>
                                    {remainingItems === 0 ? <FiCheckCircle /> : <FiClock />}
                                  </div>
                                  <div className="ml-3">
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                                      {remainingItems === 0 ? 'All done!' : `${remainingItems} remaining`}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      {remainingItems === 0 ? 'Completed' : 'Labels to go'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
            {/* Section: Datasets Joined */}
            <div>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Datasets Joined</h2>
              {joinedDatasets.length === 0 ? (
                <div className="text-gray-500 dark:text-gray-400 italic mb-6">Belum ada dataset yang Anda ikuti.</div>
              ) : (
                <div className="space-y-5">
                  {joinedDatasets.map((task, index) => {
                    const progressPercent = calculateProgressPercent(task.completed, task.total_entries);
                    const progressColor = getProgressColor(progressPercent);
                    const remainingItems = task.total_entries - task.completed;
                    return (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        whileHover={{ y: -5, scale: 1.02 }}
                        className="transform transition-all duration-300"
                      >
                        <Card className="backdrop-blur-sm bg-white/70 dark:bg-gray-800/70 border border-white/20 dark:border-gray-700/50 shadow-lg hover:shadow-xl transition-all overflow-hidden">
                          <div className={`h-1 w-full ${progressColor}`}></div>
                          <CardHeader className="pb-2">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <CardTitle className="text-gray-900 dark:text-white font-bold">{task.dataset_name}</CardTitle>
                                  <Badge variant="secondary" className="ml-2">Joined</Badge>
                                </div>
                                <CardDescription className="flex items-center flex-wrap gap-1 mt-1">
                                  {getProgressStatusIcon(progressPercent)}
                                  <span className="text-gray-600 dark:text-gray-300">{getProgressStatusText(progressPercent)}</span>
                                  <Badge 
                                    variant={progressPercent === 100 ? 'success' : progressPercent >= 50 ? 'default' : 'secondary'} 
                                    className="ml-2 shadow-sm"
                                  >
                                    {progressPercent}% complete
                                  </Badge>
                                  <span className="ml-3 text-gray-500 dark:text-gray-400">
                                    Owner: <span className="font-medium">{task.owner_username}</span>
                                  </span>
                                </CardDescription>
                              </div>
                              <Link href={`/labeling/${task.dataset_id}`}>
                                <Button 
                                  className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white shadow-md hover:shadow-lg transition-all"
                                >
                                  <div className="flex items-center">
                                    {progressPercent === 100 ? 'Review Labels' : 'Continue Labeling'} 
                                    <FiArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                                  </div>
                                </Button>
                              </Link>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              <div>
                                <div className="flex justify-between text-sm mb-1 font-medium">
                                  <span className="text-gray-700 dark:text-gray-300">Progress</span>
                                  <span className="text-gray-900 dark:text-gray-100">
                                    <span className="font-bold">{task.completed}</span> of {task.total_entries} labeled
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progressPercent}%` }}
                                    transition={{ duration: 1, delay: 0.2 }}
                                    className={`${progressColor} h-2.5 rounded-full`}
                                  ></motion.div>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="flex items-center p-3 backdrop-blur-sm bg-white/50 dark:bg-gray-800/50 rounded-lg border border-white/20 dark:border-gray-700/50 shadow-sm">
                                  <div className={`w-8 h-8 flex items-center justify-center rounded-full ${progressPercent === 100 ? 'bg-gradient-to-br from-green-400 to-green-600 text-white' : 'bg-gradient-to-br from-blue-400 to-indigo-600 text-white'}`}>
                                    {progressPercent === 100 ? <FiCheck /> : <FiEdit />}
                                  </div>
                                  <div className="ml-3">
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">{task.completed}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">Labels completed</div>
                                  </div>
                                </div>
                                
                                <div className="flex items-center p-3 backdrop-blur-sm bg-white/50 dark:bg-gray-800/50 rounded-lg border border-white/20 dark:border-gray-700/50 shadow-sm">
                                  <div className={`w-8 h-8 flex items-center justify-center rounded-full ${remainingItems === 0 ? 'bg-gradient-to-br from-green-400 to-green-600 text-white' : 'bg-gradient-to-br from-amber-400 to-orange-600 text-white'}`}>
                                    {remainingItems === 0 ? <FiCheckCircle /> : <FiClock />}
                                  </div>
                                  <div className="ml-3">
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                                      {remainingItems === 0 ? 'All done!' : `${remainingItems} remaining`}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      {remainingItems === 0 ? 'Completed' : 'Labels to go'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

