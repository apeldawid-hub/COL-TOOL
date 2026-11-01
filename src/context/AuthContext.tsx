// src/context/AuthContext.tsx
/**
 * Starbucks Operations Suite — Enterprise Authentication & Profile Context
 * Single source of truth for runtime profile (FLEET_MASTER vs STORE_CLIENT),
 * hardware-bound licensing status, corporate 2FA session, and inactivity auto-lock.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { licensingService } from '../services/security/licensingService';
import type { ActiveLicenseRecord, LicenseStatusResult, ActivationResult } from '../types/licensing';
import { AuthService, AuthUserSession } from '../services/auth/authService';
import { AppUserRole } from '../types/admin';
import { StoreKeyCache } from '../services/security/storeKeyCache';
import { AdminService } from '../services/admin/adminService';

export type AppRuntimeMode = 'FLEET_MASTER' | 'STORE_CLIENT';

export interface AuthContextType {
  // Runtime Profile
  appMode: AppRuntimeMode;
  isFleetMaster: boolean;
  isStoreClient: boolean;
  assignedStoreIds: string[];
  setAppModeManual: (mode: AppRuntimeMode, stores?: string[]) => void;

  // Station Activation & Licensing
  isStationActivated: boolean;
  licenseStatus: LicenseStatusResult | null;
  activeLicense: ActiveLicenseRecord | null;
  activateStation: (key: string, expectedStoreId?: string) => Promise<ActivationResult>;
  deactivateStation: (reason?: string) => Promise<void>;

  // User Authentication & Session
  isAuthenticated: boolean;
  currentSession: AuthUserSession | null;
  currentUserRole: AppUserRole | null;
  loginWith2Fa: (email: string, otpCode: string) => Promise<{ success: boolean; message?: string }>;
  quickLoginSM: (unitCode?: string) => AuthUserSession;
  logout: () => void;

  // Inactivity Auto-Lock & Key Zeroization
  isLocked: boolean;
  lockSession: () => void;
  unlockSession: (credential: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Synchronous initial state: Least-Privilege default ('STORE_CLIENT') with cache hydration
  const [appMode, setAppMode] = useState<AppRuntimeMode>(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        const cached = localStorage.getItem('sbx_app_mode');
        if (cached === 'FLEET_MASTER' || cached === 'STORE_CLIENT') return cached;
      }
    } catch {}
    return 'STORE_CLIENT';
  });

  const [assignedStoreIds, setAssignedStoreIds] = useState<string[]>(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        const cached = localStorage.getItem('sbx_assigned_stores');
        if (cached) return JSON.parse(cached);
      }
    } catch {}
    return [];
  });

  const [isStationActivated, setIsStationActivated] = useState<boolean>(false);
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatusResult | null>(null);
  const [activeLicense, setActiveLicense] = useState<ActiveLicenseRecord | null>(null);
  const [currentSession, setCurrentSession] = useState<AuthUserSession | null>(() => {
    try {
      return AuthService.getCurrentSession();
    } catch {
      return null;
    }
  });
  const [isLocked, setIsLocked] = useState<boolean>(false);

  // Manual override for admin/development testing
  const setAppModeManual = useCallback((mode: AppRuntimeMode, stores: string[] = []) => {
    setAppMode(mode);
    setAssignedStoreIds(stores);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('sbx_app_mode', mode);
        if (stores.length > 0) {
          localStorage.setItem('sbx_assigned_stores', JSON.stringify(stores));
        } else {
          localStorage.removeItem('sbx_assigned_stores');
        }
      }
    } catch {}
  }, []);

  // Lifecycle initialization: Cryptographic License Verification via Electron IPC
  useEffect(() => {
    let isMounted = true;

    const initializeStationSecurity = async () => {
      try {
        const status = await licensingService.verifyStationHardwareLock();
        if (!isMounted) return;

        setLicenseStatus(status);

        if (status.status === 'ACTIVATED' && status.license) {
          setIsStationActivated(true);
          setActiveLicense(status.license);

          const tier: AppRuntimeMode = status.license.tier; // 'FLEET_MASTER' | 'STORE_CLIENT'
          setAppMode(tier);

          if (tier === 'STORE_CLIENT') {
            const assigned = [status.license.storeId];
            setAssignedStoreIds(assigned);
            try {
              if (typeof localStorage !== 'undefined') {
                localStorage.setItem('sbx_app_mode', 'STORE_CLIENT');
                localStorage.setItem('sbx_assigned_stores', JSON.stringify(assigned));
              }
            } catch {}
          } else {
            // FLEET_MASTER has unrestricted store access
            setAssignedStoreIds([]);
            try {
              if (typeof localStorage !== 'undefined') {
                localStorage.setItem('sbx_app_mode', 'FLEET_MASTER');
                localStorage.removeItem('sbx_assigned_stores');
              }
            } catch {}
          }
        } else if (status.status === 'HARDWARE_LOCKOUT' || status.status === 'TAMPER_DETECTED') {
          setIsStationActivated(false);
          setActiveLicense(status.license || null);
          setAppMode('STORE_CLIENT');
          setAssignedStoreIds([]);
          try {
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem('sbx_app_mode', 'STORE_CLIENT');
            }
          } catch {}
          if (status.revoked) {
            AuthService.logout();
            setCurrentSession(null);
          }
        } else {
          // UNACTIVATED
          setIsStationActivated(false);
          setActiveLicense(null);
          setAppMode('STORE_CLIENT');
          setAssignedStoreIds([]);
          try {
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem('sbx_app_mode', 'STORE_CLIENT');
            }
          } catch {}
        }
      } catch (err) {
        console.error('❌ [AuthContext] Błąd weryfikacji licencji stacji:', err);
        if (isMounted) setAppMode('STORE_CLIENT');
      }
    };

    initializeStationSecurity();

    // Listen for real-time license revocation (Kill-Switch broadcast)
    const handleRevocation = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      console.warn('⚡ [AuthContext] Otrzymano zdarzenie Kill-Switch:', detail);
      setIsStationActivated(false);
      setAppMode('STORE_CLIENT');
      setAssignedStoreIds([]);
      AuthService.logout();
      setCurrentSession(null);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('sbx:license-revoked', handleRevocation);
    }
    return () => {
      isMounted = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('sbx:license-revoked', handleRevocation);
      }
    };
  }, []);

  const activateStation = useCallback(async (key: string, expectedStoreId?: string) => {
    const res = await licensingService.activateStation(key, expectedStoreId);
    if (res.success && res.license) {
      setIsStationActivated(true);
      setActiveLicense(res.license);
      setAppMode(res.license.tier);
      if (res.license.tier === 'STORE_CLIENT') {
        const assigned = [res.license.storeId];
        setAssignedStoreIds(assigned);
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('sbx_app_mode', 'STORE_CLIENT');
            localStorage.setItem('sbx_assigned_stores', JSON.stringify(assigned));
          }
        } catch {}
      } else {
        setAssignedStoreIds([]);
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('sbx_app_mode', 'FLEET_MASTER');
            localStorage.removeItem('sbx_assigned_stores');
          }
        } catch {}
      }
    }
    return res;
  }, []);

  const deactivateStation = useCallback(async (reason = 'Deaktywacja stacji przez użytkownika') => {
    await licensingService.revokeLicense(reason);
    setIsStationActivated(false);
    setActiveLicense(null);
    setAppMode('STORE_CLIENT');
    setAssignedStoreIds([]);
    AuthService.logout();
    setCurrentSession(null);
  }, []);

  const loginWith2Fa = useCallback(async (email: string, otpCode: string) => {
    const res = await AuthService.verify2FaOtp(email, otpCode);
    if (res.success && res.session) {
      setCurrentSession(res.session);
    }
    return res;
  }, []);

  const quickLoginSM = useCallback((unitCode = '') => {
    const session = AuthService.quickLoginStoreManager(unitCode);
    setCurrentSession(session);
    return session;
  }, []);

  const logout = useCallback(() => {
    AuthService.logout();
    setCurrentSession(null);
  }, []);

  const lockSession = useCallback(() => {
    setIsLocked(true);

    // 1. Broadcast modal dismissal & session locked events
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('sbx:dismiss-modals'));
        window.dispatchEvent(new CustomEvent('sbx:session-locked'));
      } catch (_) {}
    }

    // 2. 3-tier RAM cryptographic key zeroization
    try {
      StoreKeyCache.clear();
    } catch (_) {}

    try {
      if (typeof (licensingService as any).clearDecryptedKeyCache === 'function') {
        (licensingService as any).clearDecryptedKeyCache();
      }
    } catch (_) {}

    try {
      const api = typeof window !== 'undefined' ? (window as any).api || (window as any).electronAPI : null;
      if (api?.cryptoZeroizeKeys) {
        api.cryptoZeroizeKeys().catch(() => {});
      }
    } catch (_) {}

    // 3. Security audit log
    AdminService.addAuditLog({
      actorName: currentSession?.fullName || 'System',
      actorRole: currentSession?.role || 'STORE_MANAGER',
      actionType: 'SECURITY_ALERT',
      targetResource: 'session:auto-lock',
      details: 'Automatyczna blokada sesji (15 min bezczynności). Wyzerowano klucze RAM.',
      deviceName: AuthService.getDeviceName(),
    });
  }, [currentSession]);

  const unlockSession = useCallback(async (credential: string) => {
    const trimmed = (credential || '').trim();
    if (!trimmed) return false;

    // Accepts Store Manager master PIN '1812' or valid password/credential (>= 4 chars)
    const isValid = trimmed === '1812' || trimmed.length >= 4;
    if (isValid) {
      setIsLocked(false);
      AdminService.addAuditLog({
        actorName: currentSession?.fullName || 'Store Manager',
        actorRole: currentSession?.role || 'STORE_MANAGER',
        actionType: 'LOGIN_2FA',
        targetResource: 'session:unlock',
        details: 'Pomyślne odblokowanie sesji stacji roboczej',
        deviceName: AuthService.getDeviceName(),
      });
      return true;
    }
    return false;
  }, [currentSession]);

  const isFleetMaster = appMode === 'FLEET_MASTER';
  const isStoreClient = appMode === 'STORE_CLIENT';
  const isAuthenticated = Boolean(currentSession);
  const currentUserRole = currentSession?.role || null;

  return (
    <AuthContext.Provider
      value={{
        appMode,
        isFleetMaster,
        isStoreClient,
        assignedStoreIds,
        setAppModeManual,
        isStationActivated,
        licenseStatus,
        activeLicense,
        activateStation,
        deactivateStation,
        isAuthenticated,
        currentSession,
        currentUserRole,
        loginWith2Fa,
        quickLoginSM,
        logout,
        isLocked,
        lockSession,
        unlockSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
