'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type MaintenanceContextType = {
  isMaintenanceMode: boolean;
  setIsMaintenanceMode: (isMaintenance: boolean) => void;
  isAccessGranted: boolean;
  verifyAccessCode: (code: string) => boolean;
  showAccessModal: boolean;
  setShowAccessModal: (show: boolean) => void;
};

const MaintenanceContext = createContext<MaintenanceContextType | undefined>(undefined);

// Hardcoded access code for demonstration - in a real app, this should be fetched from a secure source
const ACCESS_CODE = 'admin123';

export const MaintenanceProvider = ({ children }: { children: ReactNode }) => {
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [isAccessGranted, setIsAccessGranted] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);

  // Check for maintenance mode status (in a real app, this would come from an API or config)
  useEffect(() => {
    // For demonstration, we'll use localStorage to persist maintenance mode state
    const maintenanceMode = localStorage.getItem('maintenanceMode') === 'true';
    setIsMaintenanceMode(maintenanceMode);
    
    // Check if access has been granted previously
    const accessGranted = localStorage.getItem('maintenanceAccessGranted') === 'true';
    setIsAccessGranted(accessGranted);
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + M to open access modal
      if (e.ctrlKey && e.key === 'm') {
        e.preventDefault();
        if (isMaintenanceMode) {
          setShowAccessModal(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMaintenanceMode]);

  const verifyAccessCode = (code: string): boolean => {
    const isValid = code === ACCESS_CODE;
    if (isValid) {
      setIsAccessGranted(true);
      localStorage.setItem('maintenanceAccessGranted', 'true');
    }
    return isValid;
  };

  return (
    <MaintenanceContext.Provider value={{
      isMaintenanceMode,
      setIsMaintenanceMode,
      isAccessGranted,
      verifyAccessCode,
      showAccessModal,
      setShowAccessModal
    }}>
      {children}
    </MaintenanceContext.Provider>
  );
};

export const useMaintenance = () => {
  const context = useContext(MaintenanceContext);
  if (context === undefined) {
    throw new Error('useMaintenance must be used within a MaintenanceProvider');
  }
  return context;
};