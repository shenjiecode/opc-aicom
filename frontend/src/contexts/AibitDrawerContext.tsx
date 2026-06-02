import React, { createContext, useContext, useState, useCallback } from 'react';

interface AibitDrawerContextType {
  isOpen: boolean;
  initialMessage: string;
  openDrawer: (message?: string) => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
}

const AibitDrawerContext = createContext<AibitDrawerContextType | undefined>(undefined);

export function AibitDrawerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [initialMessage, setInitialMessage] = useState('');

  const openDrawer = useCallback((message?: string) => {
    setIsOpen(true);
    if (message) {
      setInitialMessage(message);
    }
  }, []);

  const closeDrawer = useCallback(() => {
    setIsOpen(false);
    setInitialMessage('');
  }, []);

  const toggleDrawer = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const value: AibitDrawerContextType = {
    isOpen,
    initialMessage,
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