// src/hooks/useInactivityAutoLock.ts
/**
 * Starbucks Operations Suite — Enterprise Session Inactivity Auto-Lock & Key Zeroization
 * Feature F9 (Milestone 3)
 *
 * Capabilities:
 * - Default 15-minute inactivity timeout (900,000 ms) with configurable test overrides.
 * - Monitored DOM events: mousemove, mousedown, keydown, touchstart, scroll, wheel.
 * - Throttled event processing (1,000 ms) with passive listeners to eliminate UI stutter.
 * - Headless Node / SSR safety (typeof window !== 'undefined' checks).
 * - System sleep/wake awareness (visibilitychange comparison).
 * - Automatic modal dismissal broadcast and 3-tier cryptographic RAM key zeroization.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { StoreKeyCache } from '../services/security/storeKeyCache';
import { licensingService } from '../services/security/licensingService';

export const DEFAULT_INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 900,000 ms (15 minutes)
export const DEFAULT_ACTIVITY_THROTTLE_MS = 1000; // 1 second (1,000 ms)

export interface UseInactivityAutoLockOptions {
  /** Inactivity timeout in milliseconds (default: 900,000 ms = 15 min) */
  timeoutMs?: number;
  /** Activity event throttle interval in milliseconds (default: 1,000 ms) */
  throttleMs?: number;
  /** Whether auto-lock is currently active (e.g. only when user is logged in) */
  enabled?: boolean;
  /** Custom callback executed immediately after locking */
  onLock?: () => void;
  /** Whether to zeroize RAM keys on lock (default: true) */
  zeroizeKeys?: boolean;
  /** Whether to broadcast modal dismissal events (default: true) */
  dismissModals?: boolean;
}

export interface UseInactivityAutoLockReturn {
  isLocked: boolean;
  lastActivity: number;
  resetTimer: () => void;
  lockNow: () => void;
  unlock: () => void;
  getRemainingTimeMs: () => number;
}

/**
 * Executes 3-tier in-memory cryptographic key zeroization:
 * 1. Renderer AES-256 SEK cache (StoreKeyCache.clear() with entry.key.fill(0))
 * 2. Licensing service cached decrypted records
 * 3. Electron Main Process master key cache via IPC crypto:zeroize-keys
 */
export function executeCryptographicZeroization(): void {
  // Tier 1: Renderer AES SEK key cache zeroization
  try {
    StoreKeyCache.clear();
  } catch (err) {
    console.warn('[AutoLock] Błąd czyszczenia StoreKeyCache:', err);
  }

  // Tier 2: Licensing memory cache
  try {
    if (typeof (licensingService as any)?.clearDecryptedKeyCache === 'function') {
      (licensingService as any).clearDecryptedKeyCache();
    }
  } catch (err) {
    console.warn('[AutoLock] Błąd czyszczenia licensingService cache:', err);
  }

  // Tier 3: Electron Main process key cache via IPC
  try {
    if (typeof window !== 'undefined') {
      const api = (window as any).api || (window as any).electronAPI;
      if (api?.cryptoZeroizeKeys) {
        api.cryptoZeroizeKeys().catch((e: any) => console.warn('[AutoLock] IPC zeroize error:', e));
      }
    }
  } catch (err) {
    console.warn('[AutoLock] Błąd wywołania cryptoZeroizeKeys:', err);
  }
}

/**
 * Broadcasts global modal dismissal and session locked events.
 */
export function broadcastSessionLockEvents(): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('sbx:dismiss-modals'));
    window.dispatchEvent(new CustomEvent('sbx:session-locked'));
  } catch (err) {
    console.warn('[AutoLock] Błąd dispatchEvent sbx:session-locked:', err);
  }
}

export function useInactivityAutoLock(
  options: UseInactivityAutoLockOptions = {}
): UseInactivityAutoLockReturn {
  const {
    timeoutMs = DEFAULT_INACTIVITY_TIMEOUT_MS,
    throttleMs = DEFAULT_ACTIVITY_THROTTLE_MS,
    enabled = true,
    onLock,
    zeroizeKeys = true,
    dismissModals = true,
  } = options;

  const [isLocked, setIsLocked] = useState<boolean>(false);
  const lastActivityRef = useRef<number>(Date.now());
  const lastThrottleRef = useRef<number>(0);
  const timerIdRef = useRef<any>(null);
  const checkIntervalRef = useRef<any>(null);

  // Trigger lock sequence
  const lockNow = useCallback(() => {
    setIsLocked(true);

    if (dismissModals) {
      broadcastSessionLockEvents();
    }

    if (zeroizeKeys) {
      executeCryptographicZeroization();
    }

    if (onLock) {
      try {
        onLock();
      } catch (err) {
        console.error('[AutoLock] Błąd w onLock callback:', err);
      }
    }
  }, [dismissModals, zeroizeKeys, onLock]);

  // Unlock sequence
  const unlock = useCallback(() => {
    setIsLocked(false);
    lastActivityRef.current = Date.now();
    lastThrottleRef.current = Date.now();
  }, []);

  // Activity event handler with throttling
  const handleUserActivity = useCallback(() => {
    if (isLocked || !enabled) return;

    const now = Date.now();
    // Throttle checks to avoid CPU overhead on high-frequency events (mousemove/scroll)
    if (now - lastThrottleRef.current < throttleMs) {
      return;
    }

    lastThrottleRef.current = now;
    lastActivityRef.current = now;

    // Reset scheduled lock timer
    if (timerIdRef.current) {
      clearTimeout(timerIdRef.current);
    }
    timerIdRef.current = setTimeout(() => {
      lockNow();
    }, timeoutMs);
  }, [isLocked, enabled, throttleMs, timeoutMs, lockNow]);

  // Manual timer reset
  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    lastThrottleRef.current = Date.now();
    if (timerIdRef.current) {
      clearTimeout(timerIdRef.current);
    }
    if (enabled && !isLocked) {
      timerIdRef.current = setTimeout(() => {
        lockNow();
      }, timeoutMs);
    }
  }, [enabled, isLocked, timeoutMs, lockNow]);

  // Remaining time calculation
  const getRemainingTimeMs = useCallback(() => {
    if (isLocked) return 0;
    const elapsed = Date.now() - lastActivityRef.current;
    return Math.max(0, timeoutMs - elapsed);
  }, [isLocked, timeoutMs]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return; // Headless environment guard
    }

    if (!enabled || isLocked) {
      if (timerIdRef.current) clearTimeout(timerIdRef.current);
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
      return;
    }

    // Schedule primary timer
    timerIdRef.current = setTimeout(() => {
      lockNow();
    }, timeoutMs);

    // Heartbeat checker (every 10 seconds) for sleep/wake drift detection
    checkIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= timeoutMs) {
        lockNow();
      }
    }, 10000);

    // Event listeners
    const activityEvents = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
      'wheel',
    ];

    const eventOptions = { passive: true };
    activityEvents.forEach((event) => {
      window.addEventListener(event, handleUserActivity, eventOptions);
    });

    // Visibility change listener (detects workstation lid open / wake from sleep)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const elapsed = Date.now() - lastActivityRef.current;
        if (elapsed >= timeoutMs) {
          lockNow();
        } else {
          handleUserActivity();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timerIdRef.current) clearTimeout(timerIdRef.current);
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleUserActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, isLocked, timeoutMs, handleUserActivity, lockNow]);

  return {
    isLocked,
    lastActivity: lastActivityRef.current,
    resetTimer,
    lockNow,
    unlock,
    getRemainingTimeMs,
  };
}
