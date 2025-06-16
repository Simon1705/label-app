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
}