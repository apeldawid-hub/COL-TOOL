// src/components/sync/CloudSyncIndicator.tsx
/**
 * Starbucks Operations Suite — Friendly Retail Cloud Sync Indicator
 * Connects directly to SyncEngine (Zero-Leak) and translates technical outbox status
 * into ergonomic, 1-click status indicators for Store Managers on store laptops.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  RefreshCw,
  CloudUpload,
  CloudOff,
  AlertCircle,
} from 'lucide-react';
import { SyncEngine, SyncStatus } from '../../services/sync/syncEngine';

interface CloudSyncIndicatorProps {
  compact?: boolean;
  onSyncCompleted?: () => void;
}

export const CloudSyncIndicator: React.FC<CloudSyncIndicatorProps> = ({
  compact = false,
  onSyncCompleted,
}) => {
  const [status, setStatus] = useState<SyncStatus>(() => SyncEngine.getStatus());
  const [isSyncingInFlight, setIsSyncingInFlight] = useState<boolean>(false);
  const [showSuccessToast, setShowSuccessToast] = useState<boolean>(false);

  useEffect(() => {
    // Subskrybuj zdarzenia silnika synchronizacji
    const unsubscribe = SyncEngine.subscribe((newStatus) => {
      setStatus(newStatus);
    });

    const handleOnline = () => setStatus(SyncEngine.getStatus());
    const handleOffline = () => setStatus(SyncEngine.getStatus());

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    return () => {
      unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, []);

  const handleTriggerSync = useCallback(async () => {
    if (isSyncingInFlight || !status.isOnline) return;

    setIsSyncingInFlight(true);
    try {
      await SyncEngine.flushOutbox();
      setShowSuccessToast(true);
      if (onSyncCompleted) onSyncCompleted();
      setTimeout(() => setShowSuccessToast(false), 2800);
    } catch (err) {
      console.error('[CloudSyncIndicator] Błąd manualnej synchronizacji:', err);
    } finally {
      setIsSyncingInFlight(false);
    }
  }, [isSyncingInFlight, status.isOnline, onSyncCompleted]);

  // Formatowanie względnego czasu ostatniej synchronizacji
  const formatLastSync = (ts: string | null): string => {
    if (!ts) return 'przed chwilą';
    try {
      const diffMs = Date.now() - new Date(ts).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'przed chwilą';
      if (diffMins < 60) return `${diffMins}m temu`;
      const diffHours = Math.floor(diffMins / 60);
      return `${diffHours}h temu`;
    } catch {
      return 'przed chwilą';
    }
  };

  const isSyncing = isSyncingInFlight || status.syncState === 'syncing';
  const hasPending = status.pendingCount > 0;
  const isOffline = !status.isOnline || status.syncState === 'offline';
  const isError = status.syncState === 'error';

  // 1. TRYB OFFLINE
  if (isOffline) {
    return (
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-stone-100 border border-stone-300 text-stone-600 text-xs font-semibold cursor-help"
        title="Brak połączenia z siecią. Wszystkie dane są bezpiecznie zapisywane lokalnie na dysku SQLite tego laptopa. Synchronizacja nastąpi automatycznie po przywróceniu połączenia."
      >
        <CloudOff className="w-3.5 h-3.5 text-stone-500" />
        {!compact && <span>Tryb lokalny (Offline)</span>}
      </div>
    );
  }

  // 2. BŁĄD SYNCHRONIZACJI
  if (isError) {
    return (
      <button
        onClick={handleTriggerSync}
        disabled={isSyncing}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-800 text-xs font-bold transition-all cursor-pointer animate-pulse"
        title="Wystąpił problem podczas synchronizacji. Kliknij, aby ponowić próbę przesłania danych."
      >
        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
        {!compact && <span>Błąd synchronizacji (Ponów)</span>}
      </button>
    );
  }

  // 3. W TRAKCIE SYNCHRONIZACJI
  if (isSyncing) {
    return (
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold cursor-wait"
        title="Trwa przesyłanie zmian grafików i danych do skarbca chmurowego..."
      >
        <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin shrink-0" />
        {!compact && <span>Synchronizowanie...</span>}
      </div>
    );
  }

  // 4. OCZEKUJĄCE ZMIANY (PENDING OUTBOX)
  if (hasPending) {
    return (
      <button
        onClick={handleTriggerSync}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold transition-all cursor-pointer group shadow-2xs"
        title={`W kolejce oczekuje ${status.pendingCount} zmian. Kliknij, aby zsynchronizować teraz z chmurą.`}
      >
        <CloudUpload className="w-3.5 h-3.5 text-amber-600 group-hover:scale-110 transition-transform shrink-0" />
        <span>Oczekuje: <strong>{status.pendingCount}</strong></span>
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
      </button>
    );
  }

  // 5. W 100% ZSYNCHRONIZOWANO (IDLE / SUCCESS)
  return (
    <div className="relative">
      <button
        onClick={handleTriggerSync}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/90 text-[#006241] text-xs font-bold transition-all cursor-pointer group shadow-2xs"
        title="Dane kawiarni są w 100% zsynchronizowane z chmurą. Kliknij, aby wymusić natychmiastowe odświeżenie."
      >
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 group-hover:rotate-12 transition-transform shrink-0" />
        {!compact ? (
          <span>Zsynchronizowano <span className="text-[10px] text-emerald-700/80 font-normal">({formatLastSync(status.lastSyncAt)})</span></span>
        ) : (
          <span>Chmura ✓</span>
        )}
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
      </button>

      {/* Dyskretny toast potwierdzenia synchronizacji */}
      {showSuccessToast && (
        <div className="absolute right-0 top-full mt-1.5 bg-[#1E3932] text-white text-[11px] font-bold px-3 py-1.5 rounded-xl shadow-lg border border-emerald-500/30 whitespace-nowrap z-50 animate-in fade-in slide-in-from-top-1">
          ✓ Zsynchronizowano pomyślnie z chmurą
        </div>
      )}
    </div>
  );
};
