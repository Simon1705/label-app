'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { FiTool, FiUnlock, FiX, FiAlertCircle, FiClock } from 'react-icons/fi';

export default function MaintenancePage() {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [secretCode, setSecretCode] = useState('');
  const [error, setError] = useState('');

  // Handle keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + M to open modal
      if (e.ctrlKey && e.key === 'm') {
        e.preventDefault();
        setShowModal(true);
      }
      
      // Escape to close modal
      if (e.key === 'Escape' && showModal) {
        setShowModal(false);
        setError('');
        setSecretCode('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showModal]);

  const handleAccess = () => {
    // In a real application, you would verify this against a more secure method
    if (secretCode === 'admin123') {
      // Set a cookie that will be checked by the middleware
      document.cookie = "maintenanceBypass=true; path=/; max-age=3600"; // 1 hour
      router.push('/');
    } else {
      setError('Invalid access code');
      // Clear the input field
      setSecretCode('');
    }
  };

  const handleModalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAccess();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900 flex items-center justify-center p-0 m-0 w-full">
      {/* Background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Main content */}
      <div className="relative w-full max-w-md mx-auto px-4 py-16">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="backdrop-blur-lg bg-white/10 border border-white/20 rounded-2xl shadow-2xl p-8 text-center"
        >
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
            className="inline-flex items-center justify-center w-20 h-20 bg-red-500/20 rounded-full mb-6"
          >
            <FiTool className="text-red-300 text-4xl" />
          </motion.div>

          <div className="space-y-4 mb-8">
            <h1 className="text-3xl font-bold text-white">Under Maintenance</h1>
            <p className="text-gray-300">
              We're currently performing scheduled maintenance to improve your experience.
            </p>
          </div>

          <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-4 mb-8 text-left">
            <div className="flex items-start gap-3">
              <FiAlertCircle className="text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-blue-300">Temporary Downtime</h3>
                <p className="text-sm text-blue-200 mt-1">
                  Our system is undergoing maintenance. We appreciate your patience.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10">
            <div className="flex items-center justify-center gap-2 text-gray-400 text-sm">
              <FiClock className="text-gray-500" />
              <span>Maintenance in progress</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Access Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-md bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-6"
          >
            <button
              onClick={() => {
                setShowModal(false);
                setError('');
                setSecretCode('');
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <FiX className="text-xl" />
            </button>

            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500/20 rounded-full">
                <FiUnlock className="text-blue-400 text-2xl" />
              </div>

              <div>
                <h2 className="text-2xl font-bold text-white">Admin Access</h2>
                <p className="text-gray-400 mt-1">
                  Enter access code to continue
                </p>
              </div>

              <div className="space-y-4">
                <input
                  type="password"
                  value={secretCode}
                  onChange={(e) => setSecretCode(e.target.value)}
                  onKeyDown={handleModalKeyDown}
                  placeholder="Access code"
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                
                {error && (
                  <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 text-left">
                    <div className="flex items-center gap-2">
                      <FiAlertCircle className="text-red-400 flex-shrink-0" />
                      <p className="text-red-300 text-sm">{error}</p>
                    </div>
                  </div>
                )}
                
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setError('');
                      setSecretCode('');
                    }}
                    className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
                  >
                    Cancel
                  </button>
                  
                  <button
                    onClick={handleAccess}
                    className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-white transition-colors"
                  >
                    Access
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}