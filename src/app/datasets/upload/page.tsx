'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { generateRandomCode } from '@/lib/utils';
import { toast } from 'react-hot-toast';
import { FiUpload, FiCheck, FiAlertCircle, FiInfo } from 'react-icons/fi';
import Papa from 'papaparse';

export default function UploadDataset() {
  const { user } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState({
    name: '',
    file: '',
    csvFormat: '',
  });
  const [csvValidationResult, setCsvValidationResult] = useState<{
    isValid: boolean;
    message: string;
    totalRows: number;
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    setErrors({ ...errors, file: '', csvFormat: '' });
    setCsvValidationResult(null);
    
    if (!selectedFile) {
      return;
    }
    
    if (!selectedFile.name.endsWith('.csv')) {
      setErrors({ ...errors, file: 'File must be in CSV format' });
      return;
    }
    
    setFile(selectedFile);
    validateCsvFile(selectedFile);
  };

  const validateCsvFile = (csvFile: File) => {
    Papa.parse(csvFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as any[];
        const requiredColumns = ['text'];
        const headers = Object.keys(rows[0] || {});
        
        const missingColumns = requiredColumns.filter(col => !headers.includes(col));
        
        if (missingColumns.length > 0) {
          setCsvValidationResult({
            isValid: false,
            message: `CSV is missing required column: ${missingColumns.join(', ')}`,
            totalRows: 0,
          });
          return;
        }
        
        const hasScoreColumn = headers.includes('score');
        
        if (hasScoreColumn) {
          const invalidScores = rows.some(row => {
            const score = parseInt(row.score);
            return isNaN(score) || score < 1 || score > 5;
          });
          
          if (invalidScores) {
            setCsvValidationResult({
              isValid: false,
              message: 'Score values must be between 1 and 5',
              totalRows: rows.length,
            });
            return;
          }
        }
        
        const emptyTexts = rows.some(row => !row.text.trim());
        
        if (emptyTexts) {
          setCsvValidationResult({
            isValid: false,
            message: 'Some text fields are empty',
            totalRows: rows.length,
          });
          return;
        }
        
        setCsvValidationResult({
          isValid: true,
          message: `CSV is valid, ${rows.length} rows detected${!hasScoreColumn ? ' (entries will have no rating)' : ''}`,
          totalRows: rows.length,
        });
      },
      error: (error) => {
        setCsvValidationResult({
          isValid: false,
          message: `Error parsing CSV: ${error.message}`,
          totalRows: 0,
        });
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate inputs
    const formErrors = {
      name: !name.trim() ? 'Dataset name is required' : '',
      file: !file ? 'Please upload a CSV file' : '',
      csvFormat: csvValidationResult && !csvValidationResult.isValid ? csvValidationResult.message : '',
    };
    
    if (formErrors.name || formErrors.file || formErrors.csvFormat) {
      setErrors(formErrors);
      return;
    }
    
    // Define dataset variable in higher scope so it's available in the catch block
    let dataset: any = null;
    
    try {
      setIsUploading(true);
      
      // 1. Create a dataset entry in Supabase
      const invite_code = generateRandomCode(8);
      const { data: datasetData, error: datasetError } = await supabase
        .from('datasets')
        .insert({
          name,
          description,
          owner_id: user?.id,
          total_entries: csvValidationResult?.totalRows || 0,
          invite_code,
          is_active: true, // Default to active when creating a new dataset
        })
        .select()
        .single();
      
      if (datasetError) throw datasetError;
      
      // Ensure dataset is not undefined
      if (!datasetData) throw new Error("Failed to create dataset");
      
      // Assign to outer scope variable
      dataset = datasetData;
      
      // Create label progress entry for dataset owner
      const { error: progressError } = await supabase
        .from('label_progress')
        .insert({
          dataset_id: dataset.id,
          user_id: user?.id,
          completed: 0,
          total: csvValidationResult?.totalRows || 0,
        });
      
      if (progressError) throw progressError;
      
      // 2. Upload file to storage
      if (!file) throw new Error("File is missing");
      
      const filePath = `datasets/${dataset.id}/${file.name}`;
      const { error: uploadError } = await supabase
        .storage
        .from('csvfiles')
        .upload(filePath, file);
      
      if (uploadError) throw uploadError;
      
      // Update dataset with file path
      const { error: updateError } = await supabase
        .from('datasets')
        .update({ file_path: filePath })
        .eq('id', dataset.id);
      
      if (updateError) throw updateError;
      
      // 3. Parse CSV and insert entries into database
      // Parse the CSV into rows up front before inserting
      const parseResult = await new Promise((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => resolve(results),
          error: (error) => reject(error)
        });
      });
      
      const rows = (parseResult as any).data as any[];
      
      // Ensure rows exist and aren't empty
      if (!rows || rows.length === 0) {
        toast.error('No valid data found in CSV');
        setIsUploading(false);
        return;
      }
      
      const headers = Object.keys(rows[0] || {});
      const hasScoreColumn = headers.includes('score');
      
      // Break entries into chunks to avoid hitting limits
      const chunkSize = 500;
      const entryIds: string[] = [];
      const negativeEntries: { dataset_id: string; entry_id: string; user_id: string; label: 'negative' }[] = [];
      
      for (let i = 0; i < rows.length; i += chunkSize) {
        try {
          const chunk = rows.slice(i, i + chunkSize).map(row => ({
            dataset_id: dataset.id,
            text: row.text,
            score: hasScoreColumn ? parseInt(row.score) : null,
          }));
          
          const { data: insertedEntries, error: entriesError } = await supabase
            .from('dataset_entries')
            .insert(chunk)
            .select('id, score');
          
          if (entriesError) {
            console.error(`Error inserting chunk ${i/chunkSize + 1}:`, entriesError);
            throw entriesError;
          }
          
          // Collect entry IDs for automatic labeling
          if (insertedEntries) {
            entryIds.push(...insertedEntries.map(entry => entry.id));
            
            // Prepare automatic labels for scores 1-2
            if (hasScoreColumn) {
              insertedEntries.forEach(entry => {
                const score = entry.score;
                if (score !== null && score >= 1 && score <= 2) {
                  negativeEntries.push({
                    dataset_id: dataset.id,
                    entry_id: entry.id,
                    user_id: user?.id as string,
                    label: 'negative'
                  });
                }
              });
            }
          }
        } catch (chunkError) {
          console.error(`Failed to process chunk starting at row ${i}:`, chunkError);
          throw chunkError;
        }
      }
      
      // Insert automatic labels for entries with scores 1-2 for the owner
      if (negativeEntries.length > 0) {
        const { error: labelError } = await supabase
          .from('dataset_labels')
          .insert(negativeEntries);
        
        if (labelError) {
          console.error('Error inserting automatic labels:', labelError);
        } else {
          // Update progress for automatically labeled entries for the owner
          const { error: progressError } = await supabase
            .from('label_progress')
            .update({ 
              completed: negativeEntries.length,
              last_updated: new Date().toISOString()
            })
            .eq('dataset_id', dataset.id)
            .eq('user_id', user?.id);
          
          if (progressError) {
            console.error('Error updating progress for owner:', progressError);
          }
        }
      }
      
      // Apply automatic labels for all users who have joined this dataset
      try {
        // Find all users who have joined this dataset (excluding the owner)
        const { data: joinedUsers, error: usersError } = await supabase
          .from('label_progress')
          .select('user_id')
          .eq('dataset_id', dataset.id)
          .neq('user_id', user?.id);
        
        // Find all entries with scores 1-2 (with pagination to get all entries)
        const allNegativeEntries = [];
        let continueFetching = true;
        let offset = 0;
        const limit = 1000; // Supabase default limit
        
        while (continueFetching) {
          const { data: batch, error: entriesError } = await supabase
            .from('dataset_entries')
            .select('id, score')
            .eq('dataset_id', dataset.id)
            .in('score', [1, 2])
            .range(offset, offset + limit - 1);
          
          if (entriesError) {
            throw entriesError;
          }
          
          if (batch && batch.length > 0) {
            allNegativeEntries.push(...batch);
            // If we got less than the limit, we've fetched all entries
            if (batch.length < limit) {
              continueFetching = false;
            } else {
              offset += limit;
            }
          } else {
            continueFetching = false;
          }
        }
        
        if (usersError) {
          console.error('Error fetching joined users:', usersError);
        } else if (joinedUsers && joinedUsers.length > 0 && allNegativeEntries.length > 0) {
          // Create automatic labels for each joined user
          const allAutomaticLabels = [];
          const userProgressUpdates = [];
          
          for (const joinedUser of joinedUsers) {
            // Create labels for this user
            const userLabels = allNegativeEntries.map(entry => ({
              dataset_id: dataset.id,
              entry_id: entry.id,
              user_id: joinedUser.user_id,
              label: 'negative'
            }));
            
            allAutomaticLabels.push(...userLabels);
            
            // Prepare progress update for this user
            userProgressUpdates.push({
              user_id: joinedUser.user_id,
              completed: allNegativeEntries.length
            });
          }
          
          // Insert all automatic labels for joined users
          if (allAutomaticLabels.length > 0) {
            const { error: bulkLabelError } = await supabase
              .from('dataset_labels')
              .insert(allAutomaticLabels);
            
            if (bulkLabelError) {
              console.error('Error inserting automatic labels for joined users:', bulkLabelError);
            } else {
              // Update progress for all joined users
              for (const update of userProgressUpdates) {
                const { error: userProgressError } = await supabase
                  .from('label_progress')
                  .update({ 
                    completed: update.completed,
                    last_updated: new Date().toISOString()
                  })
                  .eq('dataset_id', dataset.id)
                  .eq('user_id', update.user_id);
                
                if (userProgressError) {
                  console.error(`Error updating progress for user ${update.user_id}:`, userProgressError);
                }
              }
            }
          }
        }
      } catch (joinedUsersError) {
        console.error('Error applying automatic labels to joined users:', joinedUsersError);
      }
      
      // All chunks inserted successfully
      toast.success('Dataset uploaded successfully!');
      setIsUploading(false);
      router.push(`/datasets/${dataset.id}`);
      
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(`Failed to upload dataset: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsUploading(false);
      
      // If dataset was created but entries failed, clean up the dataset
      try {
        if (dataset?.id) {
          const { error: deleteError } = await supabase
            .from('datasets')
            .delete()
            .eq('id', dataset.id);
          
          if (deleteError) {
            console.error('Error cleaning up dataset after failed upload:', deleteError);
          }
        }
      } catch (cleanupError) {
        console.error('Error during cleanup:', cleanupError);
      }
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden p-4">
      {/* Decorative Blobs - fixed and full screen */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-purple-300 dark:bg-purple-900 rounded-full mix-blend-multiply filter blur-2xl opacity-40 animate-blob" />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-indigo-300 dark:bg-indigo-900 rounded-full mix-blend-multiply filter blur-2xl opacity-40 animate-blob animation-delay-2000" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-pink-300 dark:bg-pink-900 rounded-full mix-blend-multiply filter blur-2xl opacity-30 animate-blob animation-delay-4000" />
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900" />
      </div>

      <Card className="w-full max-w-2xl z-10 shadow-2xl backdrop-blur-md bg-white/80 dark:bg-gray-900/80 border border-white/30 dark:border-gray-700/60">
        <CardHeader>
          <CardTitle className="text-2xl">Upload a New Dataset</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Dataset Name
              </label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Customer Feedback Q1"
                className="mt-1"
              />
              {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Description (Optional)
              </label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A short description of the dataset"
                className="mt-1"
              />
            </div>

            <div>
              <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Dataset File
              </label>
              <div className="mt-1 flex items-center space-x-4">
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FiUpload className="mr-2" />
                  Choose CSV File
                </Button>
                <input
                  type="file"
                  id="file-upload"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".csv"
                  className="hidden"
                />
                {file && <span className="text-sm text-gray-500">{file.name}</span>}
              </div>
              {errors.file && <p className="mt-1 text-sm text-red-500">{errors.file}</p>}
            </div>

            {csvValidationResult && (
              <div
                className={`flex items-start rounded-md p-3 ${
                  csvValidationResult.isValid
                    ? 'bg-green-50 text-green-800'
                    : 'bg-red-50 text-red-800'
                }`}
              >
                {csvValidationResult.isValid ? (
                  <FiCheck className="h-5 w-5 flex-shrink-0" />
                ) : (
                  <FiAlertCircle className="h-5 w-5 flex-shrink-0" />
                )}
                <div className="ml-3">
                  <p className="text-sm font-medium">{csvValidationResult.message}</p>
                </div>
              </div>
            )}
            
            <div className="flex items-center space-x-2 text-sm text-gray-500 p-3 bg-blue-50 text-blue-800 rounded-md">
                <FiInfo className="h-5 w-5 flex-shrink-0" />
                <span>The CSV file must contain a 'text' column. An optional 'score' column with values from 1 to 5 is also supported.</span>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={isUploading || (csvValidationResult ? !csvValidationResult.isValid : false)}
                className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white shadow-lg font-semibold text-base px-6 py-2"
              >
                {isUploading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Uploading...
                  </>
                ) : (
                  'Upload and Process Dataset'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}