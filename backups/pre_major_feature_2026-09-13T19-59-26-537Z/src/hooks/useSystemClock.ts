import { useState, useEffect } from 'react';
import { SystemClock, SystemTimeState } from '../services/systemClock';

/**
 * Hook dostarczający aktualny czas i datę systemową w tle.
 * Zegar nie jest renderowany wizualnie w UI, ale zasila logikę aplikacji.
 */
export function useSystemClock(): SystemTimeState {
  const [timeState, setTimeState] = useState<SystemTimeState>(() => SystemClock.now());

  useEffect(() => {
    const unsubscribe = SystemClock.subscribe((newTime) => {
      setTimeState(newTime);
    });
    return unsubscribe;
  }, []);

  return timeState;
}
