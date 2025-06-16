'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { toast } from 'react-hot-toast';
import { Dataset } from '@/types';
import { FiTag } from 'react-icons/fi';

export default function JoinLabeling() {
  const { user } = useAuth();
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');
  
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inviteCode.trim()) {
      setError('Please enter an invite code');
      return;
    }
    
    try {
      setIsJoining(true);
      setError('');
      
      // Find dataset with the invite code
      const { data: dataset, error: datasetError } = await supabase
        .from('datasets')
        .select('*')
        .eq('invite_code', inviteCode.trim())
        .single();
      
      if (datasetError) {
        setError('Invalid invite code');
        return;
      }
      
      // Check if user is the dataset owner
      if (dataset.owner_id === user?.id) {
        setError('You cannot join your own dataset for labeling');
        return;
      }
      
      // Check if user has already joined this dataset
      const { data: existingProgress, error: progressError } = await supabase
        .from('label_progress')
        .select('*')
        .eq('dataset_id', dataset.id)
        .eq('user_id', user?.id)
        .single();
      
      if (existingProgress) {
        // User has already joined, redirect to labeling
        router.push(`/labeling/${dataset.id}`);
        return;
      }
      
      // Create progress record
      const { error: createError } = await supabase
        .from('label_progress')
        .insert({
          dataset_id: dataset.id,
          user_id: user?.id,
          completed: 0,
          total: dataset.total_entries,
        });
      
      if (createError) throw createError;
      
      toast.success('You have joined the labeling task!');
      router.push(`/labeling/${dataset.id}`);
    } catch (error) {
      console.error('Join error:', error);
      toast.error('Failed to join dataset');
      setError('An error occurred while joining. Please try again.');
    } finally {
      setIsJoining(false);
    }
  };
  
  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Join Labeling Task</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Enter Invite Code</CardTitle>
          <CardDescription>
            Input the invite code you received to start labeling a dataset
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleJoin}>
          <CardContent>
            <div className="space-y-4">
              <div className="relative">
                <Input
                  label="Invite Code"
                  placeholder="Enter the invite code"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  error={error}
                  disabled={isJoining}
                />
                <FiTag 
                  className="absolute right-3 top-9 text-gray-400" 
                  size={16}
                />
              </div>
              
              <p className="text-sm text-gray-500 dark:text-gray-400">
                The invite code is a unique identifier shared by the dataset owner.
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              fullWidth={true}
              isLoading={isJoining}
              disabled={!inviteCode.trim() || isJoining}
            >
              Join Labeling Task
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
} 