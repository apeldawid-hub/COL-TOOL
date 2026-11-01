// src/context/StoreContext.tsx
/**
 * Starbucks Operations Suite — Store Context with Dual-Profile Hardening
 * In STORE_CLIENT mode, availableStores is restricted strictly to assignedStoreIds,
 * store hopping is blocked, and auto-convergence guarantees station identity.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { StarbucksStore } from '../constants/starbucksStores';
import { StoreService } from '../services/storeService';
import { useAuth, AppRuntimeMode } from './AuthContext';

export interface StoreContextType {
  currentStore: StarbucksStore;
  availableStores: StarbucksStore[];
  appMode: AppRuntimeMode;
  isStoreClient: boolean;
  isFleetMaster: boolean;
  assignedStoreIds: string[];
  switchStore: (storeOrId: StarbucksStore | string) => Promise<{ success: boolean; isNew?: boolean; error?: string } | void>;
  addCustomStore: (store: StarbucksStore, activate?: boolean) => Promise<{ success: boolean; isNew?: boolean; error?: string } | void>;
  removeCustomStore: (storeId: string) => Promise<void>;
  isStoreSwitcherOpen: boolean;
  openStoreSwitcher: () => void;
  closeStoreSwitcher: () => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { appMode, assignedStoreIds, isStoreClient, isFleetMaster } = useAuth();

  const [currentStore, setCurrentStoreState] = useState<StarbucksStore>(() => StoreService.getCurrentStore());
  const [isStoreSwitcherOpen, setIsStoreSwitcherOpen] = useState<boolean>(false);

  // Profile-aware availableStores
  const availableStores = useMemo(() => {
    return StoreService.getAvailableStoresForProfile(appMode, assignedStoreIds);
  }, [appMode, assignedStoreIds]);

  // Odświeżanie stanu przy zmianach zewnętrznych
  const refreshStores = useCallback(() => {
    setCurrentStoreState(StoreService.getCurrentStore());
  }, []);

  useEffect(() => {
    // Inicjalizacja bazy SQLite oraz synchronizacja kawiarni z dysku przy starcie
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
    window.addEventListener('sbx-stores-list-updated', refreshStores);
    window.addEventListener('storage', refreshStores);

    return () => {
      window.removeEventListener('sbx-store-changed', handleStoreChange);
      window.removeEventListener('sbx-stores-list-updated', refreshStores);
      window.removeEventListener('storage', refreshStores);
    };
  }, [refreshStores]);

  // Auto-konwergencja: W trybie STORE_CLIENT, jeśli aktywny lokal nie jest dozwolony, przełącz natychmiast
  useEffect(() => {
    if (isStoreClient && assignedStoreIds.length > 0) {
      const isAllowed = StoreService.isStoreAssigned(currentStore, assignedStoreIds);
      if (!isAllowed) {
        const target = availableStores[0] || StoreService.findStoreByIdOrCode(assignedStoreIds[0]);
        if (target) {
          console.log(`🏬 [StoreContext] Auto-konwergencja do przypisanego lokalu: ${target.name} (${target.unitCode})`);
          StoreService.setCurrentStore(target, { appMode, assignedStoreIds }).then(() => {
            setCurrentStoreState(target);
          });
        }
      }
    }
  }, [isStoreClient, assignedStoreIds, currentStore, availableStores, appMode]);

  const switchStore = useCallback(async (storeOrId: StarbucksStore | string) => {
    let targetStore: StarbucksStore | undefined;
    if (typeof storeOrId === 'string') {
      targetStore = StoreService.getAllStores().find(
        (s) => s.id === storeOrId || s.mpk === storeOrId || s.unitCode === storeOrId
      );
    } else {
      targetStore = storeOrId;
    }

    if (!targetStore) {
      return { success: false, error: 'Nie znaleziono wybranej kawiarni' };
    }

    if (isStoreClient && !StoreService.isStoreAssigned(targetStore, assignedStoreIds)) {
      console.error(`[Security Guard] Odrzucono próbę zmiany lokalu na: ${targetStore.name}`);
      return { success: false, error: 'Przełączanie kawiarni zablokowane na stacji klienckiej' };
    }

    const res = await StoreService.setCurrentStore(targetStore, { appMode, assignedStoreIds });
    if (res.success) {
      setCurrentStoreState(targetStore);
    }
    return res;
  }, [isStoreClient, assignedStoreIds, appMode]);

  const addCustomStore = useCallback(async (store: StarbucksStore, activate = true) => {
    if (isStoreClient) {
      console.warn('[Security Guard] Dodawanie własnych kawiarni jest wyłączone w trybie STORE_CLIENT.');
      return { success: false, error: 'Dodawanie kawiarni jest wyłączone na stacjach klienckich' };
    }
    const res = await StoreService.addCustomStore(store, activate, { appMode });
    if (activate && res.success) {
      setCurrentStoreState(store);
    }
    return res;
  }, [isStoreClient, appMode]);

  const removeCustomStore = useCallback(async (storeId: string) => {
    await StoreService.removeCustomStore(storeId);
    // Jeśli usunięto aktualnie wybraną, przełącz na domyślną
    if (currentStore.id === storeId) {
      const fallback = StoreService.getCurrentStore();
      setCurrentStoreState(fallback);
    }
  }, [currentStore.id]);

  const openStoreSwitcher = useCallback(() => {
    if (isStoreClient) {
      // In STORE_CLIENT mode, StoreSwitcher is locked
      return;
    }
    setIsStoreSwitcherOpen(true);
  }, [isStoreClient]);

  const closeStoreSwitcher = useCallback(() => {
    setIsStoreSwitcherOpen(false);
  }, []);

  return (
    <StoreContext.Provider
      value={{
        currentStore,
        availableStores,
        appMode,
        isStoreClient,
        isFleetMaster,
        assignedStoreIds,
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
