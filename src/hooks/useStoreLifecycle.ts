import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '../context/StoreContext';
import { StarbucksStore } from '../constants/starbucksStores';

interface StoreLifecycleOptions {
  onStoreSwitching?: (fromStore: StarbucksStore, toStore: StarbucksStore) => void;
  onStoreSwitched?: (newStore: StarbucksStore, isNewDb: boolean) => void;
  debounceTimersToClear?: Array<React.MutableRefObject<NodeJS.Timeout | null>>;
}

export function useStoreLifecycle(options: StoreLifecycleOptions = {}) {
  const { currentStore } = useStore();
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Zwraca świeży sygnał AbortSignal, który zostanie automatycznie unieważniony przy zmianie lokalu
  const getAbortSignal = useCallback(() => {
    if (!abortControllerRef.current) {
      abortControllerRef.current = new AbortController();
    }
    return abortControllerRef.current.signal;
  }, []);

  useEffect(() => {
    abortControllerRef.current = new AbortController();

    const handleSwitching = (e: Event) => {
      const customEvent = e as CustomEvent<{ fromStore: StarbucksStore; toStore: StarbucksStore }>;
      setIsTransitioning(true);

      if (abortControllerRef.current) {
        abortControllerRef.current.abort('Store switching in progress');
        abortControllerRef.current = new AbortController();
      }

      if (options.debounceTimersToClear) {
        options.debounceTimersToClear.forEach((timerRef) => {
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }
        });
      }

      if (options.onStoreSwitching && customEvent.detail) {
        options.onStoreSwitching(customEvent.detail.fromStore, customEvent.detail.toStore);
      }
    };

    const handleSwitched = (e: Event) => {
      const customEvent = e as CustomEvent<{ currentStore: StarbucksStore; isNewDb: boolean }>;
      setIsTransitioning(false);

      if (options.onStoreSwitched && customEvent.detail) {
        options.onStoreSwitched(customEvent.detail.currentStore, customEvent.detail.isNewDb);
      }
    };

    window.addEventListener('sbx:store-switching', handleSwitching);
    window.addEventListener('sbx:store-switched', handleSwitched);

    return () => {
      window.removeEventListener('sbx:store-switching', handleSwitching);
      window.removeEventListener('sbx:store-switched', handleSwitched);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort('Component unmounted');
      }
    };
  }, [options]);

  return {
    currentStore,
    isTransitioning,
    getAbortSignal,
  };
}
