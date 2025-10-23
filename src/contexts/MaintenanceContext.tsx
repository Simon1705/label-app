'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type MaintenanceContextType = {
  isMaintenanceMode: boolean;
  isAccessGranted: boolean;
  checkMaintenanceMode: () => void;
  verifyAccessCode: (code: string) => boolean;
  showAccessModal: boolean;
  setShowAccessModal: (show: boolean) => void;
};

const MaintenanceContext = createContext<MaintenanceContextType | undefined>(undefined);

// Hardcoded access code for demonstration - in a real app, this should be fetched from a secure source
const ACCESS_CODE = process.env.NEXT_PUBLIC_MAINTENANCE_ACCESS_CODE || 'admin123';

// Helper function to set cookie
const setCookie = (name: string, value: string, days: number) => {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
};

// Helper function to get cookie
const getCookie = (name: string) => {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for(let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
};

export const MaintenanceProvider = ({ children }: { children: ReactNode }) => {
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [isAccessGranted, setIsAccessGranted] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);

  // Check maintenance mode status
  const checkMaintenanceMode = () => {
    // Check if maintenance mode is enabled via environment variable
    const maintenanceMode = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true';
    setIsMaintenanceMode(maintenanceMode);
    
    // Check if access has been granted previously
    const accessGranted = localStorage.getItem('maintenanceAccessGranted') === 'true' || 
                         getCookie('maintenanceAccessGranted') === 'true';
    setIsAccessGranted(!!accessGranted);
  };

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

  // Check maintenance mode on mount
  useEffect(() => {
    checkMaintenanceMode();
  }, []);

  const verifyAccessCode = (code: string): boolean => {
    const isValid = code === ACCESS_CODE;
    if (isValid) {
      setIsAccessGranted(true);
      localStorage.setItem('maintenanceAccessGranted', 'true');
      // Set cookie for server-side middleware
      setCookie('maintenanceAccessGranted', 'true', 1); // Expires in 1 day
    }
    return isValid;
  };

  return (
    <MaintenanceContext.Provider value={{
      isMaintenanceMode,
      isAccessGranted,
      checkMaintenanceMode,
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