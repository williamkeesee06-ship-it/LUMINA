import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useUIStore } from './useUIStore';
import type { LuminaState } from './useUIStore';

export interface LuminaContextType extends LuminaState {
  login: () => void;
}


const LuminaContext = createContext<LuminaContextType | null>(null);

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
  if (context === null) {
    throw new Error('useLumina must be used within a LuminaProvider');
  }
  return context;
}
