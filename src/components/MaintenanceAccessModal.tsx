'use client';

import { useState } from 'react';
import { useMaintenance } from '@/contexts/MaintenanceContext';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { toast } from 'react-hot-toast';
import { FiKey, FiX } from 'react-icons/fi';
import { useRouter } from 'next/navigation';

export default function MaintenanceAccessModal() {
  const { showAccessModal, setShowAccessModal, verifyAccessCode, checkMaintenanceMode } = useMaintenance();
  const [accessCode, setAccessCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simple delay to simulate verification process
    setTimeout(() => {
      const isValid = verifyAccessCode(accessCode);
      if (isValid) {
        toast.success('Access granted! You can now use the application.');
        setShowAccessModal(false);
        setAccessCode('');
        // Redirect to home page after successful access
        router.push('/');
      } else {
        toast.error('Invalid access code. Please try again.');
      }
      setIsLoading(false);
    }, 500);
  };

  if (!showAccessModal) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="relative w-full max-w-md">
        <Card className="backdrop-blur-lg bg-white/90 dark:bg-gray-800/90 border border-white/30 dark:border-gray-700/50 shadow-2xl">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center">
                  <FiKey className="mr-2" />
                  Maintenance Access
                </CardTitle>
                <CardDescription>
                  Enter access code to continue using the application
                </CardDescription>
              </div>
              <button 
                onClick={() => setShowAccessModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <FiX size={20} />
              </button>
            </div>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent>
              <Input
                label="Access Code"
                placeholder="Enter maintenance access code"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                disabled={isLoading}
                autoFocus
                className="dark:bg-gray-700/50 dark:border-gray-600/50 dark:text-white backdrop-blur-sm"
              />
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <Button 
                type="submit" 
                fullWidth 
                isLoading={isLoading}
                disabled={!accessCode.trim()}
                className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white font-medium py-2 px-4 rounded-lg shadow-lg transition-all duration-300 dark:from-indigo-700 dark:via-purple-700 dark:to-pink-700 dark:hover:from-indigo-800 dark:hover:via-purple-800 dark:hover:to-pink-800"
              >
                {isLoading ? 'Verifying...' : 'Verify Access'}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                fullWidth 
                onClick={() => setShowAccessModal(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}