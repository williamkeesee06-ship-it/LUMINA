import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useUIStore } from './uiStore';
import type { LuminaStore, LuminaDataState } from '../types/store';

/**
 * LUMINA CONTEXT SHELL
 * This file acts as a compatibility layer between the Zustand UI store 
 * and the Data State currently managed in App.tsx.
 */

const LuminaContext = createContext<LuminaStore | undefined>(undefined);

interface LuminaProviderProps extends LuminaDataState {
  children: ReactNode;
  login: () => void;
  resetUniverse: () => void;
}

export function LuminaProvider({ 
  children, 
  jobs, 
  loading, 
  error, 
  googleToken, 
  unreadCount, 
  driveFiles,
  login,
  resetUniverse
}: LuminaProviderProps) {
  const uiState = useUIStore();
  
  // Create a combined store object that satisfies the LuminaStore interface
  const value: LuminaStore = {
    // Zustand UI State
    selectedJobId: uiState.selectedJobId,
    selectedJobNumber: uiState.selectedJobNumber,
    viewMode: uiState.viewMode,
    viewLevel: uiState.viewLevel,
    focusedGalaxy: uiState.focusedGalaxy,
    activeStatus: uiState.activeStatus,
    latchedStatus: uiState.latchedStatus,
    isChatOpen: uiState.isChatOpen,
    voiceEnabled: uiState.voiceEnabled,
    orbMode: uiState.orbMode,
    uiError: uiState.uiError,
    
    // Zustand Actions
    selectJob: uiState.selectJob,
    clearSelectedJob: uiState.clearSelectedJob,
    setViewMode: uiState.setViewMode,
    setViewLevel: uiState.setViewLevel,
    setFocusedGalaxy: uiState.setFocusedGalaxy,
    setActiveStatus: uiState.setActiveStatus,
    setLatchedStatus: uiState.setLatchedStatus,
    toggleChat: uiState.toggleChat,
    setVoiceEnabled: uiState.setVoiceEnabled,
    setOrbMode: uiState.setOrbMode,
    setUIError: uiState.setUIError,
    resetUI: uiState.resetUI,
    
    // Data Props (from App.tsx)
    jobs,
    loading,
    error,
    googleToken,
    unreadCount,
    driveFiles,
    login,
    resetUniverse,
  };

  return <LuminaContext.Provider value={value}>{children}</LuminaContext.Provider>;
}

export function useLumina() {
  const context = useContext(LuminaContext);
  if (context === undefined) {
    throw new Error('useLumina must be used within a LuminaProvider');
  }
  return context;
}
