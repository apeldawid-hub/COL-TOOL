// src/context/TutorialContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface TutorialContextType {
  isTutorialMode: boolean;
  setTutorialMode: (enabled: boolean) => void;
  toggleTutorialMode: () => void;
  isGuideModalOpen: boolean;
  activeGuideTab: 'tplh' | 'schedule' | 'checklist' | 'glossary';
  openGuideModal: (initialTab?: 'tplh' | 'schedule' | 'checklist' | 'glossary') => void;
  closeGuideModal: () => void;
  isModelTourOpen: boolean;
  activeTourStep: number;
  activeTourModule: 'schedule' | 'tplh' | 'settings';
  openModelTour: (step?: number, module?: 'schedule' | 'tplh' | 'settings') => void;
  closeModelTour: () => void;
}

const STORAGE_KEY = 'sbx_tutorial_mode';

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

export const TutorialProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isTutorialMode, setIsTutorialModeState] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored !== null ? stored === 'true' : true; // Domyślnie włączony dla fazy testów
    } catch {
      return true;
    }
  });

  const [isGuideModalOpen, setIsGuideModalOpen] = useState<boolean>(false);
  const [activeGuideTab, setActiveGuideTab] = useState<'tplh' | 'schedule' | 'checklist' | 'glossary'>('tplh');

  // Stan Interaktywnego Samouczka Modelowego
  const [isModelTourOpen, setIsModelTourOpen] = useState<boolean>(false);
  const [activeTourStep, setActiveTourStep] = useState<number>(1);
  const [activeTourModule, setActiveTourModule] = useState<'schedule' | 'tplh' | 'settings'>('schedule');

  const setTutorialMode = (enabled: boolean) => {
    setIsTutorialModeState(enabled);
    try {
      localStorage.setItem(STORAGE_KEY, String(enabled));
    } catch (e) {
      console.warn('Nie udało się zapisać preferencji samouczka w localStorage:', e);
    }
  };

  const toggleTutorialMode = () => {
    setTutorialMode(!isTutorialMode);
  };

  const openGuideModal = (initialTab: 'tplh' | 'schedule' | 'checklist' | 'glossary' = 'tplh') => {
    setActiveGuideTab(initialTab);
    setIsGuideModalOpen(true);
  };

  const closeGuideModal = () => {
    setIsGuideModalOpen(false);
  };

  const openModelTour = (step: number = 1, module: 'schedule' | 'tplh' | 'settings' = 'schedule') => {
    setActiveTourStep(step);
    setActiveTourModule(module);
    setIsModelTourOpen(true);
  };

  const closeModelTour = () => {
    setIsModelTourOpen(false);
  };

  return (
    <TutorialContext.Provider
      value={{
        isTutorialMode,
        setTutorialMode,
        toggleTutorialMode,
        isGuideModalOpen,
        activeGuideTab,
        openGuideModal,
        closeGuideModal,
        isModelTourOpen,
        activeTourStep,
        activeTourModule,
        openModelTour,
        closeModelTour,
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
};

export const useTutorial = (): TutorialContextType => {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error('useTutorial musi być używany wewnątrz <TutorialProvider>');
  }
  return context;
};
