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
    let formErrors = {
      name: '',
      file: '',
      csvFormat: '',
    };
    
    if (!name.trim()) {
      formErrors.name = 'Dataset name is required';
    }
    
    if (!file) {
      formErrors.file = 'Please upload a CSV file';
    }
    
    if (csvValidationResult && !csvValidationResult.isValid) {
      formErrors.csvFormat = csvValidationResult.message;
    }
    
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
      
      console.log(`Processing ${rows.length} rows from CSV`);
      
      const headers = Object.keys(rows[0] || {});
      const hasScoreColumn = headers.includes('score');
      
      // Break entries into chunks to avoid hitting limits
      const chunkSize = 500;
      for (let i = 0; i < rows.length; i += chunkSize) {
        try {
          const chunk = rows.slice(i, i + chunkSize).map(row => ({
            dataset_id: dataset.id,
            text: row.text,
            score: hasScoreColumn ? parseInt(row.score) : null,
          }));
          
          console.log(`Inserting chunk ${i/chunkSize + 1} of ${Math.ceil(rows.length/chunkSize)}, size: ${chunk.length}`);
          
          const { error: entriesError } = await supabase
            .from('dataset_entries')
            .insert(chunk);
          
          if (entriesError) {
            console.error(`Error inserting chunk ${i/chunkSize + 1}:`, entriesError);
            throw entriesError;
          }
        } catch (chunkError) {
          console.error(`Failed to process chunk starting at row ${i}:`, chunkError);
          throw chunkError;
        }
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
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Upload New Dataset</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Dataset Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label="Dataset Name"
              placeholder="Enter a name for this dataset"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.name}
              disabled={isUploading}
            />
            
            <Input
              label="Description (Optional)"
              placeholder="Brief description of this dataset"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isUploading}
            />
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                CSV File
              </label>
              <div 
                className={`border-2 border-dashed rounded-md p-8 text-center ${
                  errors.file || errors.csvFormat
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/10'
                    : 'border-gray-300 dark:border-gray-700'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".csv"
                  className="hidden"
                  disabled={isUploading}
                />
                
                {file ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center">
                      {csvValidationResult?.isValid ? (
                        <FiCheck className="text-green-500 mr-2" size={24} />
                      ) : (
                        <FiAlertCircle className="text-red-500 mr-2" size={24} />
                      )}
                      <span className="font-medium">{file.name}</span>
                    </div>
                    
                    {csvValidationResult && (
                      <div className={`text-sm ${
                        csvValidationResult.isValid 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {csvValidationResult.message}
                      </div>
                    )}
                    
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                    >
                      Change File
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex justify-center">
                      <FiUpload size={24} className="text-gray-400" />
                    </div>
                    <p className="text-gray-500 dark:text-gray-400">
                      Drag and drop your CSV file here, or{' '}
                      <button 
                        type="button" 
                        className="text-blue-600 dark:text-blue-400 hover:underline focus:outline-none" 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                      >
                        browse
                      </button>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      CSV must have 'text' column, 'score' column is optional
                    </p>
                  </div>
                )}
                
                {(errors.file || errors.csvFormat) && (
                  <p className="mt-2 text-sm text-red-500">
                    {errors.file || errors.csvFormat}
                  </p>
                )}
              </div>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <FiInfo className="h-5 w-5 text-blue-500" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-700 dark:text-blue-400">
                    CSV Format Requirements
                  </h3>
                  <div className="mt-2 text-sm text-blue-600 dark:text-blue-300">
                    <ul className="list-disc pl-5 space-y-1">
                      <li>File must be in CSV format</li>
                      <li>Must contain a 'text' column with review content</li>
                      <li>Optional 'score' column (values 1-5); entries will display "No rating" if missing</li>
                      <li>Text fields cannot be empty</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                className="mr-2"
                onClick={() => router.back()}
                disabled={isUploading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                isLoading={isUploading}
                disabled={!csvValidationResult?.isValid || isUploading}
              >
                Upload Dataset
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
} 