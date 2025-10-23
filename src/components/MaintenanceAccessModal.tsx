'use client';

import { useState } from 'react';
import { useMaintenance } from '@/contexts/MaintenanceContext';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { toast } from 'react-hot-toast';

export default function MaintenanceAccessModal() {
  const { showAccessModal, setShowAccessModal, verifyAccessCode } = useMaintenance();
  const [accessCode, setAccessCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simple delay to simulate verification process
    setTimeout(() => {
      const isValid = verifyAccessCode(accessCode);
      if (isValid) {
        toast.success('Access granted! You can now use the application.');
        setShowAccessModal(false);
      } else {
        toast.error('Invalid access code. Please try again.');
      }
      setIsLoading(false);
    }, 500);
  };

  if (!showAccessModal) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Maintenance Mode</CardTitle>
          <CardDescription>
            The application is currently under maintenance. Enter access code to continue.
          </CardDescription>
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
            />
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button 
              type="submit" 
              fullWidth 
              isLoading={isLoading}
              disabled={!accessCode.trim()}
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
  );
}