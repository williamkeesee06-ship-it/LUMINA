import { createContext, useContext, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useUIStore } from './useUIStore';

const LuminaContext = createContext<ReturnType<typeof useUIStore> | undefined>(undefined);

interface LuminaProviderProps {
  children: ReactNode;
  login: () => void;
}


export function LuminaProvider({ 
  children, 
  login
}: LuminaProviderProps) {
  const store = useUIStore();

  return (
    <LuminaContext.Provider value={{ ...store, login }}>
      {children}
    </LuminaContext.Provider>
  );
}


export function useLumina() {
  const context = useContext(LuminaContext);
  if (context === undefined) {
    throw new Error('useLumina must be used within a LuminaProvider');
  }
  return context;
}
