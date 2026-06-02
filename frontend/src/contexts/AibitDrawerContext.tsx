import React, { createContext, useContext, useState, useCallback } from 'react';

interface AibitDrawerContextType {
  isOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
}

const AibitDrawerContext = createContext<AibitDrawerContextType | undefined>(undefined);

export function AibitDrawerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openDrawer = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleDrawer = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const value: AibitDrawerContextType = {
    isOpen,
    openDrawer,
    closeDrawer,
    toggleDrawer,
  };

  return (
    <AibitDrawerContext.Provider value={value}>
      {children}
    </AibitDrawerContext.Provider>
  );
}

export function useAibitDrawer(): AibitDrawerContextType {
  const context = useContext(AibitDrawerContext);
  if (context === undefined) {
    throw new Error('useAibitDrawer must be used within an AibitDrawerProvider');
  }
  return context;
}