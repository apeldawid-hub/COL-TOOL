// src/context/StoreContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { StarbucksStore } from '../constants/starbucksStores';
import { StoreService } from '../services/storeService';

interface StoreContextType {
  currentStore: StarbucksStore;
  availableStores: StarbucksStore[];
  switchStore: (storeOrId: StarbucksStore | string) => Promise<{ success: boolean; isNew?: boolean } | void>;
  addCustomStore: (store: StarbucksStore, activate?: boolean) => void;
  removeCustomStore: (storeId: string) => void;
  isStoreSwitcherOpen: boolean;
  openStoreSwitcher: () => void;
  closeStoreSwitcher: () => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentStore, setCurrentStoreState] = useState<StarbucksStore>(() => StoreService.getCurrentStore());
  const [availableStores, setAvailableStores] = useState<StarbucksStore[]>(() => StoreService.getAllStores());
  const [isStoreSwitcherOpen, setIsStoreSwitcherOpen] = useState<boolean>(false);

  // Odświeżanie dostępnych kawiarni i stanu przy zmianach zewnętrznych
  const refreshStores = useCallback(() => {
    setAvailableStores(StoreService.getAllStores());
    setCurrentStoreState(StoreService.getCurrentStore());
  }, []);

  useEffect(() => {
    // Inicjalizacja bazy SQLite dla zapamiętanej kawiarni przy starcie
    StoreService.initStore().catch((err) => console.warn('Store init error:', err));

    const handleStoreChange = (e: Event) => {
      const customEvent = e as CustomEvent<StarbucksStore>;
      if (customEvent.detail) {
        setCurrentStoreState(customEvent.detail);
      } else {
        refreshStores();
      }
    };

    window.addEventListener('sbx-store-changed', handleStoreChange);
    window.addEventListener('storage', refreshStores);

    return () => {
      window.removeEventListener('sbx-store-changed', handleStoreChange);
      window.removeEventListener('storage', refreshStores);
    };
  }, [refreshStores]);

  const switchStore = useCallback(async (storeOrId: StarbucksStore | string) => {
    let targetStore: StarbucksStore | undefined;
    if (typeof storeOrId === 'string') {
      targetStore = StoreService.getAllStores().find(
        (s) => s.id === storeOrId || s.mpk === storeOrId || s.unitCode === storeOrId
      );
    } else {
      targetStore = storeOrId;
    }

    if (targetStore) {
      const res = await StoreService.setCurrentStore(targetStore);
      setCurrentStoreState(targetStore);
      return res;
    }
  }, []);

  const addCustomStore = useCallback((store: StarbucksStore, activate = true) => {
    StoreService.addCustomStore(store, activate);
    setAvailableStores(StoreService.getAllStores());
    if (activate) {
      setCurrentStoreState(store);
    }
  }, []);

  const removeCustomStore = useCallback((storeId: string) => {
    StoreService.removeCustomStore(storeId);
    setAvailableStores(StoreService.getAllStores());
    // Jeśli usunięto aktualnie wybraną, przełącz na domyślną
    if (currentStore.id === storeId) {
      const fallback = StoreService.getCurrentStore();
      setCurrentStoreState(fallback);
    }
  }, [currentStore.id]);

  const openStoreSwitcher = useCallback(() => {
    setIsStoreSwitcherOpen(true);
  }, []);

  const closeStoreSwitcher = useCallback(() => {
    setIsStoreSwitcherOpen(false);
  }, []);

  return (
    <StoreContext.Provider
      value={{
        currentStore,
        availableStores,
        switchStore,
        addCustomStore,
        removeCustomStore,
        isStoreSwitcherOpen,
        openStoreSwitcher,
        closeStoreSwitcher,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = (): StoreContextType => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
