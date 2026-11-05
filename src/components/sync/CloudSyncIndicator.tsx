// src/components/sync/CloudSyncIndicator.tsx
/**
 * Starbucks Operations Suite — Real-time Cloud First Status Indicator (Feature F18 / Step 4)
 *
 * Wizualny wskaźnik stanu bazy chmurowej i replikacji lokalnej SQLite:
 * - 🟢 Na żywo (Cloud First): aktywne połączenie w czasie rzeczywistym z Firestore.
 * - 🟡 Synchronizowanie (Outbox: N): oczekujące mutacje przesyłane asynchronicznie do chmury.
 * - 🔴 Tryb lokalny (Offline): brak łączności, bezpieczny zapis w lokalnym SQLite.
 * - 🔵 Łączenie...: nawiązywanie subskrypcji strumienia zdarzeń.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  RefreshCw,
  CloudUpload,
  CloudOff,
  AlertCircle,
  Radio,
  Zap,
} from 'lucide-react';
import { SyncEngine, SyncStatus } from '../../services/sync/syncEngine';
import { CloudRealtimeTransport, RealtimeConnectionState } from '../../services/sync/cloudRealtimeTransport';
import { InboundSyncConsumer } from '../../services/sync/inboundSyncConsumer';

interface CloudSyncIndicatorProps {
  compact?: boolean;
  onSyncCompleted?: () => void;
}

export const CloudSyncIndicator: React.FC<CloudSyncIndicatorProps> = ({
  compact = false,
  onSyncCompleted,
}) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => SyncEngine.getStatus());
  const [realtimeState, setRealtimeState] = useState<RealtimeConnectionState>(() =>
    CloudRealtimeTransport.getConnectionState()
  );
  const [isSyncingInFlight, setIsSyncingInFlight] = useState<boolean>(false);
  const [showSuccessToast, setShowSuccessToast] = useState<boolean>(false);
  const [inboundToastMessage, setInboundToastMessage] = useState<string | null>(null);

  useEffect(() => {
    // 1. Subskrybuj stan Outbox w SyncEngine
    const unsubscribeSync = SyncEngine.subscribe((newStatus) => {
      setSyncStatus(newStatus);
    });

    // 2. Subskrybuj stan połączenia czasu rzeczywistego w CloudRealtimeTransport
    const unsubscribeTransport = CloudRealtimeTransport.onStatusChange((newState) => {
      setRealtimeState(newState);
    });

    // 3. Subskrybuj przychodzące zdarzenia z innych stacji (Inbound Sync)
    const unsubscribeInbound = InboundSyncConsumer.onEventApplied((evt) => {
      setInboundToastMessage(`⚡ Zsynchronizowano zmianę (${evt.domain})`);
      setTimeout(() => setInboundToastMessage(null), 2500);
    });

    const handleOnline = () => {
      setSyncStatus(SyncEngine.getStatus());
      setRealtimeState(CloudRealtimeTransport.getConnectionState());
    };
    const handleOffline = () => {
      setSyncStatus(SyncEngine.getStatus());
      setRealtimeState('OFFLINE');
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    return () => {
      unsubscribeSync();
      unsubscribeTransport();
      unsubscribeInbound();
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, []);

  const handleTriggerSync = useCallback(async () => {
    if (isSyncingInFlight || !syncStatus.isOnline) return;

    setIsSyncingInFlight(true);
    try {
      await SyncEngine.flushOutbox();
      const activeStore = CloudRealtimeTransport.getActiveStoreId();
      if (activeStore) {
        await CloudRealtimeTransport.pollOnce(activeStore);
      }
      setShowSuccessToast(true);
      if (onSyncCompleted) onSyncCompleted();
      setTimeout(() => setShowSuccessToast(false), 2800);
    } catch (err) {
      console.error('[CloudSyncIndicator] Błąd manualnej synchronizacji:', err);
    } finally {
      setIsSyncingInFlight(false);
    }
  }, [isSyncingInFlight, syncStatus.isOnline, onSyncCompleted]);

  const isSyncing = isSyncingInFlight || syncStatus.syncState === 'syncing';
  const hasPending = syncStatus.pendingCount > 0;
  const isOffline =
    !syncStatus.isOnline ||
    syncStatus.syncState === 'offline' ||
    realtimeState === 'OFFLINE' ||
    realtimeState === 'DISCONNECTED';
  const isError = syncStatus.syncState === 'error' || realtimeState === 'ERROR';
  const isConnecting = realtimeState === 'CONNECTING';
  const isLive = realtimeState === 'CONNECTED' && !hasPending && !isSyncing;

  // 1. TRYB OFFLINE (Brak sieci / Tryb lokalny)
  if (isOffline) {
    return (
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-stone-100 border border-stone-300 text-stone-600 text-xs font-semibold cursor-help shadow-2xs"
        title="🔴 Brak połączenia z siecią. Wszystkie dane są bezpiecznie zapisywane lokalnie w bazie SQLite na dysku tego komputera. Synchronizacja nastąpi automatycznie po przywróceniu połączenia."
      >
        <CloudOff className="w-3.5 h-3.5 text-stone-500 shrink-0" />
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
        {!compact ? <span>Tryb lokalny (Offline)</span> : <span>Offline</span>}
      </div>
    );
  }

  // 2. BŁĄD POŁĄCZENIA / SYNCHRONIZACJI
  if (isError) {
    return (
      <button
        onClick={handleTriggerSync}
        disabled={isSyncing}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-800 text-xs font-bold transition-all cursor-pointer animate-pulse shadow-2xs"
        title="Wystąpił problem z połączeniem chmurowym. Kliknij, aby ponowić próbę przesłania danych."
      >
        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
        {!compact ? <span>Błąd chmury (Ponów)</span> : <span>Błąd</span>}
      </button>
    );
  }

  // 3. ŁĄCZENIE Z CHMURĄ
  if (isConnecting) {
    return (
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 text-xs font-semibold cursor-wait shadow-2xs"
        title="Nawiązywanie połączenia czasu rzeczywistego z chmurą Google Cloud Firestore..."
      >
        <RefreshCw className="w-3.5 h-3.5 text-sky-600 animate-spin shrink-0" />
        {!compact ? <span>Łączenie z chmurą...</span> : <span>Łączenie</span>}
      </div>
    );
  }

  // 4. SYNCHRONIZOWANIE ZMIAN W TLE / OCZEKUJĄCY OUTBOX
  if (isSyncing || hasPending) {
    return (
      <button
        onClick={handleTriggerSync}
        disabled={isSyncing}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold transition-all cursor-pointer group shadow-2xs"
        title={
          isSyncing
            ? 'Trwa przesyłanie zmian do chmury Firestore...'
            : `W kolejce Outbox oczekuje ${syncStatus.pendingCount} zmian. Kliknij, aby wymusić natychmiastowe przesłanie.`
        }
      >
        {isSyncing ? (
          <RefreshCw className="w-3.5 h-3.5 text-amber-600 animate-spin shrink-0" />
        ) : (
          <CloudUpload className="w-3.5 h-3.5 text-amber-600 group-hover:scale-110 transition-transform shrink-0" />
        )}
        <span>
          {isSyncing ? 'Synchronizowanie...' : `W kolejce: ${syncStatus.pendingCount}`}
        </span>
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
      </button>
    );
  }

  // 5. NA ŻYWO (CLOUD FIRST — POŁĄCZENIE AKTYWNE)
  return (
    <div className="relative">
      <button
        onClick={handleTriggerSync}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50/90 hover:bg-emerald-100 border border-emerald-300 text-[#006241] text-xs font-bold transition-all cursor-pointer group shadow-2xs"
        title="🟢 Tryb Cloud First aktywny. Baza robocza w chmurze Firestore synchronizuje się na żywo z lokalnym lustrem SQLite. Kliknij, aby wymusić odświeżenie."
      >
        <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse shrink-0" />
        {!compact ? (
          <span className="flex items-center gap-1">
            <span>Na żywo</span>
            <span className="text-[10px] text-emerald-700/80 font-medium">(Cloud First)</span>
          </span>
        ) : (
          <span>Na żywo ✓</span>
        )}
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
        </span>
      </button>

      {/* Dyskretny toast manualnego odświeżenia */}
      {showSuccessToast && (
        <div className="absolute right-0 top-full mt-1.5 bg-[#1E3932] text-white text-[11px] font-bold px-3 py-1.5 rounded-xl shadow-lg border border-emerald-500/30 whitespace-nowrap z-50 animate-in fade-in slide-in-from-top-1 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Baza na żywo w 100% zsynchronizowana</span>
        </div>
      )}

      {/* Dyskretny toast nadejścia zewnętrznej zmiany z innej stacji */}
      {inboundToastMessage && (
        <div className="absolute right-0 top-full mt-1.5 bg-blue-900 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl shadow-lg border border-blue-400/40 whitespace-nowrap z-50 animate-in fade-in slide-in-from-top-1 flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-300" />
          <span>{inboundToastMessage}</span>
        </div>
      )}
    </div>
  );
};
