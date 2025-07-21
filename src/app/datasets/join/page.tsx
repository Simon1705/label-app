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
        router.push(`/labeling`);
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
      router.push(`/labeling`);
    } catch (error) {
      console.error('Join error:', error);
      toast.error('Failed to join dataset');
      setError('An error occurred while joining. Please try again.');
    } finally {
      setIsJoining(false);
    }
  };
  
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden p-4">
      {/* Decorative Blobs - now fixed and full screen */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-purple-300 dark:bg-purple-900 rounded-full mix-blend-multiply filter blur-2xl opacity-40 animate-blob" />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-indigo-300 dark:bg-indigo-900 rounded-full mix-blend-multiply filter blur-2xl opacity-40 animate-blob animation-delay-2000" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-pink-300 dark:bg-pink-900 rounded-full mix-blend-multiply filter blur-2xl opacity-30 animate-blob animation-delay-4000" />
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900" />
      </div>

      <Card className="w-full max-w-md z-10 shadow-2xl backdrop-blur-md bg-white/80 dark:bg-gray-900/80 border border-white/30 dark:border-gray-700/60">
        <CardHeader className="flex flex-col items-center">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg mb-4">
            <FiTag className="text-white text-3xl" />
          </div>
          <CardTitle className="text-2xl text-center">Join a Labeling Task</CardTitle>
          <CardDescription className="text-center">
            Enter the invite code you received to start labeling a new dataset.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleJoin}>
          <CardContent className="space-y-4">
            <div>
              <label htmlFor="invite-code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Invite Code
              </label>
              <div className="relative mt-1">
                <Input
                  id="invite-code"
                  placeholder="Enter the invite code"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  disabled={isJoining}
                  className={`pl-10 ${error ? 'border-red-500 focus:ring-red-500' : ''}`}
                  autoFocus
                />
                <FiTag 
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" 
                  size={18}
                />
              </div>
              {error && <p className="mt-1 text-sm text-red-500 font-medium">{error}</p>}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 !mt-2 text-center">
              The invite code is a unique key provided by the dataset owner to grant access for labeling.
            </p>
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              isLoading={isJoining}
              disabled={!inviteCode.trim() || isJoining}
              className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white shadow-lg font-semibold text-base py-2"
            >
              {isJoining ? 'Joining...' : 'Join Labeling Task'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
} 