'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Dataset, LabelProgress, User, LabelOption } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'react-hot-toast';
import { formatDate, calculateProgress, cn } from '@/lib/utils';
import { FiUsers, FiDownload, FiShare2, FiCopy, FiTag, FiBarChart, FiTrash2, FiAlertTriangle, FiCalendar, FiDatabase, FiClock, FiCheck, FiEdit, FiPieChart, FiInfo } from 'react-icons/fi';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

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

interface DatasetDetailsClientProps {
  id: string;
}

export default function DatasetDetailsClient({ id }: DatasetDetailsClientProps) {
  const { user } = useAuth();
  const router = useRouter();
  
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [progressData, setProgressData] = useState<LabelProgress[]>([]);
  const [invitedUsers, setInvitedUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [showInviteCode, setShowInviteCode] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [exportFormat, setExportFormat] = useState<'text' | 'numeric'>('text');
  const [exportColumns, setExportColumns] = useState<Record<string, boolean>>({
    text: true,
    final_sentiment: true,
    score: false,
    labelers: false,
    consensus: false,
    agreement_percentage: false,
    majority_label: false
  });
  
  const checkUserJoinedDataset = useCallback(async (datasetId: string, userId: string | undefined) => {
    if (!userId) return false;
    
    try {
      const { data, error } = await supabase
        .from('label_progress')
        .select('id')
        .eq('dataset_id', datasetId)
        .eq('user_id', userId)
        .single();
      
      return !!data; // Returns true if data exists, false otherwise
    } catch (error) {
      return false; // Return false on error
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
      
      setIsAdmin(data?.is_admin || false);
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    }
  }, [user?.id]);
  
 const fetchDatasetDetails = useCallback(async () => {
    try {
      setLoading(true);
      
      const { data: datasetData, error: datasetError } = await supabase
        .from('datasets')
        .select('*')
        .eq('id', id)
        .single();
      
      if (datasetError) throw datasetError;
      
      // Check if user is owner, admin, or has joined the dataset
      const isOwner = datasetData.owner_id === user?.id;
      const isJoinedUser = await checkUserJoinedDataset(id, user?.id);
      
      if (!isOwner && !isAdmin && !isJoinedUser) {
        toast.error('You do not have permission to view this dataset');
        router.push('/datasets');
        return;
      }

      const { data: progress, error: progressError } = await supabase
        .from('label_progress')
        .select('*')
        .eq('dataset_id', id);

      if (progressError) throw progressError;

      const userIds = progress?.map(p => p.user_id) || [];
      let usersData: User[] = [];

      if (userIds.length > 0) {
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('*')
          .in('id', userIds);
        
        if (usersError) throw usersError;
        usersData = users || [];
      }

      // Backfill start_date and last_updated from labels if they're missing
      for (const p of progress || []) {
        if (!p.start_date && p.completed > 0) {
          const { data: firstLabel, error: firstLabelError } = await supabase
            .from('dataset_labels')
            .select('created_at')
            .eq('dataset_id', id)
            .eq('user_id', p.user_id)
            .order('created_at', { ascending: true })
            .limit(1)
            .single();
          
          if (firstLabel) {
            p.start_date = firstLabel.created_at;
            // Also update it in the database so we don't have to do this again
            await supabase
              .from('label_progress')
              .update({ start_date: firstLabel.created_at })
              .eq('id', p.id);
          }
        }

        // Backfill last_updated from the latest label if it's missing
        if (!p.last_updated && p.completed > 0) {
          const { data: latestLabel, error: latestLabelError } = await supabase
            .from('dataset_labels')
            .select('created_at')
            .eq('dataset_id', id)
            .eq('user_id', p.user_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          
          if (latestLabel) {
            p.last_updated = latestLabel.created_at;
            // Also update it in the database so we don't have to do this again
            await supabase
              .from('label_progress')
              .update({ last_updated: latestLabel.created_at })
              .eq('id', p.id);
          }
        }
      }

      setDataset(datasetData);
      setProgressData(progress || []);
      setInvitedUsers(usersData);
    } catch (error) {
      console.error('Error fetching dataset details:', error);
      toast.error('Failed to load dataset details');
    } finally {
      setLoading(false);
    }
  }, [id, user?.id, isAdmin, router, checkUserJoinedDataset]);

  useEffect(() => {
    if (user) {
      fetchDatasetDetails();
      checkAdminStatus();
    }
  }, [user, id, fetchDatasetDetails, checkAdminStatus]);
  
  const copyInviteCode = () => {
    if (!dataset) return;
    
    navigator.clipboard.writeText(dataset.invite_code)
      .then(() => {
        toast.success('Invite code copied to clipboard');
      })
      .catch(() => {
        toast.error('Failed to copy invite code');
      });
  };
  
  const handleDeleteDataset = async () => {
    if (!dataset) return;
    
    try {
      setDeleteLoading(true);
      
      const { error: labelsError } = await supabase.from('dataset_labels').delete().eq('dataset_id', id);
      if (labelsError) throw labelsError;
      
      const { error: entriesError } = await supabase.from('dataset_entries').delete().eq('dataset_id', id);
      if (entriesError) throw entriesError;
      
      const { error: progressError } = await supabase.from('label_progress').delete().eq('dataset_id', id);
      if (progressError) throw progressError;
      
      const { error: datasetError } = await supabase.from('datasets').delete().eq('id', id);
      if (datasetError) throw datasetError;
      
      if (dataset.file_path) {
        const { error: storageError } = await supabase.storage.from('csvfiles').remove([dataset.file_path]);
        if (storageError) console.error('Failed to delete CSV file:', storageError);
      }
      
      toast.success('Dataset deleted successfully');
      router.push('/datasets');
    } catch (error) {
      console.error('Error deleting dataset:', error);
      toast.error('Failed to delete dataset');
    } finally {
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
    }
  };
  
  const handleExport = async () => {
    try {
      setExportLoading(true);
      
      // Fetch all entries using pagination to avoid limit issues
      let allEntries: any[] = [];
      let entriesError: any = null;
      let currentRangeStart = 0;
      const batchSize = 1000;
      
      while (true) {
        const { data: batchEntries, error: batchError } = await supabase
          .from('dataset_entries')
          .select('*')
          .eq('dataset_id', id)
          .range(currentRangeStart, currentRangeStart + batchSize - 1);
        
        if (batchError) {
          entriesError = batchError;
          break;
        }
        
        if (!batchEntries || batchEntries.length === 0) {
          break;
        }
        
        allEntries = [...allEntries, ...batchEntries];
        
        // If we got less than the batch size, we've reached the end
        if (batchEntries.length < batchSize) {
          break;
        }
        
        currentRangeStart += batchSize;
      }
      
      if (entriesError) throw entriesError;
      
      const entries = allEntries;
      
      // Fetch all labels for this dataset using pagination
      let allLabels: any[] = [];
      let labelsError: any = null;
      let currentLabelRangeStart = 0;
      const labelBatchSize = 1000;
      
      while (true) {
        const { data: batchLabels, error: batchError } = await supabase
          .from('dataset_labels')
          .select('*')
          .eq('dataset_id', id)
          .range(currentLabelRangeStart, currentLabelRangeStart + labelBatchSize - 1);
        
        if (batchError) {
          labelsError = batchError;
          break;
        }
        
        if (!batchLabels || batchLabels.length === 0) {
          break;
        }
        
        allLabels = [...allLabels, ...batchLabels];
        
        // If we got less than the batch size, we've reached the end
        if (batchLabels.length < labelBatchSize) {
          break;
        }
        
        currentLabelRangeStart += labelBatchSize;
      }
      
      if (labelsError) throw labelsError;
      
      const labels = allLabels;
      
      // Fetch all users who labeled this dataset using pagination if needed
      const userIds = [...new Set(labels.map(label => label.user_id))];
      let usersData: Record<string, User> = {};
      
      if (userIds.length > 0) {
        // Split userIds into batches to avoid query limits
        const userBatchSize = 100;
        let allUsers: User[] = [];
        
        for (let i = 0; i < userIds.length; i += userBatchSize) {
          const batchUserIds = userIds.slice(i, i + userBatchSize);
          const { data: users, error: usersError } = await supabase
            .from('users')
            .select('*')
            .in('id', batchUserIds);
          
          if (usersError) throw usersError;
          
          if (users) {
            allUsers = [...allUsers, ...users];
          }
        }
        
        usersData = allUsers.reduce<Record<string, User>>((acc, user) => {
          acc[user.id] = user;
          return acc;
        }, {});
      }
      
      // Filter out 'delete' labels for all exports
      const filteredLabels = labels.filter(label => label.label !== 'delete');
      
      const csvRows = entries?.map((entry, index) => {
        const entryLabels = filteredLabels.filter(l => l.entry_id === entry.id) || [];
        const row: Record<string, any> = { text: entry.text, score: entry.score };
        const labelValues = new Set<string>();
        
        // Add individual labeler columns
        entryLabels.forEach((label, labelIndex) => {
          const username = usersData[label.user_id]?.username || 'unknown';
          if (exportFormat === 'numeric') {
            let numericLabel: number;
            if (dataset?.labeling_type === 'binary') {
              // For binary datasets: 1 = positive, 0 = negative
              switch (label.label) {
                case 'positive': numericLabel = 1; break;
                case 'negative': numericLabel = 0; break;
                default: numericLabel = 0; // neutral should not occur in binary datasets
              }
            } else {
              // For multi-class datasets: 2 = positive, 1 = neutral, 0 = negative
              switch (label.label) {
                case 'positive': numericLabel = 2; break;
                case 'neutral': numericLabel = 1; break;
                case 'negative': numericLabel = 0; break;
                default: numericLabel = 1;
              }
            }
            row[`label_${username}`] = numericLabel;
            labelValues.add(String(numericLabel));
          } else {
            row[`label_${username}`] = label.label;
            labelValues.add(String(label.label));
          }
        });
        
        // Individual labeler columns are already added above
        
        let majorityLabelValue: string | number = '';
        
        if (entryLabels.length > 1) {
          row['consensus'] = labelValues.size === 1 ? 'YES' : 'NO';
          const majorityLabel = getMajorityLabel(entryLabels);
          const agreementCount = entryLabels.filter(l => l.label === majorityLabel).length;
          const agreementPercentage = Math.round((agreementCount / entryLabels.length) * 100);
          row['agreement_percentage'] = `${agreementPercentage}%`;
          majorityLabelValue = exportFormat === 'numeric' 
            ? convertLabelToNumeric(majorityLabel as LabelOption, dataset?.labeling_type === 'binary') 
            : majorityLabel;
          row['majority_label'] = majorityLabelValue;
        } else if (entryLabels.length === 1) {
          row['consensus'] = 'SINGLE';
          row['agreement_percentage'] = '100%';
          majorityLabelValue = exportFormat === 'numeric' 
            ? convertLabelToNumeric(entryLabels[0].label as LabelOption, dataset?.labeling_type === 'binary') 
            : entryLabels[0].label;
          row['majority_label'] = majorityLabelValue;
        } else {
          row['consensus'] = 'UNLABELED';
          row['agreement_percentage'] = '0%';
          row['majority_label'] = '';
          majorityLabelValue = '';
        }
        
        // Add final_sentiment column based on majority_label
        if (majorityLabelValue !== '') {
          if (exportFormat === 'numeric') {
            // For numeric format: directly use the numeric value
            row['final_sentiment'] = majorityLabelValue;
          } else {
            // For text format: convert numeric back to text or use directly
            if (typeof majorityLabelValue === 'number') {
              switch (majorityLabelValue) {
                case 2:
                  row['final_sentiment'] = 'positive';
                  break;
                case 1:
                  row['final_sentiment'] = 'neutral';
                  break;
                case 0:
                  row['final_sentiment'] = 'negative';
                  break;
                default:
                  row['final_sentiment'] = 'neutral';
              }
            } else {
              row['final_sentiment'] = majorityLabelValue;
            }
          }
        } else {
          row['final_sentiment'] = '';
        }
        
        return row;
      });
      
      // Create headers in a specific order to ensure consistency
      let headers: string[] = [];
      if (csvRows && csvRows.length > 0) {
        // Filter headers based on selected export columns
        const allPossibleHeaders = [
          'text',
          'score',
          ...Array.from(new Set(csvRows.flatMap(row => Object.keys(row).filter(key => key.startsWith('label_'))))).sort(),
          'consensus',
          'agreement_percentage',
          'majority_label',
          'final_sentiment'
        ];
        
        // Only include headers that are selected for export
        headers = allPossibleHeaders.filter(header => {
          if (header === 'text' || header === 'score') {
            return exportColumns[header] || false;
          } else if (header.startsWith('label_')) {
            return exportColumns['labelers'];
          } else {
            return exportColumns[header] || false;
          }
        });
        
        // If no headers are selected, include the default ones
        if (headers.length === 0) {
          headers = ['text', 'final_sentiment'];
        }
      }
      
      // For binary datasets, ensure proper handling of final_sentiment
      if (dataset?.labeling_type === 'binary') {
        csvRows?.forEach(row => {
          // Ensure final_sentiment is properly converted for binary datasets
          if (exportFormat === 'numeric' && typeof row['final_sentiment'] === 'string') {
            switch (row['final_sentiment']) {
              case 'positive':
                row['final_sentiment'] = 1;
                break;
              case 'negative':
                row['final_sentiment'] = 0;
                break;
              default:
                // For binary datasets, neutral should be treated as empty
                row['final_sentiment'] = '';
                break;
            }
          } else if (exportFormat === 'text' && typeof row['final_sentiment'] === 'number') {
            switch (row['final_sentiment']) {
              case 1:
                row['final_sentiment'] = 'positive';
                break;
              case 0:
                row['final_sentiment'] = 'negative';
                break;
              default:
                row['final_sentiment'] = '';
                break;
            }
          }
        });
      }
      
      // For binary datasets, filter out neutral labels from the export
      if (dataset?.labeling_type === 'binary') {
        // For binary datasets, we want to include all rows that have been labeled
        // We don't need to filter out rows as we're ensuring only positive/negative labels are used
        const binaryFilteredRows = csvRows || [];
        
        // Update the CSV content with filtered rows
        const csvContent = [
          headers.join(','),
          ...binaryFilteredRows.map(row => 
            headers.map(header => {
              const value = row[header];
              if (value === null || value === undefined) return '';
              // For numeric values, we want to preserve the actual numeric value
              if (typeof value === 'number') return value.toString();
              if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`;
              return String(value);
            }).join(',')
          ) || []
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        const formatSuffix = exportFormat === 'numeric' ? '_numeric' : '_text';
        const labelingType = dataset?.labeling_type ?? 'multi_class';
        const typeSuffix = (labelingType as string) === 'binary' ? '_binary' : '_multiclass';
        link.setAttribute('download', `${dataset?.name || 'dataset'}_labeled${formatSuffix}${typeSuffix}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // For multi-class datasets, use the original export logic
        const csvContent = [
          headers.join(','),
          ...csvRows?.map(row => 
            headers.map(header => {
              const value = row[header];
              // Remove the special handling for 0 values to properly handle numeric export
              if (value === null || value === undefined) return '';
              // For numeric values, we want to preserve the actual numeric value
              if (typeof value === 'number') return value.toString();
              if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`;
              return String(value);
            }).join(',')
          ) || []
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        const formatSuffix = exportFormat === 'numeric' ? '_numeric' : '_text';
        const labelingType = dataset?.labeling_type ?? 'multi_class';
        const typeSuffix = (labelingType as string) === 'binary' ? '_binary' : '_multiclass';
        link.setAttribute('download', `${dataset?.name || 'dataset'}_labeled${formatSuffix}${typeSuffix}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      
      toast.success('Dataset exported successfully');
      setShowExportOptions(false);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export dataset');
    } finally {
      setExportLoading(false);
    }
  };
  
  const handleExportClick = () => {
    if (invitedUsers.length === 0) {
      toast.error('No labelers available to export data');
      return;
    }
    setShowExportOptions(true);
  };
  
  const getMajorityLabel = (labels: any[]): string => {
    const counts: Record<string, number> = {};
    labels.forEach(label => {
      const labelValue = label.label;
      counts[labelValue] = (counts[labelValue] || 0) + 1;
    });
    
    let majorityLabel = '';
    let maxCount = 0;
    Object.entries(counts).forEach(([label, count]) => {
      if (count > maxCount) {
        maxCount = count;
        majorityLabel = label;
      }
    });
    return majorityLabel;
  };
  
  const convertLabelToNumeric = (label: LabelOption, isBinary: boolean = false): number => {
    if (isBinary) {
      // For binary datasets: 1 = positive, 0 = negative
      switch (label) {
        case 'positive': return 1;
        case 'negative': return 0;
        default: return 0; // neutral should not occur in binary datasets, but default to 0
      }
    } else {
      // For multi-class datasets: 2 = positive, 1 = neutral, 0 = negative
      switch (label) {
        case 'positive': return 2;
        case 'neutral': return 1;
        case 'negative': return 0;
        default: return 1;
      }
    }
  };
  
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  
  if (!dataset) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full p-4 mb-4">
          <FiAlertTriangle size={32} />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Dataset Not Found</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          The dataset you are looking for doesn't exist or you don't have permission to view it.
        </p>
        <Button onClick={() => router.push('/datasets')}>
          Back to Datasets
        </Button>
      </div>
    );
  }
  
  const totalLabeled = progressData.reduce((sum, p) => sum + p.completed, 0);
  const isComplete = progressData.every(p => p.completed === dataset.total_entries);
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-8"
    >
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-lg p-6 text-white">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <motion.h1 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-3xl font-bold flex items-center gap-2"
            >
              {dataset.name}
              {dataset.is_active === false && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
                  Inactive
                </span>
              )}
            </motion.h1>
            <div className="flex items-center mt-2">
              <FiCalendar className="mr-2 opacity-70" />
              <p className="text-white/80">
                Created on {formatDate(dataset.created_at)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowInviteCode(!showInviteCode)}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              <FiShare2 className="mr-2" /> {showInviteCode ? 'Hide' : 'Show'} Invite Code
            </Button>
            <Button
              variant="outline"
              onClick={handleExportClick}
              disabled={invitedUsers.length === 0 || exportLoading}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              <FiDownload className="mr-2" /> Export Results
            </Button>
            {(dataset.owner_id === user?.id || isAdmin) && (
              <Button
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                className="bg-red-500/80 hover:bg-red-600 border-red-400"
              >
                <FiTrash2 className="mr-2" /> Delete Dataset
              </Button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
            <div className="flex items-center">
              <div className="p-2 bg-white/20 rounded-md mr-3">
                <FiDatabase className="text-white" size={20} />
              </div>
              <div>
                <div className="text-sm text-white/70">Total Entries</div>
                <div className="text-xl font-bold">{dataset.total_entries}</div>
              </div>
            </div>
          </div>
          <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
            <div className="flex items-center">
              <div className="p-2 bg-white/20 rounded-md mr-3">
                <FiUsers className="text-white" size={20} />
              </div>
              <div>
                <div className="text-sm text-white/70">Labelers</div>
                <div className="text-xl font-bold">{invitedUsers.length}</div>
              </div>
            </div>
          </div>
          <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
            <div className="flex items-center">
              <div className="p-2 bg-white/20 rounded-md mr-3">
                <FiClock className="text-white" size={20} />
              </div>
              <div>
                <div className="text-sm text-white/70">Status</div>
                <div className="text-xl font-bold flex items-center">
                  {invitedUsers.length === 0 ? (
                    <span className="bg-yellow-400/20 text-yellow-100 text-sm px-2 py-0.5 rounded-full flex items-center">
                      <FiClock className="mr-1" size={12} /> Awaiting Labelers
                    </span>
                  ) : progressData.some(p => p.completed < dataset.total_entries) ? (
                    <span className="bg-blue-400/20 text-blue-100 text-sm px-2 py-0.5 rounded-full flex items-center">
                      <FiEdit className="mr-1" size={12} /> In Progress
                    </span>
                  ) : (
                    <span className="bg-green-400/20 text-green-100 text-sm px-2 py-0.5 rounded-full flex items-center">
                      <FiCheck className="mr-1" size={12} /> Completed
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {dataset.description && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card className="overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-gray-800 dark:text-gray-200">
                <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded-md mr-3">
                  <FiEdit className="text-indigo-500" />
                </div>
                Description
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{dataset.description}</p>
          </CardContent>
        </Card>
        </motion.div>
      )}
      
      <AnimatePresence>
        {showInviteCode && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: "auto", marginTop: 32 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <Card className="border-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/10 overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-indigo-400"></div>
              <CardHeader className="pb-3">
                <CardTitle className="text-indigo-700 dark:text-indigo-400 flex items-center">
                  <FiShare2 className="mr-2" /> Invite Code
                </CardTitle>
                <CardDescription className="text-indigo-600/80 dark:text-indigo-400/80">
                  Share this code with others to invite them to label this dataset
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <Input
                    value={dataset.invite_code}
                    readOnly
                    className="pr-10 bg-white dark:bg-gray-800 border-indigo-200 dark:border-indigo-700 font-mono text-indigo-900 dark:text-indigo-100"
                  />
                  <button
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    onClick={copyInviteCode}
                    aria-label="Copy invite code"
                  >
                    <FiCopy size={18} />
                  </button>
                </div>
                <div className="mt-4 flex items-start bg-white/50 dark:bg-gray-800/50 p-3 rounded-md border border-indigo-100 dark:border-indigo-800">
                  <div className="text-indigo-500 mr-2 mt-0.5">
                    <FiInfo size={16} />
                  </div>
                  <p className="text-sm text-indigo-700 dark:text-indigo-300">
                    Anyone with this code can join your dataset and contribute to labeling. 
                    Their progress will appear in the Labelers section below.
                  </p>
                </div>
              </CardContent>
              <CardFooter className="bg-indigo-100/50 dark:bg-indigo-900/20 border-t border-indigo-200 dark:border-indigo-800">
                <Button
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  onClick={copyInviteCode}
                >
                  <FiCopy className="mr-2" /> Copy to Clipboard
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              className="w-full max-w-md"
            >
              <Card className="border-2 border-red-200 dark:border-red-800 bg-white dark:bg-gray-900 shadow-xl">
                <div className="absolute top-0 left-0 w-full h-1 bg-red-500"></div>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-full">
                      <FiAlertTriangle className="text-red-500" size={24} />
                    </div>
                    <div>
                      <CardTitle className="text-red-700 dark:text-red-400">
                        Delete Dataset
                      </CardTitle>
                      <CardDescription className="text-red-600/80 dark:text-red-400/80">
                        This action cannot be undone
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-gray-800 dark:text-gray-200">
                      Are you sure you want to delete <span className="font-semibold">"{dataset.name}"</span>?
                    </p>
                    <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-md border border-red-100 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
                      <ul className="list-disc list-inside space-y-1">
                        <li>All <strong>{dataset.total_entries}</strong> entries will be permanently deleted</li>
                        <li>All labels from <strong>{invitedUsers.length}</strong> labelers will be lost</li>
                        <li>All progress data will be erased</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <Button
                    variant="outline"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="border-gray-300 dark:border-gray-700"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteDataset}
                    isLoading={deleteLoading}
                    disabled={deleteLoading}
                    className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
                  >
                    <FiTrash2 className="mr-2" /> Delete Permanently
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {showExportOptions && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              className="w-full max-w-4xl"
            >
              <Card className="border-2 border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-900 shadow-xl">
                <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-full">
                      <FiDownload className="text-blue-500" size={24} />
                    </div>
                    <div>
                      <CardTitle className="text-blue-700 dark:text-blue-400">
                        Export Options
                      </CardTitle>
                      <CardDescription className="text-blue-600/80 dark:text-blue-400/80">
                        Choose the format and columns for your export
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-gray-700 dark:text-gray-300">
                      Select how you want the sentiment labels to appear in the exported CSV:
                    </p>
                    
                    {/* Display dataset labeling type */}
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex items-center">
                        <FiInfo className="text-blue-500 mr-2 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                            Dataset Type: {dataset?.labeling_type === 'binary' ? 'Binary' : 'Multi-Class'}
                          </p>
                          <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                            {dataset?.labeling_type === 'binary' 
                              ? 'This dataset uses binary labeling (positive, negative) without neutral options.' 
                              : 'This dataset uses multi-class labeling (positive, neutral, negative).'}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-[35%_65%] gap-6">
                      {/* Left Column - Format Selection */}
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">Label Format</h3>
                        <div className="space-y-3">
                          <div 
                            className={cn(
                              "border-2 rounded-lg p-4 cursor-pointer transition-all",
                              exportFormat === 'text' 
                                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" 
                                : "border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700"
                            )}
                            onClick={() => setExportFormat('text')}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <div className={cn(
                                  "w-4 h-4 rounded-full border-2",
                                  exportFormat === 'text' 
                                    ? "border-blue-500 bg-blue-500" 
                                    : "border-gray-400 dark:border-gray-600"
                                )}></div>
                                <span className="font-medium text-gray-900 dark:text-gray-100">Text Labels</span>
                              </div>
                              {dataset?.labeling_type === 'binary' ? (
                                <span className="text-sm text-gray-500 dark:text-gray-400">positive, negative</span>
                              ) : (
                                <span className="text-sm text-gray-500 dark:text-gray-400">positive, neutral, negative</span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 ml-6">
                              Export labels as human-readable text values
                            </p>
                          </div>
                          <div 
                            className={cn(
                              "border-2 rounded-lg p-4 cursor-pointer transition-all",
                              exportFormat === 'numeric' 
                                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" 
                                : "border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700"
                            )}
                            onClick={() => setExportFormat('numeric')}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <div className={cn(
                                  "w-4 h-4 rounded-full border-2",
                                  exportFormat === 'numeric' 
                                    ? "border-blue-500 bg-blue-500" 
                                    : "border-gray-400 dark:border-gray-600"
                                )}></div>
                                <span className="font-medium text-gray-900 dark:text-gray-100">Numeric Values</span>
                              </div>
                              {dataset?.labeling_type === 'binary' ? (
                                <span className="text-sm text-gray-500 dark:text-gray-400">1, 0</span>
                              ) : (
                                <span className="text-sm text-gray-500 dark:text-gray-400">2, 1, 0</span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 ml-6">
                              {dataset?.labeling_type === 'binary' ? (
                                "Export labels as numbers (1 = positive, 0 = negative)"
                              ) : (
                                "Export labels as numbers (2 = positive, 1 = neutral, 0 = negative)"
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Right Column - Column Selection */}
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">Select Columns to Export</h3>
                        <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto pr-2">
                          {/* Default Columns with single border */}
                          <div>
                            <div className="px-3 py-2 bg-blue-100 dark:bg-blue-800/30 border border-blue-300 dark:border-blue-700 rounded-t-lg">
                              <span className="text-xs font-medium text-blue-800 dark:text-blue-200">
                                Default Columns
                              </span>
                            </div>
                            <div className="border-2 border-blue-500 rounded-b-lg bg-blue-50 dark:bg-blue-900/20">
                              <div className="p-3">
                                <div className="flex items-start">
                                  <input
                                    type="checkbox"
                                    id="text-column"
                                    checked={exportColumns.text}
                                    onChange={(e) => setExportColumns(prev => ({ ...prev, text: e.target.checked }))}
                                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1 flex-shrink-0"
                                  />
                                  <div className="ml-3">
                                    <label htmlFor="text-column" className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                                      Text
                                    </label>
                                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                      The original text content
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-start mt-2">
                                  <input
                                    type="checkbox"
                                    id="final_sentiment-column"
                                    checked={exportColumns.final_sentiment}
                                    onChange={(e) => setExportColumns(prev => ({ ...prev, final_sentiment: e.target.checked }))}
                                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1 flex-shrink-0"
                                  />
                                  <div className="ml-3">
                                    <label htmlFor="final_sentiment-column" className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                                      Final Sentiment
                                    </label>
                                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                      The consensus label from all labelers
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Other Columns with single border and information */}
                          <div>
                            <div className="px-3 py-2 bg-gray-100 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-600 rounded-t-lg">
                              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                                Additional Columns (for datasets labeled by one or more persons)
                              </span>
                            </div>
                            <div className="border border-gray-200 dark:border-gray-700 rounded-b-lg hover:border-gray-300 dark:hover:border-gray-600">
                              <div className="p-3">
                                <div className="flex items-start">
                                  <input
                                    type="checkbox"
                                    id="score-column"
                                    checked={exportColumns.score}
                                    onChange={(e) => setExportColumns(prev => ({ ...prev, score: e.target.checked }))}
                                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1 flex-shrink-0"
                                  />
                                  <div className="ml-3">
                                    <label htmlFor="score-column" className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                                      Score
                                    </label>
                                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                      The original score (1-5) from the dataset
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-start mt-2">
                                  <input
                                    type="checkbox"
                                    id="labelers-column"
                                    checked={exportColumns.labelers}
                                    onChange={(e) => setExportColumns(prev => ({ ...prev, labelers: e.target.checked }))}
                                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1 flex-shrink-0"
                                  />
                                  <div className="ml-3">
                                    <label htmlFor="labelers-column" className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                                      Labelers
                                    </label>
                                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                      Individual labels from each labeler (label_username)
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-start mt-2">
                                  <input
                                    type="checkbox"
                                    id="consensus-column"
                                    checked={exportColumns.consensus}
                                    onChange={(e) => setExportColumns(prev => ({ ...prev, consensus: e.target.checked }))}
                                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1 flex-shrink-0"
                                  />
                                  <div className="ml-3">
                                    <label htmlFor="consensus-column" className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                                      Consensus
                                    </label>
                                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                      Whether all labelers agreed (YES/NO/SINGLE/UNLABELED)
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-start mt-2">
                                  <input
                                    type="checkbox"
                                    id="agreement_percentage-column"
                                    checked={exportColumns.agreement_percentage}
                                    onChange={(e) => setExportColumns(prev => ({ ...prev, agreement_percentage: e.target.checked }))}
                                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1 flex-shrink-0"
                                  />
                                  <div className="ml-3">
                                    <label htmlFor="agreement_percentage-column" className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                                      Agreement Percentage
                                    </label>
                                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                      Percentage of labelers that agreed on the majority label
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-start mt-2">
                                  <input
                                    type="checkbox"
                                    id="majority_label-column"
                                    checked={exportColumns.majority_label}
                                    onChange={(e) => setExportColumns(prev => ({ ...prev, majority_label: e.target.checked }))}
                                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1 flex-shrink-0"
                                  />
                                  <div className="ml-3">
                                    <label htmlFor="majority_label-column" className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                                      Majority Label
                                    </label>
                                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                      The most frequently assigned label
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <Button
                    variant="outline"
                    onClick={() => setShowExportOptions(false)}
                    className="border-gray-300 dark:border-gray-700"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleExport}
                    isLoading={exportLoading}
                    disabled={exportLoading}
                    className="bg-blue-600 hover:bg-blue-700 focus:ring-blue-500"
                  >
                    <FiDownload className="mr-2" /> Export
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
      >
        <Card className="overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-gray-800 dark:text-gray-200">
              <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-md mr-3">
                <FiUsers className="text-indigo-600" />
              </div>
              Labelers Progress
            </CardTitle>
            <CardDescription>
              Track the labeling progress of all participants
            </CardDescription>
          </CardHeader>
          <CardContent>
            {invitedUsers.length === 0 ? (
              <div className="text-center py-8 px-4">
                <div className="bg-indigo-100 dark:bg-indigo-900/30 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
                  <FiUsers className="text-indigo-500" size={28} />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  No Labelers Yet
                </h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6">
                  Share the invite code with other users to get them started on labeling your dataset.
                </p>
                <Button 
                  onClick={() => setShowInviteCode(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <FiShare2 className="mr-2" />
                  Show Invite Code
                </Button>
              </div>
            ) : (
              <div>
                <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between gap-4">
                  <div className="flex items-center">
                    <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full mr-3">
                      <FiCheck className="text-green-600" size={20} />
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Total Labels</div>
                      <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                        {totalLabeled}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-full mr-3">
                      <FiUsers className="text-blue-600" size={20} />
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Status</div>
                      <div>
                        {isComplete ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200">
                            <FiCheck className="mr-1" size={12} /> All Complete
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
                            <FiClock className="mr-1" size={12} /> In Progress
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {invitedUsers.map((invitedUser, index) => {
                    const userProgress = progressData.find(p => p.user_id === invitedUser.id);
                    const progressPercent = userProgress 
                      ? calculateProgress(userProgress.completed, userProgress.total)
                      : 0;
                    const progressColor = 
                      progressPercent === 100 ? "bg-green-500" :
                      progressPercent > 75 ? "bg-teal-500" :
                      progressPercent > 50 ? "bg-blue-500" :
                      progressPercent > 25 ? "bg-indigo-500" : "bg-purple-500";
                    return (
                      <motion.div 
                        key={invitedUser.id} 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        className="py-4"
                      >
                        <div className="flex flex-col sm:flex-row justify-between mb-2 gap-2">
                          <div className="flex items-center">
                            <div className="bg-indigo-100 dark:bg-indigo-900/30 h-8 w-8 rounded-full flex items-center justify-center text-indigo-700 dark:text-indigo-300 mr-3 font-medium">
                              {invitedUser.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 dark:text-gray-100">
                                {invitedUser.username}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {userProgress?.completed || 0} of {dataset.total_entries} labeled
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={cn(
                              "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium",
                              progressPercent === 100 
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200" 
                                : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
                            )}>
                              {progressPercent}% complete
                            </span>
                          </div>
                        </div>
                        <div className="relative w-full mt-2">
                          <div className="overflow-hidden h-2 text-xs flex rounded-full bg-gray-200 dark:bg-gray-700">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${progressPercent}%` }}
                              transition={{ duration: 1, delay: 0.2 + index * 0.05 }}
                              className={`${progressColor} h-full rounded-full`}
                            ></motion.div>
                          </div>
                        </div>
                        {userProgress && (
                          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div className="flex items-center text-xs">
                              <FiCalendar className="text-indigo-500 dark:text-indigo-400 mr-1.5" size={12} />
                              <span className="text-gray-600 dark:text-gray-400">
                                Started: {userProgress.start_date
                                  ? formatDate(userProgress.start_date)
                                  : 'Not started yet'}
                              </span>
                            </div>
                            <div className="flex items-center text-xs">
                              <FiClock className="text-indigo-500 dark:text-indigo-400 mr-1.5" size={12} />
                              <span className="text-gray-600 dark:text-gray-400">
                                Last Updated: {userProgress.last_updated
                                  ? formatDate(userProgress.last_updated)
                                  : 'Not updated yet'}
                              </span>
                            </div>
                            {(progressPercent === 100 || userProgress.completed === userProgress.total) && (
                              <div className="flex items-center text-xs">
                                <FiCheck className="text-green-500 dark:text-green-400 mr-1.5" size={12} />
                                <span className="text-gray-600 dark:text-gray-400">
                                  Completed: {userProgress.completed_date 
                                    ? formatDate(userProgress.completed_date)
                                    : formatDate(new Date().toISOString())}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex flex-wrap justify-between items-center">
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
              <FiTag className="mr-2" size={16} /> 
              <span className="font-medium">Invite Code:</span>
              <span className="font-mono ml-2">{dataset.invite_code}</span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={copyInviteCode}
              className="border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
            >
              <FiCopy className="mr-2" size={14} /> Copy
            </Button>
          </CardFooter>
        </Card>
      </motion.div>
    </motion.div>
  );
}
