'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiAlertTriangle } from 'react-icons/fi';

export default function MaintenancePage() {
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  // Handle Ctrl + M keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'm') {
        e.preventDefault();
        setShowAccessModal(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleAccessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // In a real implementation, this would be imported from maintenanceConfig
    const correctCode = 'admin123';
    
    if (accessCode === correctCode) {
      try {
        // Set cookie for 24 hours access
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toUTCString();
        document.cookie = `maintenanceAccessGranted=true; expires=${expires}; path=/`;
        
        // Small delay to ensure cookie is set
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Redirect to home page
        router.push('/');
        router.refresh(); // Force a refresh to bypass middleware
      } catch (err) {
        console.error('Error during redirect:', err);
        setError('An error occurred. Please try again.');
      }
    } else {
      setError('Invalid access code. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4 overflow-hidden">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 p-6 text-center">
          <FiAlertTriangle className="mx-auto h-16 w-16 text-white" />
          <h1 className="mt-4 text-3xl font-bold text-white">Under Maintenance</h1>
        </div>
        
        <div className="p-8 text-center">
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            We're currently performing scheduled maintenance. We'll be back shortly.
          </p>
          
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-8">
            <p>Thank you for your patience.</p>
          </div>
        </div>
      </div>

      {/* Access Code Modal */}
      {showAccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Staff Access</h2>
                <button 
                  onClick={() => setShowAccessModal(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>
              
              <form onSubmit={handleAccessSubmit}>
                <div className="mb-4">
                  <label htmlFor="accessCode" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Access Code
                  </label>
                  <input
                    type="password"
                    id="accessCode"
                    value={accessCode}
                    onChange={(e) => {
                      setAccessCode(e.target.value);
                      setError('');
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Enter access code"
                  />
                  {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                </div>
                
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowAccessModal(false)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Submit
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}