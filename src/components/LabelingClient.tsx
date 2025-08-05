'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Dataset, DatasetEntry, LabelOption } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { toast } from 'react-hot-toast';
import { calculateProgress, cn } from '@/lib/utils';
import { FiArrowRight, FiArrowLeft, FiCheck, FiX, FiMinus, FiStar, FiLoader, FiAlertCircle, FiHome, FiArrowUp, FiBarChart, FiDatabase, FiChevronsLeft, FiChevronsRight, FiChevronDown } from 'react-icons/fi';
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

interface LabelingClientProps {
  id: string;
}

export default function LabelingClient({ id }: LabelingClientProps) {
  const { user } = useAuth();
  const router = useRouter();
  
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [entries, setEntries] = useState<DatasetEntry[]>([]);
  const [pageEntries, setPageEntries] = useState<DatasetEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedLabels, setSelectedLabels] = useState<Record<string, LabelOption>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0, start_date: null as string | null });
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [completedEntries, setCompletedEntries] = useState<Set<string>>(new Set());
  const [previousLabels, setPreviousLabels] = useState<Record<string, LabelOption>>({});
  const [submittedLabels, setSubmittedLabels] = useState<Record<string, LabelOption>>({});
  const [debugMode, setDebugMode] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [entryOriginalOrder, setEntryOriginalOrder] = useState<Record<string, number>>({});
  
  // Completely rewritten fetchDatasetAndEntries function
  const fetchDatasetAndEntries = useCallback(async () => {
    try {
      console.log('⏳ Fetching dataset and entries...');
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
      
      setDataset(datasetData);
      setProgress({
        completed: progressRecord?.completed || 0,
        total: progressRecord?.total || 0,
        start_date: progressRecord?.start_date || null
      });
      
      // Determine which page to load - use last_page if available, otherwise start from 0
      const lastPage = progressRecord?.last_page || 0;
      const startIndex = lastPage * entriesPerPage;
      
      // Set current index to the last page the user was on
      if (startIndex < progressRecord?.total) {
        setCurrentIndex(startIndex);
        console.log(`🔍 Resuming from last page: ${lastPage + 1}`);
      }
      
      // Fetch entries for the last page the user was on
      await loadPageEntries(lastPage, entriesPerPage);
      
      console.log('✅ Initial fetch complete');
    } catch (error) {
      console.error('❌ Error fetching data:', error);
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }, [id, user?.id, entriesPerPage]);

  useEffect(() => {
    if (user && id) {
      fetchDatasetAndEntries();
    }
  }, [user, id, fetchDatasetAndEntries]);
  
  // Fix the loadPageEntries function to handle large page sizes correctly
  const loadPageEntries = async (pageIndex: number, pageSize: number) => {
    try {
      console.log(`⏳ Loading page ${pageIndex + 1} with size ${pageSize}...`);
      
      // Clear existing data for this page
      setSubmittedLabels({});
      setPreviousLabels({});
      setCompletedEntries(new Set());
      setSelectedLabels({});
      setPageEntries([]);
      
      // Calculate range for this page
      const start = pageIndex * pageSize;
      const end = start + pageSize - 1;
      
      console.log(`Fetching entries from ${start} to ${end}`);
      
      // First attempt to get ALL entry IDs to establish the master order if we don't have it yet
      if (Object.keys(entryOriginalOrder).length === 0) {
        try {
          console.log("Fetching all entry IDs to establish original order...");
          
          // Simplified query that just gets all entries in a consistent order
          // Removed created_at sorting which might cause errors
          const { data: allEntryIds, error: idsError } = await supabase
            .from('dataset_entries')
            .select('id')
            .eq('dataset_id', id)
            .order('id');
            
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
            
            console.log(`✅ Established order for ${allEntryIds.length} entries`);
            setEntryOriginalOrder(orderMap);
          }
        } catch (orderError) {
          console.error("Error establishing original order:", orderError);
          console.error("Full error:", orderError instanceof Error ? orderError.message : String(orderError));
          // Continue with the query even if this fails
        }
      }
      
      // Fetch total entries count to validate we're not requesting beyond the dataset size
      const { count: totalCount, error: countError } = await supabase
        .from('dataset_entries')
        .select('*', { count: 'exact', head: true })
        .eq('dataset_id', id);
      
      if (countError) {
        console.error("Error counting entries:", countError);
        throw countError;
      }
      
      // Ensure our range is valid based on total count
      const validEnd = totalCount ? Math.min(end, totalCount - 1) : end;
      
      console.log(`Total entries: ${totalCount}, adjusted range: ${start} to ${validEnd}`);
      
      // Check if the starting point is beyond available data
      if (totalCount && start >= totalCount) {
        console.warn(`Start index ${start} is beyond total entries ${totalCount}`);
        // Reset to first page in case of invalid range
        const { data: firstPageData, error: firstPageError } = await supabase
          .from('dataset_entries')
          .select('*')
          .eq('dataset_id', id)
          .order('id')
          .range(0, pageSize - 1);
        
        if (firstPageError) {
          console.error("Error fetching first page:", firstPageError);
          throw firstPageError;
        }
        
        if (firstPageData && firstPageData.length > 0) {
          console.log(`✅ Recovered by loading first page with ${firstPageData.length} entries`);
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
      
      // Fetch entries for this specific page with simpler query
      const { data: entriesData, error: entriesError } = await supabase
        .from('dataset_entries')
        .select('*')
        .eq('dataset_id', id)
        .order('id') // Basic ordering to ensure consistency
        .range(start, validEnd);
      
      if (entriesError) {
        console.error("❌ Error fetching entries:", entriesError);
        console.error("Error details:", JSON.stringify(entriesError));
        throw entriesError;
      }
      
      if (!entriesData || entriesData.length === 0) {
        console.log("No entries found for this page");
        // Try to recover by loading the first page
        const { data: firstPageData, error: firstPageError } = await supabase
          .from('dataset_entries')
          .select('*')
          .eq('dataset_id', id)
          .order('id')
          .range(0, pageSize - 1);
        
        if (firstPageError) {
          console.error("Error fetching first page:", firstPageError);
          throw firstPageError;
        }
        
        if (firstPageData && firstPageData.length > 0) {
          console.log(`✅ Recovered by loading first page with ${firstPageData.length} entries`);
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
      
      // Sort entries based on original order if available
      const sortedEntries = [...entriesData];
      if (Object.keys(entryOriginalOrder).length > 0) {
        sortedEntries.sort((a, b) => {
          const orderA = entryOriginalOrder[a.id] ?? Number.MAX_SAFE_INTEGER;
          const orderB = entryOriginalOrder[b.id] ?? Number.MAX_SAFE_INTEGER;
          return orderA - orderB;
        });
        console.log("Entries sorted according to original order");
      } else {
        console.log("Using default order by ID (original order mapping not available)");
      }
      
      const entryIds = sortedEntries.map(e => e.id);
      console.log(`Page entry IDs in display order: ${entryIds.length} entries`);

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
      
      console.log(`✅ Loaded page ${pageIndex + 1} with ${sortedEntries.length} entries`);
    } catch (error) {
      console.error('❌ Error loading page:', error);
      toast.error('Failed to load page. Trying to recover...');
      
      // Last resort recovery - load first page with a smaller size
      try {
        const { data: recoveryData } = await supabase
          .from('dataset_entries')
          .select('*')
          .eq('dataset_id', id)
          .order('id')
          .range(0, 9); // First 10 entries
          
        if (recoveryData && recoveryData.length > 0) {
          console.log('✅ Emergency recovery with 10 entries successful');
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
  };
  
  // Helper function to process entry labels
  const processEntryLabels = async (entryIds: string[], entries: any[]) => {
    if (!entryIds.length) return;
    
    try {
      // Now fetch labels ONLY for these exact entries
      console.log(`Fetching labels for ${entryIds.length} entries on this page`);

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
        console.log(`Found ${labelData.length} labels for this page`);
        
        labelData.forEach(item => {
          // Verify this ID is in our current page
          if (entryIds.includes(item.entry_id)) {
            pageLabels[item.entry_id] = item.label as LabelOption;
            pageCompletedEntries.add(item.entry_id);
          } else {
            console.warn(`Found label for ID ${item.entry_id} but it's not on this page!`);
          }
        });
        
        console.log(`Page completed entries: ${pageCompletedEntries.size}`);
      } else {
        console.log('No labels found for this page');
      }
      
      // Update state with the new data
      setSubmittedLabels(pageLabels);
      setPreviousLabels(pageLabels);
      setCompletedEntries(pageCompletedEntries);
    } catch (error) {
      console.error('Error processing labels:', error);
    }
  };
  
  // Update handlePageSelect to save the last page
  function handlePageSelect(pageNum: number) {
    if (pageNum === -1) return; // Skip separators
    const newIndex = (pageNum - 1) * entriesPerPage;
    if (newIndex >= 0 && newIndex < progress.total) {
      if (newIndex === currentIndex) return;
      
      setLoading(true);
      loadPageEntries(pageNum - 1, entriesPerPage).then(() => {
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
  
  // Add function to update the last page in the database
  const updateLastPage = async (pageIndex: number) => {
    try {
      const { error } = await supabase
        .from('label_progress')
        .update({ last_page: pageIndex })
        .eq('dataset_id', id)
        .eq('user_id', user?.id);

      if (error) {
        console.error("Error updating last page:", error);
      } else {
        console.log(`✅ Last page updated to: ${pageIndex + 1}`);
      }
    } catch (err) {
      console.error("Failed to update last page:", err);
    }
  };
  
  // Modify handleNext to save the last page
  const handleNext = async () => {
    try {
      setLoading(true);
      const nextIndex = currentIndex + entriesPerPage;
      const nextPage = Math.floor(nextIndex / entriesPerPage);
      
      console.log(`⏳ Navigating to next page: ${nextPage + 1}`);
      
      // Clear selections first
      setSelectedLabels({});
      
      // Load this page data
      await loadPageEntries(nextPage, entriesPerPage);
      
      // Now update the current index
      setCurrentIndex(nextIndex);
      
      // Save the last page to the database
      await updateLastPage(nextPage);
      
      console.log(`✅ Navigation complete`);
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
      console.log(`⏳ Navigating to previous page: ${currentIndex / entriesPerPage}`);
      
      // Clear selections
      setSelectedLabels({});
      
      const prevIndex = currentIndex - entriesPerPage;
      const prevPage = Math.floor(prevIndex / entriesPerPage);
      
      // Load the previous page data
      loadPageEntries(prevPage, entriesPerPage).then(() => {
        // Update current index
        setCurrentIndex(prevIndex);
        
        // Save the last page to the database
        updateLastPage(prevPage);
        
        console.log(`✅ Navigation complete`);
      });
    }
  };
  
  // Modify handleSubmitLabels to use the new approach
  const handleSubmitLabels = async () => {
    if (Object.keys(selectedLabels).length === 0 || !user) return;
    
    try {
      console.log('⏳ Submitting labels:', selectedLabels);
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

      console.log(`Processing ${updateLabels.length} updates and ${newLabels.length} new labels`);

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
        const progressUpdate: any = {
          last_updated: new Date().toISOString(),
        };

        if (newCompletedCount > 0) {
          const newTotal = Math.min(progress.completed + newCompletedCount, progress.total);
          progressUpdate.completed = newTotal;
          if (!progress.start_date) {
            progressUpdate.start_date = new Date().toISOString();
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
          start_date: progressUpdate.start_date || prev.start_date
        }));
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
      await loadPageEntries(pageNumber, entriesPerPage);
      
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

      console.log('✅ Labels submitted successfully');
    } catch (error: any) {
      console.error('❌ Error submitting labels:', error);
      toast.error(error.message || 'Gagal menyimpan label');
    } finally {
      setSubmitting(false);
    }
  };
  
  // Update changeEntriesPerPage to handle large page sizes better
  const changeEntriesPerPage = (count: number) => {
    console.log(`⏳ Changing entries per page to ${count}`);
    
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
    loadPageEntries(0, count)
      .then(() => {
        console.log(`✅ Successfully changed to ${count} entries per page`);
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
    console.log("Debug mode toggled");
  };
  
  // Helper function to generate pagination range with ellipsis
  function getPaginationRange() {
    const totalPages = Math.ceil(progress.total / entriesPerPage);
    const currentPage = Math.floor(currentIndex / entriesPerPage) + 1;
    
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
          <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">No Entries on This Page</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            There are no entries to display on the current page. Try navigating to a different page.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button 
              onClick={() => router.push('/labeling')}
              className="w-full sm:w-auto flex items-center justify-center"
            >
              <FiHome className="mr-2" /> Back to Dashboard
            </Button>
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
              className="w-full sm:w-auto flex items-center justify-center"
          >
              <FiArrowLeft className="mr-2" /> Previous Page
          </Button>
            {/* Add debug toggle button */}
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
  
  const currentEntry = entries[currentIndex];
  const progressPercent = calculateProgress(progress.completed, progress.total);
  const isEntryLabeled = completedEntries.has(currentEntry.id);
  
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
              <h1 className="text-2xl md:text-3xl font-bold">{dataset.name}</h1>
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
                className="bg-white/10 text-white border-white/20 hover:bg-white/20"
                onClick={() => router.push('/labeling')}
              >
                Back to Dashboard
              </Button>
              <div className="relative inline-block text-left">
                <div>
                  <button type="button" onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="inline-flex justify-center w-full rounded-md border border-white/20 shadow-sm px-4 py-2 bg-white/10 text-sm font-medium text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white" id="options-menu" aria-haspopup="true" aria-expanded="true">
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
                <div className="font-medium">{Math.floor(currentIndex / entriesPerPage) + 1} of {Math.ceil(progress.total / entriesPerPage)}</div>
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
              <Card className="overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all">
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
                      <div className="grid grid-cols-3 gap-2">
                        <motion.button
          type="button"
                          className={getLabelButtonClass('positive', entry.id) + " p-2 py-3"}
                    onClick={() => handleLabelSelect(entry.id, 'positive')}
          disabled={submitting}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
        >
                          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 mx-auto mb-1">
          {getLabelIcon('positive')}
                          </div>
                          <span className="font-medium text-sm">Positive</span>
                    {selectedLabels[entry.id] === 'positive' && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.5 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="absolute top-1 right-1 bg-green-500 text-white rounded-full text-xs font-bold w-4 h-4 flex items-center justify-center"
                            >
                              ✓
                            </motion.div>
                          )}
                        </motion.button>
                        
                        <motion.button
          type="button"
                          className={getLabelButtonClass('neutral', entry.id) + " p-2 py-3"}
                    onClick={() => handleLabelSelect(entry.id, 'neutral')}
          disabled={submitting}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
        >
                          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 mx-auto mb-1">
          {getLabelIcon('neutral')}
                          </div>
                          <span className="font-medium text-sm">Neutral</span>
                    {selectedLabels[entry.id] === 'neutral' && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.5 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="absolute top-1 right-1 bg-yellow-500 text-white rounded-full text-xs font-bold w-4 h-4 flex items-center justify-center"
                            >
                              ✓
                            </motion.div>
                          )}
                        </motion.button>
                        
                        <motion.button
          type="button"
                          className={getLabelButtonClass('negative', entry.id) + " p-2 py-3"}
                    onClick={() => handleLabelSelect(entry.id, 'negative')}
          disabled={submitting}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
        >
                          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 mx-auto mb-1">
          {getLabelIcon('negative')}
                          </div>
                          <span className="font-medium text-sm">Negative</span>
                    {selectedLabels[entry.id] === 'negative' && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.5 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full text-xs font-bold w-4 h-4 flex items-center justify-center"
                            >
                              ✓
                            </motion.div>
                          )}
                        </motion.button>
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
          disabled={currentIndex === 0}
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
                disabled={currentIndex === 0}
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
                onClick={() => setCurrentIndex(Math.floor((progress.total - 1) / entriesPerPage) * entriesPerPage)}
                disabled={currentIndex + entriesPerPage >= progress.total}
                className="px-2"
              >
                <FiChevronsRight />
              </Button>
            </div>
        
        <Button
          variant="outline"
          onClick={handleNext}
              disabled={currentIndex + entriesPerPage >= progress.total}
              className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750"
        >
              Next <FiArrowRight className="ml-2" />
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
      
      <div className="pb-24"></div>
    </div>
  );
}
