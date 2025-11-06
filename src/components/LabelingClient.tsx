'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Dataset, DatasetEntry, LabelOption } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { toast } from 'react-hot-toast';
import { calculateProgress, cn } from '@/lib/utils';
import { FiArrowRight, FiArrowLeft, FiCheck, FiX, FiMinus, FiStar, FiLoader, FiAlertCircle, FiHome, FiArrowUp, FiBarChart, FiDatabase, FiChevronsLeft, FiChevronsRight, FiChevronDown, FiFilter, FiTag } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { analyzeSentiment } from '@/lib/sentimentAnalysis';

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

interface LabelingClientProps {
  id: string;
}

export default function LabelingClient({ id }: LabelingClientProps) {
  const { user } = useAuth();
  const router = useRouter();
  const stickyButtonsRef = useRef<HTMLDivElement>(null);
  
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [entries, setEntries] = useState<DatasetEntry[]>([]);
  const [pageEntries, setPageEntries] = useState<DatasetEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedLabels, setSelectedLabels] = useState<Record<string, LabelOption>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState({ 
    completed: 0, 
    total: 0, 
    start_date: null as string | null,
    completed_date: null as string | null 
  });
  const [filteredTotal, setFilteredTotal] = useState(0); // Total count with active filters
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [completedEntries, setCompletedEntries] = useState<Set<string>>(new Set());
  const [previousLabels, setPreviousLabels] = useState<Record<string, LabelOption>>({});
  const [submittedLabels, setSubmittedLabels] = useState<Record<string, LabelOption>>({});
  const [debugMode, setDebugMode] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [entryOriginalOrder, setEntryOriginalOrder] = useState<Record<string, number>>({});
  const [entryUserOrder, setEntryUserOrder] = useState<Record<string, number>>({});
  const [hasScoreColumn, setHasScoreColumn] = useState(true);
  const [scoreFilters, setScoreFilters] = useState<('all' | '1' | '2' | '3' | '4' | '5')[]>(['all']);
  const [pendingScoreFilters, setPendingScoreFilters] = useState<('all' | '1' | '2' | '3' | '4' | '5')[]>(['all']);
  const [directPageInput, setDirectPageInput] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  // Add state for tracking the last labeled page
  const [lastLabeledPage, setLastLabeledPage] = useState<number | null>(null);
  
  // Create a unique key for localStorage based on dataset and user
  const localStorageKey = `last_labeled_page_${id}_${user?.id}`;

  // Update the label options based on dataset type
  const getAvailableLabels = (): LabelOption[] => {
    if (dataset?.labeling_type === 'binary') {
      return ['positive', 'negative'];
    }
    return ['positive', 'neutral', 'negative'];
  };

  // Check if user is admin
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
  
  // Helper function to shuffle array (Fisher-Yates algorithm)
  const shuffleArray = (array: any[]) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  // Function to generate user-specific entry order (client-side only for now)
  const generateUserEntryOrder = useCallback(async (entryIds: string[]) => {
    if (!user?.id) {
      // If no user ID, fallback to original order
      const orderMap: Record<string, number> = {};
      entryIds.forEach((entryId, index) => {
        orderMap[entryId] = index;
      });
      return orderMap;
    }

    try {
      // Create a unique seed based on user ID and dataset ID
      const seedString = `${user.id}-${id}`;
      // Simple hash function to create a numeric seed
      let seed = 0;
      for (let i = 0; i < seedString.length; i++) {
        seed = (seed * 31 + seedString.charCodeAt(i)) % 2147483647;
      }
      
      // Seeded random shuffle function
      const seededShuffle = (array: string[], seed: number) => {
        const newArray = [...array];
        // Seeded random number generator
        const random = () => {
          seed = (seed * 1664525 + 1013904223) % 2147483647;
          return seed / 2147483647;
        };
        
        // Fisher-Yates shuffle with seeded random
        for (let i = newArray.length - 1; i > 0; i--) {
          const j = Math.floor(random() * (i + 1));
          [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
      };
      
      // Create a shuffled order based on the seed
      const shuffledIds = seededShuffle(entryIds, seed);
      
      // Create mapping of entry ID to position
      const orderMap: Record<string, number> = {};
      shuffledIds.forEach((entryId, index) => {
        orderMap[entryId] = index;
      });
      
      return orderMap;
    } catch (error) {
      console.error('Error generating user entry order:', error);
      console.error('Error details:', error instanceof Error ? error.message : String(error));
      // Fallback to original order
      const orderMap: Record<string, number> = {};
      entryIds.forEach((entryId, index) => {
        orderMap[entryId] = index;
      });
      return orderMap;
    }
  }, [id, user?.id]);

  // Effect to generate user-specific order when user becomes available
  useEffect(() => {
    if (user?.id && Object.keys(entryOriginalOrder).length > 0 && Object.keys(entryUserOrder).length === 0) {
      // Generate user-specific order from the existing original order
      const entryIds = Object.keys(entryOriginalOrder);
      generateUserEntryOrder(entryIds).then(userOrder => {
        setEntryUserOrder(userOrder);
      });
    }
  }, [user?.id, entryOriginalOrder, entryUserOrder, generateUserEntryOrder]);
  
  // Helper function to process entry labels
  const processEntryLabels = useCallback(async (entryIds: string[], entries: any[]) => {
    if (!entryIds.length) return;
    
    try {
      // Now fetch labels ONLY for these exact entries

      const { data: labelData, error: labelError } = await supabase
        .from('dataset_labels')
        .select('entry_id, label')
        .eq('dataset_id', id)
        .eq('user_id', user?.id)
        .in('entry_id', entryIds);

      if (labelError) {
        console.error("❌ Error fetching labels:", labelError);
        throw labelError;
      }

      // Process the labels
      const pageLabels: Record<string, LabelOption> = {};
      const pageCompletedEntries = new Set<string>();
      
      if (labelData && labelData.length > 0) {
        labelData.forEach(item => {
          // Verify this ID is in our current page
          if (entryIds.includes(item.entry_id)) {
            pageLabels[item.entry_id] = item.label as LabelOption;
            pageCompletedEntries.add(item.entry_id);
          } else {
            console.warn(`Found label for ID ${item.entry_id} but it's not on this page!`);
          }
        });
      }
      
      // Update state with the new data
      setSubmittedLabels(pageLabels);
      setPreviousLabels(pageLabels);
      setCompletedEntries(pageCompletedEntries);
    } catch (error) {
      console.error('Error processing labels:', error);
    }
  }, [id, user?.id, setSubmittedLabels, setPreviousLabels, setCompletedEntries]);
  
  // Add function to update the last page in the database
  const updateLastPage = useCallback(async (pageIndex: number) => {
    try {
      const { error } = await supabase
        .from('label_progress')
        .update({ last_page: pageIndex })
        .eq('dataset_id', id)
        .eq('user_id', user?.id);

      if (error) {
        console.error("Error updating last page:", error);
      }
    } catch (err) {
      console.error("Failed to update last page:", err);
    }
  }, [id, user?.id]);
  
  // Fix the loadPageEntries function to handle large page sizes correctly
  const loadPageEntries = useCallback(async (pageIndex: number, pageSize: number, filtersToUse?: ('all' | '1' | '2' | '3' | '4' | '5')[]) => {
    const currentFilters = filtersToUse || scoreFilters;
    try {
      // Clear existing data for this page
      setSubmittedLabels({});
      setPreviousLabels({});
      setCompletedEntries(new Set());
      setSelectedLabels({});
      setPageEntries([]);
      
      // Calculate range for this page
      const start = pageIndex * pageSize;
      const end = start + pageSize - 1;
      
      // First attempt to get ALL entry IDs to establish the master order if we don't have it yet
      if (Object.keys(entryOriginalOrder).length === 0 && user?.id) {
        try {
          // Build query with score filters
          let query = supabase
            .from('dataset_entries')
            .select('id')
            .eq('dataset_id', id);
          
          // Apply score filters only if dataset has score column
          if (hasScoreColumn && !currentFilters.includes('all') && currentFilters.length > 0) {
            // If multiple scores are selected, use 'in' operator
            if (currentFilters.length > 1) {
              query = query.in('score', currentFilters.map(s => parseInt(s)));
            } else {
              // If only one score is selected, use 'eq' operator
              query = query.eq('score', parseInt(currentFilters[0]));
            }
          }
          
          query = query.order('id');
          
          const { data: allEntryIds, error: idsError } = await query;
        
          if (idsError) {
            console.error("Error fetching all entry IDs:", idsError);
            console.error("Error details:", JSON.stringify(idsError));
            // Continue even if this fails - we'll fall back to ID-based ordering
          } else if (allEntryIds && allEntryIds.length > 0) {
            // Create a mapping of ID to original position
            const orderMap: Record<string, number> = {};
            allEntryIds.forEach((entry, index) => {
              orderMap[entry.id] = index;
            });
            
            setEntryOriginalOrder(orderMap);
            
            // Generate user-specific order only if we have a user
            if (user?.id) {
              const entryIds = allEntryIds.map(e => e.id);
              const userOrder = await generateUserEntryOrder(entryIds);
              setEntryUserOrder(userOrder);
            }
          }
        } catch (orderError) {
          console.error("Error establishing orders:", orderError);
          console.error("Full error:", orderError instanceof Error ? orderError.message : String(orderError));
          // Continue with the query even if this fails
        }
      }
      
      // Fetch total entries count to validate we're not requesting beyond the dataset size
      let countQuery = supabase
        .from('dataset_entries')
        .select('*', { count: 'exact', head: true })
        .eq('dataset_id', id);
      
      // Apply score filters only if dataset has score column
      if (hasScoreColumn && !currentFilters.includes('all') && currentFilters.length > 0) {
        // If multiple scores are selected, use 'in' operator
        if (currentFilters.length > 1) {
          countQuery = countQuery.in('score', currentFilters.map(s => parseInt(s)));
        } else {
          // If only one score is selected, use 'eq' operator
          countQuery = countQuery.eq('score', parseInt(currentFilters[0]));
        }
      }
      
      const { count: totalCount, error: countError } = await countQuery;
      
      if (countError) {
        console.error("Error counting entries:", countError);
        throw countError;
      }
      
      // Ensure our range is valid based on total count
      const validEnd = totalCount ? Math.min(end, totalCount - 1) : end;
      
      // Check if the starting point is beyond available data
      if (totalCount && start >= totalCount) {
        console.warn(`Start index ${start} is beyond total entries ${totalCount}`);
        // Reset to first page in case of invalid range
        let firstPageQuery = supabase
          .from('dataset_entries')
          .select('*')
          .eq('dataset_id', id);
        
        // Apply score filters only if dataset has score column
        if (hasScoreColumn && !currentFilters.includes('all') && currentFilters.length > 0) {
          if (currentFilters.length > 1) {
            firstPageQuery = firstPageQuery.in('score', currentFilters.map(s => parseInt(s)));
          } else {
            firstPageQuery = firstPageQuery.eq('score', parseInt(currentFilters[0]));
          }
        }
        
        firstPageQuery = firstPageQuery.order('id').range(0, pageSize - 1);
        
        const { data: firstPageData, error: firstPageError } = await firstPageQuery;
        
        if (firstPageError) {
          console.error("Error fetching first page:", firstPageError);
          throw firstPageError;
        }
        
        if (firstPageData && firstPageData.length > 0) {
          setPageEntries(firstPageData);
          setCurrentIndex(0);
          // Update last page to 0 in database
          updateLastPage(0);
          // Process these entries
          const entryIds = firstPageData.map(e => e.id);
          await processEntryLabels(entryIds, firstPageData);
          return;
        }
      }
      
      // Fetch entries for this specific page with score filters
      let entriesQuery = supabase
        .from('dataset_entries')
        .select('*')
        .eq('dataset_id', id);
      
      // Apply score filters only if dataset has score column
      if (hasScoreColumn && !currentFilters.includes('all') && currentFilters.length > 0) {
        if (currentFilters.length > 1) {
          entriesQuery = entriesQuery.in('score', currentFilters.map(s => parseInt(s)));
        } else {
          entriesQuery = entriesQuery.eq('score', parseInt(currentFilters[0]));
        }
      }
      
      entriesQuery = entriesQuery.order('id').range(start, validEnd);
      
      const { data: entriesData, error: entriesError } = await entriesQuery;
      
      if (entriesError) {
        console.error("❌ Error fetching entries:", entriesError);
        console.error("Error details:", JSON.stringify(entriesError));
        throw entriesError;
      }
      
      if (!entriesData || entriesData.length === 0) {
        // Try to recover by loading the first page
        let firstPageQuery = supabase
          .from('dataset_entries')
          .select('*')
          .eq('dataset_id', id);
        
        // Apply score filters only if dataset has score column
        if (hasScoreColumn && !currentFilters.includes('all') && currentFilters.length > 0) {
          if (currentFilters.length > 1) {
            firstPageQuery = firstPageQuery.in('score', currentFilters.map(s => parseInt(s)));
          } else {
            firstPageQuery = firstPageQuery.eq('score', parseInt(currentFilters[0]));
          }
        }
        
        firstPageQuery = firstPageQuery.order('id').range(0, pageSize - 1);
        
        const { data: firstPageData, error: firstPageError } = await firstPageQuery;
        
        if (firstPageError) {
          console.error("Error fetching first page:", firstPageError);
          throw firstPageError;
        }
        
        if (firstPageData && firstPageData.length > 0) {
          setPageEntries(firstPageData);
          setCurrentIndex(0);
          // Update last page to 0 in database
          updateLastPage(0);
          // Process these entries
          const entryIds = firstPageData.map(e => e.id);
          await processEntryLabels(entryIds, firstPageData);
          return;
        } else {
          setPageEntries([]);
          return;
        }
      }
      
      // Sort entries based on user-specific order if available, otherwise original order
      const sortedEntries = [...entriesData];
      try {
        if (Object.keys(entryUserOrder).length > 0) {
          sortedEntries.sort((a, b) => {
            const orderA = entryUserOrder[a.id] ?? Number.MAX_SAFE_INTEGER;
            const orderB = entryUserOrder[b.id] ?? Number.MAX_SAFE_INTEGER;
            return orderA - orderB;
          });
        } else if (Object.keys(entryOriginalOrder).length > 0) {
          sortedEntries.sort((a, b) => {
            const orderA = entryOriginalOrder[a.id] ?? Number.MAX_SAFE_INTEGER;
            const orderB = entryOriginalOrder[b.id] ?? Number.MAX_SAFE_INTEGER;
            return orderA - orderB;
          });
        } else {
          // Using default order by ID
        }
      } catch (sortError) {
        console.error("Error sorting entries, falling back to default order:", sortError);
        // If sorting fails for any reason, we continue with the default order
      }
      
      const entryIds = sortedEntries.map(e => e.id);

      // Store these entries in the full entries array if needed
      setEntries(prevEntries => {
        const allEntries = [...prevEntries];
        
        // Fill in the array at the correct positions
        sortedEntries.forEach((entry, i) => {
          allEntries[start + i] = entry;
        });
        
        return allEntries;
      });
      
      // Set current page entries
      setPageEntries(sortedEntries);
      
      // Process labels for these entries
      await processEntryLabels(entryIds, sortedEntries);
      
    } catch (error) {
      console.error('❌ Error loading page:', error);
      toast.error('Failed to load page. Trying to recover...');
      
      // Last resort recovery - load first page with a smaller size
      try {
        let recoveryQuery = supabase
          .from('dataset_entries')
          .select('*')
          .eq('dataset_id', id);
        
        // Apply score filters only if dataset has score column
        if (hasScoreColumn && !currentFilters.includes('all') && currentFilters.length > 0) {
          if (currentFilters.length > 1) {
            recoveryQuery = recoveryQuery.in('score', currentFilters.map(s => parseInt(s)));
          } else {
            recoveryQuery = recoveryQuery.eq('score', parseInt(currentFilters[0]));
          }
        }
        
        recoveryQuery = recoveryQuery.order('id').range(0, 9); // First 10 entries
        
        const { data: recoveryData } = await recoveryQuery;
          
        if (recoveryData && recoveryData.length > 0) {
          setPageEntries(recoveryData);
          setCurrentIndex(0);
          // Process these entries
          const recoveryIds = recoveryData.map(e => e.id);
          await processEntryLabels(recoveryIds, recoveryData);
        }
      } catch (recoveryError) {
        console.error('⚠️ Even recovery failed:', recoveryError);
      }
    }
  }, [id, hasScoreColumn, scoreFilters, entryOriginalOrder, setSubmittedLabels, setPreviousLabels, setCompletedEntries, setSelectedLabels, setPageEntries, updateLastPage, processEntryLabels]);
  
  // Completely rewritten fetchDatasetAndEntries function
  const fetchDatasetAndEntries = useCallback(async () => {
    try {
      setLoading(true);
      
      // Reset all states before fetching new data
      setSubmittedLabels({});
      setPreviousLabels({});
      setCompletedEntries(new Set());
      setSelectedLabels({});
      setPageEntries([]);
      
      // Fetch dataset details
      const { data: datasetData, error: datasetError } = await supabase
        .from('datasets')
        .select('*')
        .eq('id', id)
        .single();
      
      if (datasetError) {
        console.error("Error fetching dataset:", datasetError);
        toast.error(`Error loading dataset: ${datasetError.message}`);
        throw datasetError;
      }
      
      if (!datasetData) {
        console.error("Dataset not found with ID:", id);
        toast.error("Dataset not found");
        setLoading(false);
        return;
      }
      
      // Check if dataset is active
      if (datasetData.is_active === false && datasetData.owner_id !== user?.id && !isAdmin) {
        console.error("Dataset is inactive:", id);
        toast.error("This dataset is currently inactive and not available for labeling");
        router.push('/dashboard');
        return;
      }
      
      // Fetch progress
      const { data: progressData, error: progressError } = await supabase
        .from('label_progress')
        .select('*')
        .eq('dataset_id', id)
        .eq('user_id', user?.id)
        .single();
      
      if (progressError && progressError.code !== 'PGRST116') {
        console.error("Error fetching progress:", progressError);
        throw progressError;
      }
      
      // If no progress record found, create one
      let progressRecord = progressData;
      if (!progressRecord) {
        // Count total entries first
        const { count, error: countError } = await supabase
          .from('dataset_entries')
          .select('*', { count: 'exact', head: true })
          .eq('dataset_id', id);
          
        if (countError) {
          console.error("Error counting entries:", countError);
          throw countError;
        }
        
        const totalEntries = count || 0;
        
        const { data, error: createError } = await supabase
          .from('label_progress')
          .insert({
            dataset_id: id,
            user_id: user?.id,
            completed: 0,
            total: totalEntries,
            last_page: 0, // Add last page tracking
            start_date: new Date().toISOString(), // Set start_date when first creating the record
          })
          .select('*')
          .single();
        
        if (createError) {
          console.error("Error creating progress record:", createError);
          throw createError;
        }
        
        progressRecord = data;
      }
      
      // Set the last labeled page from localStorage instead of database
      const storedLastLabeledPage = localStorage.getItem(localStorageKey);
      if (storedLastLabeledPage) {
        setLastLabeledPage(parseInt(storedLastLabeledPage, 10));
      } else {
        setLastLabeledPage(null);
      }
      
      // Check if dataset has score column by checking if any entries have score data
      const { data: sampleEntries, error: sampleError } = await supabase
        .from('dataset_entries')
        .select('score')
        .eq('dataset_id', id)
        .limit(5); // Check first 5 entries
      
      if (!sampleError && sampleEntries) {
        // If any entry has a non-null score, dataset has score column
        const hasScore = sampleEntries.some(entry => entry.score !== null);
        setHasScoreColumn(hasScore);
        
        // If no score column, disable filters by setting them to 'all'
        if (!hasScore) {
          setScoreFilters(['all']);
          setPendingScoreFilters(['all']);
        }
      }
      
      setDataset(datasetData);
      setProgress({
        completed: progressRecord?.completed || 0,
        total: progressRecord?.total || 0,
        start_date: progressRecord?.start_date || null,
        completed_date: progressRecord?.completed_date || null
      });
      setFilteredTotal(progressRecord?.total || 0);
      
      // Determine which page to load - use last_page if available, otherwise start from 0
      const lastPage = progressRecord?.last_page || 0;
      const startIndex = lastPage * entriesPerPage;
      
      // Set current index to the last page the user was on
      if (startIndex < progressRecord?.total) {
        setCurrentIndex(startIndex);
      }
      
      // Fetch entries for the last page the user was on
      await loadPageEntries(lastPage, entriesPerPage, scoreFilters);
      
    } catch (error) {
      console.error('❌ Error fetching data:', error);
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }, [id, user?.id, entriesPerPage, isAdmin, router, loadPageEntries, scoreFilters, localStorageKey]);

  useEffect(() => {
    if (user && id) {
      checkAdminStatus(); // Check admin status first
      fetchDatasetAndEntries();
    }
  }, [user, id, fetchDatasetAndEntries, checkAdminStatus]);

  // Load last labeled page from localStorage when component mounts
  useEffect(() => {
    if (user?.id && id) {
      const storedLastLabeledPage = localStorage.getItem(localStorageKey);
      if (storedLastLabeledPage) {
        setLastLabeledPage(parseInt(storedLastLabeledPage, 10));
      }
    }
  }, [user?.id, id, localStorageKey]);
  
  // Effect to generate user-specific order when user becomes available
  useEffect(() => {
    if (user?.id && Object.keys(entryOriginalOrder).length > 0 && Object.keys(entryUserOrder).length === 0) {
      // Generate user-specific order from the existing original order
      const entryIds = Object.keys(entryOriginalOrder);
      generateUserEntryOrder(entryIds).then(userOrder => {
        setEntryUserOrder(userOrder);
      }).catch(error => {
        console.error('Failed to generate user entry order:', error);
        // Even if generation fails, we continue with the original order
      });
    }
  }, [user?.id, entryOriginalOrder, entryUserOrder, generateUserEntryOrder]);
  
  // Function to refresh user-specific entry order
  const refreshUserEntryOrder = useCallback(async () => {
    if (!user?.id || Object.keys(entryOriginalOrder).length === 0) {
      console.warn('Cannot refresh user entry order: missing user ID or original order');
      return;
    }
    
    try {
      // Get entry IDs from original order
      const entryIds = Object.keys(entryOriginalOrder);
      
      // Generate new shuffled order
      const userOrder = await generateUserEntryOrder(entryIds);
      setEntryUserOrder(userOrder);
      
      // Reload current page with new order
      const currentPage = Math.floor(currentIndex / entriesPerPage);
      await loadPageEntries(currentPage, entriesPerPage, scoreFilters);
      
      toast.success('Entry order refreshed successfully');
    } catch (error) {
      console.error('Error refreshing user entry order:', error);
      toast.error('Failed to refresh entry order');
    }
  }, [user?.id, entryOriginalOrder, currentIndex, entriesPerPage, scoreFilters, generateUserEntryOrder, loadPageEntries]);

  // Update handlePageSelect to save the last page
  function handlePageSelect(pageNum: number) {
    if (pageNum === -1) return; // Skip separators
    const newIndex = (pageNum - 1) * entriesPerPage;
    if (newIndex >= 0 && newIndex < filteredTotal) {
      if (newIndex === currentIndex) return;
      
      setLoading(true);
      loadPageEntries(pageNum - 1, entriesPerPage, scoreFilters).then(() => {
        setCurrentIndex(newIndex);
        setSelectedLabels({});
        // Save the current page to the database
        updateLastPage(pageNum - 1);
        setLoading(false);
      }).catch(() => {
        setLoading(false);
      });
    }
  }
  
  // Function to reset pagination when filter changes
  const resetFilter = async (newFilters?: ('all' | '1' | '2' | '3' | '4' | '5')[]) => {
    const filtersToUse = newFilters || scoreFilters;
    setLoading(true);
    setSelectedLabels({});
    
    // Count total entries with current filters
    let countQuery = supabase
      .from('dataset_entries')
      .select('*', { count: 'exact', head: true })
      .eq('dataset_id', id);
    
    // Apply score filters only if dataset has score column
    if (hasScoreColumn && !filtersToUse.includes('all') && filtersToUse.length > 0) {
      // If multiple scores are selected, use 'in' operator
      if (filtersToUse.length > 1) {
        countQuery = countQuery.in('score', filtersToUse.map(s => parseInt(s)));
      } else {
        // If only one score is selected, use 'eq' operator
        countQuery = countQuery.eq('score', parseInt(filtersToUse[0]));
      }
    }
    
    const { count: totalCount, error: countError } = await countQuery;
    
    if (countError) {
      console.error("Error counting filtered entries:", countError);
      toast.error("Error updating filter");
      setLoading(false);
      return;
    }
    
    // Update filtered total for pagination
    setFilteredTotal(totalCount || 0);
    
    // Reset current index if it's beyond the new total
    const newTotal = totalCount || 0;
    if (currentIndex >= newTotal && newTotal > 0) {
      setCurrentIndex(0);
    }
    
    // Load first page with new filter
    const currentPage = Math.floor(currentIndex / entriesPerPage);
    await loadPageEntries(currentPage, entriesPerPage, filtersToUse);
    // Update last page to current page in database
    await updateLastPage(currentPage);
    setLoading(false);
  };
  

  
  // Modify handleNext to save the last page
  const handleNext = async () => {
    try {
      setLoading(true);
      const nextIndex = currentIndex + entriesPerPage;
      const nextPage = Math.floor(nextIndex / entriesPerPage);
      
      // Check if next page exists
      const totalPages = Math.ceil(filteredTotal / entriesPerPage);
      if (nextPage >= totalPages) {
        setLoading(false);
        return;
      }
      
      // Clear selections first
      setSelectedLabels({});
      
      // Load this page data
      await loadPageEntries(nextPage, entriesPerPage, scoreFilters);
      
      // Now update the current index
      setCurrentIndex(nextIndex);
      
      // Save the last page to the database
      await updateLastPage(nextPage);
      
    } catch (error) {
      console.error('❌ Error navigating to next page:', error);
      toast.error('Gagal memuat data berikutnya');
    } finally {
      setLoading(false);
    }
  };
  
  // Modify handlePrevious to save the last page
  const handlePrevious = () => {
    if (currentIndex >= entriesPerPage) {
      // Clear selections
      setSelectedLabels({});
      
      const prevIndex = currentIndex - entriesPerPage;
      const prevPage = Math.floor(prevIndex / entriesPerPage);
      
      // Load the previous page data
      loadPageEntries(prevPage, entriesPerPage, scoreFilters).then(() => {
        // Update current index
        setCurrentIndex(prevIndex);
        
        // Save the last page to the database
        updateLastPage(prevPage);
        
      });
    }
  };
  
  // Function to handle direct page navigation
  const handleDirectPageNavigation = () => {
    const pageNum = parseInt(directPageInput);
    if (isNaN(pageNum) || pageNum < 1) {
      toast.error('Please enter a valid page number');
      return;
    }
    
    const totalPages = Math.ceil(filteredTotal / entriesPerPage);
    if (pageNum > totalPages) {
      toast.error(`Page number cannot exceed ${totalPages}`);
      return;
    }
    
    const newIndex = (pageNum - 1) * entriesPerPage;
    if (newIndex >= 0 && newIndex < filteredTotal) {
      if (newIndex === currentIndex) return;
      
      setLoading(true);
      loadPageEntries(pageNum - 1, entriesPerPage, scoreFilters).then(() => {
        setCurrentIndex(newIndex);
        setSelectedLabels({});
        // Save the current page to the database
        updateLastPage(pageNum - 1);
        // Clear the input after successful navigation
        setDirectPageInput('');
        setLoading(false);
      }).catch(() => {
        setLoading(false);
      });
    }
  };
  
  // Modify handleSubmitLabels to use the new approach and validate labels
  const handleSubmitLabels = async () => {
    if (Object.keys(selectedLabels).length === 0 || !user) return;
    
    // Validate that all selected labels are appropriate for the dataset type
    const availableLabels = getAvailableLabels();
    const invalidLabels = Object.entries(selectedLabels).filter(([entryId, label]) => 
      !availableLabels.includes(label)
    );
    
    if (invalidLabels.length > 0) {
      toast.error(`Some selected labels are not valid for this dataset type`);
      return;
    }
    
    try {
      setSubmitting(true);
      
      interface LabelEntry {
        entryId: string;
        label: LabelOption;
      }

      const newLabels: LabelEntry[] = [];
      const updateLabels: LabelEntry[] = [];
      let newCompletedCount = 0;

      // Separate new and update labels
      for (const [entryId, label] of Object.entries(selectedLabels)) {
        if (completedEntries.has(entryId) || submittedLabels[entryId]) {
          updateLabels.push({ entryId, label });
        } else {
          newLabels.push({ entryId, label });
          newCompletedCount++;
        }
      }

      // Batch update existing labels
      if (updateLabels.length > 0) {
        for (const { entryId, label } of updateLabels) {
        const { error: updateError } = await supabase
          .from('dataset_labels')
            .update({ label })
          .eq('dataset_id', id)
          .eq('entry_id', entryId)
          .eq('user_id', user?.id);
        
          if (updateError) {
            console.error('❌ Error updating label:', updateError);
            throw updateError;
          }
        }
      }

      // Batch insert new labels
      if (newLabels.length > 0) {
        // Periksa dulu apakah ada label yang sudah ada di database
        const { data: existingLabels, error: checkError } = await supabase
          .from('dataset_labels')
          .select('entry_id')
          .eq('dataset_id', id)
          .eq('user_id', user?.id)
          .in('entry_id', newLabels.map(l => l.entryId));

        if (checkError) {
          console.error('❌ Error checking existing labels:', checkError);
          throw checkError;
        }

        // Filter out entries that already exist
        const existingEntryIds = new Set(existingLabels?.map(l => l.entry_id) || []);
        const actualNewLabels = newLabels.filter(l => !existingEntryIds.has(l.entryId));
        
        if (actualNewLabels.length > 0) {
          const { error: insertError } = await supabase
            .from('dataset_labels')
            .insert(
              actualNewLabels.map(({ entryId, label }) => ({
            dataset_id: id,
            entry_id: entryId,
            user_id: user?.id,
                label
              }))
            );
          
          if (insertError) {
            console.error('❌ Error inserting new labels:', insertError);
            throw insertError;
          }
        }

        // Update existing labels that were thought to be new
        const needsUpdate = newLabels.filter(l => existingEntryIds.has(l.entryId));
        for (const { entryId, label } of needsUpdate) {
          const { error: updateError } = await supabase
            .from('dataset_labels')
            .update({ label })
            .eq('dataset_id', id)
            .eq('entry_id', entryId)
            .eq('user_id', user?.id);
          
          if (updateError) {
            console.error('❌ Error updating existing label:', updateError);
            throw updateError;
          }
        }

        // Adjust newCompletedCount based on actual new labels
        newCompletedCount = actualNewLabels.length;
      }

      // Update progress if there are any new or updated labels
      if (newCompletedCount > 0 || updateLabels.length > 0) {
        // Calculate the current page number
        const currentPage = Math.floor(currentIndex / entriesPerPage);
        
        const progressUpdate: any = {
          last_updated: new Date().toISOString()
          // Remove the last_labeled_page update since we're using localStorage
        };

        if (newCompletedCount > 0) {
          const newTotal = Math.min(progress.completed + newCompletedCount, progress.total);
          progressUpdate.completed = newTotal;
          if (!progress.start_date) {
            progressUpdate.start_date = new Date().toISOString();
          }
          // Only set completed_date when the user first completes all labeling tasks
          // and it hasn't been set before
          if (newTotal === progress.total && progress.completed < progress.total && !progress.completed_date) {
            progressUpdate.completed_date = new Date().toISOString();
          }
        }

        const { error: progressError } = await supabase
          .from('label_progress')
          .update(progressUpdate)
          .eq('dataset_id', id)
          .eq('user_id', user?.id);
        
        if (progressError) {
          console.error('❌ Error updating progress:', progressError);
          throw progressError;
        }
        
        setProgress(prev => ({ 
          ...prev, 
          ...progressUpdate,
          completed: progressUpdate.completed !== undefined ? progressUpdate.completed : prev.completed,
          start_date: progressUpdate.start_date || prev.start_date,
          completed_date: progressUpdate.completed_date || prev.completed_date
        }));
        
        // Update the last labeled page in localStorage
        localStorage.setItem(localStorageKey, currentPage.toString());
        setLastLabeledPage(currentPage);
      }
      
      
      // Show success message
      const updateCount = updateLabels.length;
      const newCount = newCompletedCount;
      let message = '';
      if (updateCount > 0 && newCount > 0) {
        message = `${newCount} label baru disimpan dan ${updateCount} label diperbarui!`;
      } else if (updateCount > 0) {
        message = `${updateCount} label berhasil diperbarui!`;
      } else {
        message = `${newCount} label berhasil disimpan!`;
      }
      toast.success(message);

      // Reload the current page to sync with the database
      const pageNumber = Math.floor(currentIndex / entriesPerPage);
      await loadPageEntries(pageNumber, entriesPerPage, scoreFilters);
      
      // Clear selected labels after successful submission
      setSelectedLabels({});

      // Check if all entries in current page are labeled
      const allCurrentPageLabeled = pageEntries.every(entry => 
        completedEntries.has(entry.id)
      );

      if (allCurrentPageLabeled) {
        if (currentIndex + entriesPerPage < progress.total) {
          toast.success('Berpindah ke halaman berikutnya...');
          await handleNext();
        } else if (progress.completed >= progress.total) {
          toast.success('Selamat! Anda telah menyelesaikan semua data.');
          router.push('/labeling');
        }
      }

    } catch (error: any) {
      console.error('❌ Error submitting labels:', error);
      toast.error(error.message || 'Gagal menyimpan label');
    } finally {
      setSubmitting(false);
    }
  };
  
  // Update changeEntriesPerPage to handle large page sizes better
  const changeEntriesPerPage = (count: number) => {
    
    // Clear all previous state
      setSelectedLabels({});
    setSubmittedLabels({});
    setPreviousLabels({});
    setCompletedEntries(new Set());
    setPageEntries([]);
    
    // Set loading state
      setLoading(true);
    
    // Update the entriesPerPage and reset current index
    setEntriesPerPage(count);
    setCurrentIndex(0);
    
    // Load first page with new size directly
    loadPageEntries(0, count, scoreFilters)
      .then(() => {
        // Update last page to 0 in database
        updateLastPage(0);
      setLoading(false);
      })
      .catch(error => {
        console.error(`❌ Error changing to ${count} entries per page:`, error);
        setLoading(false);
        toast.error('Error loading entries with new page size');
      });
  };
  
  // Get the label class based on the entry's rating
  const getRatingClass = (score: number | null) => {
    if (score === null) return 'text-gray-500';
    
    switch (score) {
      case 1: return 'text-red-500';
      case 2: return 'text-orange-500';
      case 3: return 'text-yellow-500';
      case 4: return 'text-lime-500';
      case 5: return 'text-green-500';
      default: return 'text-gray-500';
    }
  };
  
  // Modifikasi getLabelButtonClass untuk menampilkan label baru dan lama
  const getLabelButtonClass = (label: LabelOption, entryId: string) => {
    const baseClass = "flex flex-col items-center justify-center p-4 rounded-lg border-2 relative transition-all ";
    
    const isSubmitted = submittedLabels[entryId] === label;
    const isSelectedNow = selectedLabels[entryId] === label;
    
    let buttonClass = baseClass;
    
    if (isSelectedNow) {
      // Label baru yang dipilih
      switch (label) {
        case 'positive':
          buttonClass += "bg-green-50 dark:bg-green-900/20 border-green-400 shadow-md shadow-green-100 dark:shadow-none hover:bg-green-100 dark:hover:bg-green-900/30";
          break;
        case 'negative':
          buttonClass += "bg-red-50 dark:bg-red-900/20 border-red-400 shadow-md shadow-red-100 dark:shadow-none hover:bg-red-100 dark:hover:bg-red-900/30";
          break;
        case 'neutral':
          buttonClass += "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-400 shadow-md shadow-yellow-100 dark:shadow-none hover:bg-yellow-100 dark:hover:bg-yellow-900/30";
          break;
      }
    } else if (isSubmitted) {
      // Label lama yang sudah disubmit
      switch (label) {
        case 'positive':
          buttonClass += "bg-green-50/50 dark:bg-green-900/10 border-green-200 hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20";
          break;
        case 'negative':
          buttonClass += "bg-red-50/50 dark:bg-red-900/10 border-red-200 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20";
          break;
        case 'neutral':
          buttonClass += "bg-yellow-50/50 dark:bg-yellow-900/10 border-yellow-200 hover:border-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20";
          break;
      }
    } else {
      buttonClass += "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750";
    }
    
    return buttonClass;
  };
  
  // Modifikasi CardDescription untuk menampilkan status label
  const getLabelStatus = (entryId: string) => {
    const hasSubmittedLabel = submittedLabels[entryId];
    const hasNewLabel = selectedLabels[entryId];

    if (hasSubmittedLabel && hasNewLabel) {
      return (
        <div className="space-y-1">
          <span className="text-blue-600 dark:text-blue-400 block">Label saat ini: {submittedLabels[entryId]}</span>
          <span className="text-green-600 dark:text-green-400 block">Label baru: {selectedLabels[entryId]}</span>
        </div>
      );
    } else if (hasSubmittedLabel) {
      return <span className="text-blue-600 dark:text-blue-400">Label saat ini: {submittedLabels[entryId]}</span>;
    } else if (hasNewLabel) {
      return <span className="text-green-600 dark:text-green-400">Label baru: {selectedLabels[entryId]}</span>;
    }
    return <span>Assign a sentiment label to this review</span>;
  };
  
  // Get icon for the label
  const getLabelIcon = (label: LabelOption) => {
    switch (label) {
      case 'positive': return <FiCheck className="text-green-500" size={24} />;
      case 'negative': return <FiX className="text-red-500" size={24} />;
      case 'neutral': return <FiMinus className="text-yellow-500" size={24} />;
    }
  };
  
  // Update the labeling buttons to conditionally show the neutral option
  const renderLabelingButtons = (entryId: string) => {
    const availableLabels = getAvailableLabels();
    
    // For binary datasets, use 2 columns; for multi-class, use 3 columns
    const gridColumns = availableLabels.includes('neutral') ? 'grid-cols-3' : 'grid-cols-2';
    
    return (
      <div className={`grid ${gridColumns} gap-3`}>
        <motion.button
          type="button"
          className={getLabelButtonClass('positive', entryId) + " p-4 py-5 flex flex-col items-center justify-center rounded-lg transition-all duration-200"}
          onClick={() => handleLabelSelect(entryId, 'positive')}
          disabled={submitting}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="w-12 h-12 rounded-full flex items-center justify-center bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 mb-2">
            {getLabelIcon('positive')}
          </div>
          <span className="font-medium text-base">Positive</span>
          {selectedLabels[entryId] === 'positive' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute top-2 right-2 bg-green-500 text-white rounded-full text-xs font-bold w-6 h-6 flex items-center justify-center"
            >
              ✓
            </motion.div>
          )}
        </motion.button>
        
        {availableLabels.includes('neutral') && (
          <motion.button
            type="button"
            className={getLabelButtonClass('neutral', entryId) + " p-4 py-5 flex flex-col items-center justify-center rounded-lg transition-all duration-200"}
            onClick={() => handleLabelSelect(entryId, 'neutral')}
            disabled={submitting}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 mb-2">
              {getLabelIcon('neutral')}
            </div>
            <span className="font-medium text-base">Neutral</span>
            {selectedLabels[entryId] === 'neutral' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute top-2 right-2 bg-yellow-500 text-white rounded-full text-xs font-bold w-6 h-6 flex items-center justify-center"
              >
                ✓
              </motion.div>
            )}
          </motion.button>
        )}
        
        <motion.button
          type="button"
          className={getLabelButtonClass('negative', entryId) + " p-4 py-5 flex flex-col items-center justify-center rounded-lg transition-all duration-200"}
          onClick={() => handleLabelSelect(entryId, 'negative')}
          disabled={submitting}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="w-12 h-12 rounded-full flex items-center justify-center bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 mb-2">
            {getLabelIcon('negative')}
          </div>
          <span className="font-medium text-base">Negative</span>
          {selectedLabels[entryId] === 'negative' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute top-2 right-2 bg-red-500 text-white rounded-full text-xs font-bold w-6 h-6 flex items-center justify-center"
            >
              ✓
            </motion.div>
          )}
        </motion.button>
      </div>
    );
  };

  // Auto-label all entries on current page with specified label
  const autoLabelPage = (label: LabelOption) => {
    // Check if the label is available for this dataset type
    const availableLabels = getAvailableLabels();
    if (!availableLabels.includes(label)) {
      toast.error(`Label "${label}" is not available for this dataset type`);
      return;
    }
    
    const newLabels: Record<string, LabelOption> = {};
    let count = 0;
    
    pageEntries.forEach(entry => {
      // Auto-label all entries, overriding any existing labels
      newLabels[entry.id] = label;
      count++;
    });
    
    setSelectedLabels(prev => ({
      ...prev,
      ...newLabels
    }));
    
    // Show appropriate toast message
    if (count > 0) {
      toast.success(
        <div className="flex items-center">
          <span>Auto-labeled {count} entries as {label}</span>
          <span className="ml-2 px-2 py-1 rounded text-xs font-medium bg-white/20">
            Submit to save
          </span>
        </div>
      );
    } else {
      toast.success('No entries found on this page');
    }
  };
  
  // Auto-label all entries on current page based on their scores
  const autoLabelPageByScore = () => {
    const newLabels: Record<string, LabelOption> = {};
    let count = 0;
    const availableLabels = getAvailableLabels();
    
    pageEntries.forEach(entry => {
      // Only auto-label entries that don't already have a label from the user
      if (!selectedLabels[entry.id]) {
        // Apply label based on score
        if (entry.score !== null) {
          if (entry.score >= 1 && entry.score <= 2) {
            // Scores 1-2: Negative (but these are already auto-labeled by system)
            // We'll only apply if not already labeled
            if (!submittedLabels[entry.id]) {
              newLabels[entry.id] = 'negative';
              count++;
            }
          } else if (entry.score === 3) {
            // Score 3: Neutral or Positive for binary
            if (availableLabels.includes('neutral')) {
              newLabels[entry.id] = 'neutral';
              count++;
            } else {
              // For binary, we'll use positive for neutral scores
              newLabels[entry.id] = 'positive';
              count++;
            }
          } else if (entry.score >= 4 && entry.score <= 5) {
            // Scores 4-5: Positive
            newLabels[entry.id] = 'positive';
            count++;
          }
        }
      }
    });
    
    setSelectedLabels(prev => ({
      ...prev,
      ...newLabels
    }));
    
    // Show appropriate toast message
    if (count > 0) {
      toast.success(
        <div className="flex items-center">
          <span>Auto-labeled {count} entries based on scores</span>
          <span className="ml-2 px-2 py-1 rounded text-xs font-medium bg-white/20">
            Submit to save
          </span>
        </div>
      );
    } else {
      toast.success('No entries needed auto-labeling');
    }
  };
  
  // Auto-label all entries on current page based on text content analysis
  const autoLabelPageByText = async () => {
    const newLabels: Record<string, LabelOption> = {};
    let count = 0;
    
    // Show loading state
    toast.loading('Analyzing text sentiment...');
    
    try {
      // Process entries sequentially to avoid overwhelming the API
      for (const entry of pageEntries) {
        // Only auto-label entries that don't already have a label from the user
        if (!selectedLabels[entry.id]) {
          // Apply label based on text content analysis
          const sentiment = await analyzeSentiment(entry.text);
          newLabels[entry.id] = sentiment;
          count++;
        }
      }
      
      setSelectedLabels(prev => ({
        ...prev,
        ...newLabels
      }));
      
      // Dismiss loading toast and show success message
      toast.dismiss();
      
      // Show appropriate toast message
      if (count > 0) {
        toast.success(
          <div className="flex items-center">
            <span>Auto-labeled {count} entries based on text analysis</span>
            <span className="ml-2 px-2 py-1 rounded text-xs font-medium bg-white/20">
              Submit to save
            </span>
          </div>
        );
      } else {
        toast.success('No entries needed auto-labeling');
      }
    } catch (error) {
      toast.dismiss();
      console.error('Error in text-based auto-labeling:', error);
      toast.error('Failed to auto-label entries based on text analysis');
    }
  };
  useEffect(() => {
    // Buttons are always visible, no scroll handling needed
    if (stickyButtonsRef.current) {
      stickyButtonsRef.current.style.display = 'block';
      stickyButtonsRef.current.style.position = 'fixed';
      stickyButtonsRef.current.style.right = '1.5rem';
      stickyButtonsRef.current.style.top = '50%';
      stickyButtonsRef.current.style.transform = 'translateY(-50%)';
      stickyButtonsRef.current.style.zIndex = '40';
    }
  }, []);
  
  // Cleanup localStorage when unmounting
  useEffect(() => {
    return () => {
      // Optionally clear localStorage when component unmounts
      // localStorage.removeItem(`labels_${id}_${user?.id}`);
    };
  }, [id, user]);
  
  // Add back the handleLabelSelect function that was accidentally removed
  const handleLabelSelect = (entryId: string, label: LabelOption) => {
    setSelectedLabels(prev => {
      // Jika label yang sama diklik lagi, hapus pilihan
      if (prev[entryId] === label) {
        const newLabels = { ...prev };
        delete newLabels[entryId];
        return newLabels;
      }
      // Jika label berbeda atau belum ada, tambahkan pilihan baru
      return {
        ...prev,
        [entryId]: label
      };
    });

    // Jika entry sudah disubmit sebelumnya, hapus dari submittedLabels
    if (submittedLabels[entryId]) {
      setSubmittedLabels(prev => {
        const newLabels = { ...prev };
        delete newLabels[entryId];
        return newLabels;
      });
      
      // Hapus dari completedEntries juga
      setCompletedEntries(prev => {
        const newSet = new Set(prev);
        newSet.delete(entryId);
        return newSet;
      });
    }
  };
  
  // Add the toggleDebugMode function
  const toggleDebugMode = () => {
    setDebugMode(prevMode => !prevMode);
  };
  
  // Helper function to generate pagination range with ellipsis
  function getPaginationRange() {
    const totalPages = Math.ceil(filteredTotal / entriesPerPage);
    const currentPage = Math.floor(currentIndex / entriesPerPage) + 1;
    
    // If no pages, return empty array
    if (totalPages <= 0) {
      return [];
    }
    
    // If 7 or fewer pages, show all pages
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    
    // Otherwise, show page numbers with ellipsis
    let range = [];
    
    if (currentPage <= 3) {
      // Near the start
      range = [1, 2, 3, 4, 5, -1, totalPages];
    } else if (currentPage >= totalPages - 2) {
      // Near the end
      range = [1, -1, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    } else {
      // Middle
      range = [1, -1, currentPage - 1, currentPage, currentPage + 1, -1, totalPages];
    }
    
    return range;
  }
  
  if (loading) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-6xl mx-auto py-16 px-4 text-center"
      >
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl shadow-md p-8 max-w-xl mx-auto">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-t-4 border-blue-600 animate-spin"></div>
            <div className="absolute inset-3 flex items-center justify-center">
              <FiLoader className="text-blue-600 animate-pulse" size={24} />
      </div>
          </div>
          <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">Loading Labeling Interface</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            We're preparing your dataset for labeling...
          </p>
          <div className="space-y-3 max-w-md mx-auto">
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-2 w-3/4 mx-auto" />
            <Skeleton className="h-2 w-5/6 mx-auto" />
          </div>
        </div>
      </motion.div>
    );
  }
  
  if (!dataset || entries.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto py-16 px-4 text-center"
      >
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl shadow-md p-8 max-w-xl mx-auto">
          <div className="w-16 h-16 mx-auto mb-6 flex items-center justify-center text-orange-500 bg-orange-100 dark:bg-orange-900/30 rounded-full">
            <FiAlertCircle size={32} />
          </div>
          <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">No Data Available</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            There are no entries available to label in this dataset or the dataset doesn't exist.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button onClick={() => router.push('/labeling')} className="w-full sm:w-auto flex items-center justify-center">
              <FiHome className="mr-2" /> Return to Dashboard
            </Button>
            <Button 
              variant="outline" 
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="w-full sm:w-auto flex items-center justify-center"
            >
              <FiArrowUp className="mr-2" /> Back to Top
        </Button>
      </div>
        </div>
      </motion.div>
    );
  }
  
  // Update the auto-labeling buttons to be aware of the dataset type
  const renderAutoLabelButtons = () => {
    const availableLabels = getAvailableLabels();
    const showButtons = true; 

    if (!showButtons) return null; 

    return (
      <div className="flex flex-col space-y-3">
        <h3 className="font-bold text-gray-900 dark:text-white mb-2 text-center">Auto-Label</h3>

        <Button
          onClick={autoLabelPageByScore}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center py-3 rounded-lg"
        >
          <FiTag className="mr-2" /> Auto-Label by Score
        </Button>

        <Button
          onClick={autoLabelPageByText}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center py-3 rounded-lg"
        >
          <FiTag className="mr-2" /> Auto-Label by Text
        </Button>
      </div>
    );
  };

  
  // Use pageEntries instead of entries.slice
  const currentPageEntries = pageEntries.filter(entry => entry && entry.id);

  if (currentPageEntries.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto py-16 px-4 text-center"
      >
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl shadow-md p-8 max-w-xl mx-auto">
          <div className="w-16 h-16 mx-auto mb-6 flex items-center justify-center text-blue-500 bg-blue-100 dark:bg-blue-900/30 rounded-full">
            <FiDatabase size={32} />
          </div>
          <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">No Entries Found</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {progress.total === 0 
              ? "No entries match your current filter settings. Try adjusting your filters."
              : "There are no entries to display on the current page. Try navigating to a different page."}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button 
              onClick={() => router.push('/labeling')}
              className="w-full sm:w-auto flex items-center justify-center"
            >
              <FiHome className="mr-2" /> Back to Dashboard
            </Button>
            {progress.total > 0 && (
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                className="w-full sm:w-auto flex items-center justify-center"
              >
                <FiArrowLeft className="mr-2" /> Previous Page
              </Button>
            )}
            {/* Add debug toggle button */}
            <Button
              variant="outline"
              onClick={toggleDebugMode}
              className="w-full sm:w-auto flex items-center justify-center"
            >
              Toggle Debug
            </Button>
            {/* Add refresh button */}
            <Button
              variant="outline"
              onClick={refreshUserEntryOrder}
              className="w-full sm:w-auto flex items-center justify-center"
            >
              Refresh Entry Order
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }
  
  const currentEntry = entries[currentIndex];
  const progressPercent = calculateProgress(progress.completed, progress.total);
  
  // Add refresh button to debug mode
  if (debugMode) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto py-16 px-4 text-center"
      >
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl shadow-md p-8 max-w-xl mx-auto">
          <div className="w-16 h-16 mx-auto mb-6 flex items-center justify-center text-blue-500 bg-blue-100 dark:bg-blue-900/30 rounded-full">
            <FiDatabase size={32} />
          </div>
          <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">Debug Mode</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Debug information for labeling interface
          </p>
          <div className="text-left bg-gray-100 dark:bg-gray-900 p-4 rounded-lg mb-6 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>Dataset ID:</div>
              <div className="font-mono">{id}</div>
              <div>User ID:</div>
              <div className="font-mono">{user?.id}</div>
              <div>Current Index:</div>
              <div className="font-mono">{currentIndex}</div>
              <div>Entries Per Page:</div>
              <div className="font-mono">{entriesPerPage}</div>
              <div>Total Entries:</div>
              <div className="font-mono">{progress.total}</div>
              <div>Filtered Total:</div>
              <div className="font-mono">{filteredTotal}</div>
              <div>Original Order Entries:</div>
              <div className="font-mono">{Object.keys(entryOriginalOrder).length}</div>
              <div>User Order Entries:</div>
              <div className="font-mono">{Object.keys(entryUserOrder).length}</div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button 
              onClick={() => router.push('/labeling')}
              className="w-full sm:w-auto flex items-center justify-center"
            >
              <FiHome className="mr-2" /> Back to Dashboard
            </Button>
            <Button
              variant="outline"
              onClick={refreshUserEntryOrder}
              className="w-full sm:w-auto flex items-center justify-center"
            >
              Refresh Entry Order
            </Button>
            <Button
              variant="outline"
              onClick={toggleDebugMode}
              className="w-full sm:w-auto flex items-center justify-center"
            >
              Toggle Debug
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  const isEntryLabeled = currentEntry ? completedEntries.has(currentEntry.id) : false;
  
  return (
    <div className="max-w-6xl mx-auto">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-lg p-6 text-white">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
              <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-bold">{dataset.name}</h1>
              {dataset.is_active === false && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
                  Inactive
                </span>
              )}
            </div>
              <div className="mt-2 flex items-center">
                <div className="w-2 h-2 rounded-full bg-green-400 mr-2"></div>
                <p className="text-white/90">
                  {progress.completed} of {progress.total} entries labeled • {progressPercent}% complete
                </p>
        </div>
            </div>
            <div className="flex items-center space-x-3">
              <Button 
                variant="outline" 
                className="bg-white/10 text-white border-white/20 hover:bg-white/10"
                onClick={() => router.push('/labeling')}
              >
                Back to Dashboard
              </Button>
              <div className="relative inline-block text-left">
                <div>
                  <button type="button" onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="inline-flex justify-center w-full rounded-md border border-white/20 shadow-sm px-4 py-2 bg-white/10 text-sm font-medium text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white" id="options-menu" aria-haspopup="true" aria-expanded="true">
                    {entriesPerPage}
                    <FiChevronDown className="-mr-1 ml-2 h-5 w-5" />
                  </button>
                </div>
                <AnimatePresence>
                  {isDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.1 }}
                      className="origin-top-right absolute right-0 mt-2 w-28 rounded-md shadow-lg bg-gray-800 ring-1 ring-black ring-opacity-5 z-10"
                    >
                      <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                        {[10, 25, 50, 100].map(value => (
                          <a href="#" key={value} onClick={(e) => { e.preventDefault(); changeEntriesPerPage(value); setIsDropdownOpen(false); }} className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white" role="menuitem">{value} Entries</a>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
        </div>
      </div>
      
          <div className="mt-6 relative h-4 bg-white/20 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="absolute left-0 top-0 h-full bg-white rounded-full"
            ></motion.div>
        <div 
              className="absolute top-0 right-0 bottom-0 bg-gradient-to-r from-transparent to-indigo-600 w-16 rounded-r-full"
              style={{ opacity: 0.3 }}
        ></div>
          </div>
      </div>
        
        <div className="flex flex-wrap gap-3 mt-4 justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
                <FiBarChart className="text-xl" />
              </div>
              <div className="ml-2">
                <div className="text-sm text-gray-500 dark:text-gray-400">Page</div>
                <div className="font-medium">{Math.floor(currentIndex / entriesPerPage) + 1} of {Math.ceil(filteredTotal / entriesPerPage)}</div>
              </div>
            </div>
            
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400">
                <FiCheck className="text-xl" />
              </div>
              <div className="ml-2">
                <div className="text-sm text-gray-500 dark:text-gray-400">Labeled</div>
                <div className="font-medium">{completedEntries.size} entries</div>
              </div>
            </div>
            
            {/* Display last labeled page information */}
            {lastLabeledPage !== null && (
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400">
                  <FiTag className="text-xl" />
                </div>
                <div className="ml-2">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Last Labeled Page</div>
                  <div className="font-medium">Page {lastLabeledPage + 1}</div>
                </div>
              </div>
            )}
            
            {/* Score Filter */}
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400">
                <FiFilter className="text-xl" />
              </div>
              <div className="ml-2 relative">
                <div className="text-sm text-gray-500 dark:text-gray-400">Filter</div>
                {hasScoreColumn ? (
                  <div className="flex flex-wrap gap-1 items-center">
                    {(['all', '1', '2', '3', '4', '5'] as const).map(score => (
                      <label key={score} className="flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={pendingScoreFilters.includes(score)}
                          onChange={(e) => {
                            let newFilters: ('all' | '1' | '2' | '3' | '4' | '5')[] = [...pendingScoreFilters];
                            if (e.target.checked) {
                              // If 'all' is selected, clear other filters
                              if (score === 'all') {
                                newFilters = ['all'];
                              } else {
                                // Remove 'all' if selecting specific scores
                                const filtered = newFilters.filter(f => f !== 'all');
                                newFilters = [...filtered, score];
                                // If all specific scores are selected, switch to 'all'
                                if (newFilters.length === 5) {
                                  newFilters = ['all'];
                                }
                              }
                            } else {
                              // If unchecking 'all', select all specific scores
                              if (score === 'all') {
                                newFilters = ['1', '2', '3', '4', '5'];
                              } else {
                                // Remove the unchecked score
                                newFilters = newFilters.filter(f => f !== score);
                                // If no filters left, select 'all'
                                if (newFilters.length === 0) {
                                  newFilters = ['all'];
                                }
                              }
                            }
                            setPendingScoreFilters(newFilters);
                          }}
                          className="rounded text-purple-600 focus:ring-purple-500"
                        />
                        <span className="font-medium">
                          {score === 'all' ? 'All' : `Score ${score}`}
                        </span>
                      </label>
                    ))}
                    <Button
                      onClick={() => {
                        const newFilters = [...pendingScoreFilters];
                        setScoreFilters(newFilters);
                        resetFilter(newFilters);
                      }}
                      className="ml-2 px-2 py-1 text-xs"
                      variant="outline"
                    >
                      Apply
                    </Button>
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 dark:text-gray-400 italic">
                    No score column in dataset
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center">
            {Object.keys(selectedLabels).length > 0 && (
              <div className="mr-3 text-sm bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-md px-3 py-1 animate-pulse">
                {Object.keys(selectedLabels).length} new label{Object.keys(selectedLabels).length !== 1 ? 's' : ''} ready to submit
              </div>
            )}
            <Button
              onClick={handleSubmitLabels}
              isLoading={submitting}
              disabled={Object.keys(selectedLabels).length === 0 || submitting}
              className={cn(
                "transition-all",
                Object.keys(selectedLabels).length > 0 
                  ? "bg-green-600 hover:bg-green-700" 
                  : "bg-gray-400 dark:bg-gray-700"
              )}
            >
              <FiCheck className="mr-2" /> 
              Submit {Object.keys(selectedLabels).length > 0 ? Object.keys(selectedLabels).length : ''} 
              {Object.keys(selectedLabels).length > 0 
                ? ` Label${Object.keys(selectedLabels).length !== 1 ? 's' : ''}` 
                : 'Labels'
              }
            </Button>
          </div>
        </div>
      </motion.div>
      
      <div className="space-y-6">
        <AnimatePresence>
        {currentPageEntries.map((entry, idx) => (
            <motion.div 
              key={entry.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
            >
              <Card className={cn(
                "overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all",
                selectedLabels[entry.id] && !submittedLabels[entry.id] 
                  ? "ring-2 ring-blue-500 ring-opacity-50" 
                  : ""
              )}>
                {/* Colored top border based on label status */}
                <div className={cn(
                  "h-1.5 w-full",
                  selectedLabels[entry.id] ? (
                    selectedLabels[entry.id] === 'positive' ? "bg-green-500" :
                    selectedLabels[entry.id] === 'negative' ? "bg-red-500" : "bg-yellow-500"
                  ) : submittedLabels[entry.id] ? (
                    submittedLabels[entry.id] === 'positive' ? "bg-green-400" :
                    submittedLabels[entry.id] === 'negative' ? "bg-red-400" : "bg-yellow-400"
                  ) : "bg-gray-300 dark:bg-gray-600"
                )}></div>
                
                {/* Auto-labeled indicator */}
                {selectedLabels[entry.id] && !submittedLabels[entry.id] && (
                  <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center">
                    <FiTag className="mr-1" size={12} />
                    AUTO
                  </div>
                )}
                
                <div className="p-3 sm:p-4">
                  {/* Compact header */}
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-6 h-6 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-medium">
                        {currentIndex + idx + 1}
                      </div>
                      <span className="font-medium text-sm">Entry #{currentIndex + idx + 1}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Compact status pills */}
                      {submittedLabels[entry.id] && (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full text-xs">
                          <span className="font-medium capitalize">{submittedLabels[entry.id]}</span>
                        </div>
                      )}
                      
                      {selectedLabels[entry.id] && (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full text-xs">
                          <span className="font-medium capitalize">{selectedLabels[entry.id]}</span>
                        </div>
                      )}
                      
                      {/* Compact rating */}
                      <div className="flex items-center bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full">
            <div className="flex items-center">
                          {entry.score === null ? (
                            <span className="text-xs text-gray-500 dark:text-gray-400">No rating</span>
                          ) : (
                            <>
                              <span className="mr-1 text-xs text-gray-600 dark:text-gray-400">Rating Play Store:</span>
                    {[...Array(entry.score)].map((_, i) => (
                                <FiStar key={i} className={`${getRatingClass(entry.score)} w-3 h-3`} fill="currentColor" />
                ))}
                    {[...Array(5 - entry.score)].map((_, i) => (
                                <FiStar key={i} className="text-gray-300 dark:text-gray-700 w-3 h-3" />
                ))}
                            </>
                          )}
              </div>
            </div>
          </div>
                  </div>
                  
                  {/* Content and labels side-by-side on larger screens */}
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    {/* Text container - takes 3/5 of space on larger screens */}
                    <div className="md:col-span-3">
                      <div className="bg-gray-50 dark:bg-gray-800/80 p-3 rounded-md border border-gray-200 dark:border-gray-700 shadow-inner text-sm h-full">
                  <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{entry.text}</p>
          </div>
                    </div>
                    
                    {/* Labels container - takes 2/5 of space on larger screens */}
                    <div className="md:col-span-2">
                      <div className="h-full">
                        {renderLabelingButtons(entry.id)}
                      </div>
                    </div>
                  </div>
                </div>
          </Card>
            </motion.div>
        ))}
        </AnimatePresence>
      </div>
      
      <motion.div 
        className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shadow-lg py-4 px-6 z-10"
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4 w-full sm:w-auto justify-center sm:justify-start order-2 sm:order-1">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={progress.total <= 0 || currentIndex === 0}
              className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750"
        >
              <FiArrowLeft className="mr-2" /> Previous
        </Button>
        
            {/* Pagination component */}
            <div className="flex items-center">
        <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentIndex(0)}
                disabled={progress.total <= 0 || currentIndex === 0}
                className="px-2"
              >
                <FiChevronsLeft />
        </Button>
              
              <div className="flex items-center space-x-1">
                {getPaginationRange().map((pageNum, index) => {
                  const isCurrent = Math.floor(currentIndex / entriesPerPage) === pageNum - 1;
                  
                  return (
                    <Button
                      key={pageNum === -1 ? `ellipsis-${index}` : pageNum}
                      variant={isCurrent ? "default" : "ghost"}
                      size="sm"
                      onClick={() => handlePageSelect(pageNum)}
                      className={cn(
                        "w-8 h-8 p-0 font-medium",
                        isCurrent ? "bg-blue-600 text-white" : "text-gray-700 dark:text-gray-300"
                      )}
                      disabled={pageNum === -1} // Disabled if it's a separator (...)

                    >
                      {pageNum === -1 ? "..." : pageNum}
                    </Button>
                  );
                })}
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentIndex(Math.floor((filteredTotal - 1) / entriesPerPage) * entriesPerPage)}
                disabled={filteredTotal <= 0 || currentIndex + entriesPerPage >= filteredTotal}
                className="px-2"
              >
                <FiChevronsRight />
              </Button>
            </div>
        
        <Button
          variant="outline"
          onClick={handleNext}
              disabled={filteredTotal <= 0 || currentIndex + entriesPerPage >= filteredTotal}
              className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750"
        >
              Next <FiArrowRight className="ml-2" />
        </Button>
      </div>
      
      {/* Direct page navigation input */}
      <div className="flex items-center ml-4">
        <span className="text-gray-700 dark:text-gray-300 mr-2">Go to Page:</span>
        <input
          type="number"
          min="1"
          max={Math.ceil(filteredTotal / entriesPerPage)}
          value={directPageInput}
          onChange={(e) => setDirectPageInput(e.target.value)}
          className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-center bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleDirectPageNavigation();
            }
          }}
        />
        <Button
          onClick={handleDirectPageNavigation}
          className="ml-2 px-3 py-1 text-sm"
          disabled={!directPageInput || parseInt(directPageInput) < 1 || parseInt(directPageInput) > Math.ceil(filteredTotal / entriesPerPage)}
        >
          Go
        </Button>
      </div>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ 
              opacity: Object.keys(selectedLabels).length > 0 ? 1 : 0.7,
              scale: Object.keys(selectedLabels).length > 0 ? 1 : 0.95
            }}
            className="flex items-center order-1 sm:order-2 w-full sm:w-auto"
          >
            <Button
              onClick={handleSubmitLabels}
              isLoading={submitting}
              disabled={Object.keys(selectedLabels).length === 0 || submitting}
              className={cn(
                "transition-all w-full sm:w-auto",
                Object.keys(selectedLabels).length > 0 
                  ? "bg-green-600 hover:bg-green-700" 
                  : "bg-gray-400 dark:bg-gray-700"
              )}
            >
              <FiCheck className="mr-2" /> 
              Submit {Object.keys(selectedLabels).length > 0 ? Object.keys(selectedLabels).length : ''} 
              {Object.keys(selectedLabels).length > 0 
                ? ` Label${Object.keys(selectedLabels).length !== 1 ? 's' : ''}` 
                : 'Labels'
              }
            </Button>
          </motion.div>
        </div>
      </motion.div>
      
      {/* Auto-labeling buttons */}
      {(() => {
        // Use the same condition as in renderAutoLabelButtons function
        const showButtons = false;
        return showButtons && (
          <div 
            ref={stickyButtonsRef}
            className="fixed right-6 top-1/2 transform -translate-y-1/2 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 border border-gray-200 dark:border-gray-700 z-40"
          >
            {renderAutoLabelButtons()}
          </div>
        );
      })()}

      <div className="pb-24"></div>
    </div>
  );
}

