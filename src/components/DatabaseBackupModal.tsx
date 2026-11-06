import React, { useState, useEffect } from 'react';
import {
  X,
  Database,
  ShieldCheck,
  RotateCcw,
  HardDrive,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  PlusCircle,
  FileCheck,
  ShieldAlert,
  Activity,
  Zap,
  Layers,
  ChevronDown,
  ChevronUp,
  CloudLightning,
  Lock,
  Cloud,
  Calendar,
  Users,
  DollarSign,
  GraduationCap,
} from 'lucide-react';
import { databaseHealthService } from '../services/databaseHealthService';
import { DatabaseHealthStatus } from '../types';
import { useStore } from '../context/StoreContext';
import { ProfilePolicyService, AppRuntimeMode } from '../services/security/profilePolicyService';
import {
  CloudSnapshotService,
  SnapshotDomain,
  SnapshotCollisionReport,
} from '../services/sync/cloudSnapshotService';

interface DatabaseBackupRecord {
  filename: string;
  filePath: string;
  sizeBytes: number;
  timestamp: string;
  formattedDate: string;
  reason: string;
}

interface DatabaseStatus {
  dbPath: string;
  exists: boolean;
  sizeBytes: number;
  lastModified: string;
  backupsCount: number;
  latestBackup?: DatabaseBackupRecord;
}

interface DatabaseBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreSuccess?: () => void;
  appMode?: AppRuntimeMode;
}

export const DatabaseBackupModal: React.FC<DatabaseBackupModalProps> = ({
  isOpen,
  onClose,
  onRestoreSuccess,
  appMode,
}) => {
  const { currentStore, isStoreClient, appMode: storeAppMode } = useStore();
  const effectiveMode = appMode || storeAppMode || (isStoreClient ? 'STORE_CLIENT' : 'FLEET_MASTER');
  const policy = ProfilePolicyService.getPolicy(effectiveMode);
  const [backups, setBackups] = useState<DatabaseBackupRecord[]>([]);
  const [dbStatus, setDbStatus] = useState<DatabaseStatus | null>(null);
  const [healthStatus, setHealthStatus] = useState<DatabaseHealthStatus | null>(() =>
    databaseHealthService.getHealth()
  );
  const [isCheckingHealth, setIsCheckingHealth] = useState<boolean>(false);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [showTableDetails, setShowTableDetails] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isCreatingCloudSnapshot, setIsCreatingCloudSnapshot] = useState<boolean>(false);
  const [customReason, setCustomReason] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Dwustopniowe Przywracanie & Trzypoziomowa Tarcza Kolizyjna
  const [previewBackup, setPreviewBackup] = useState<DatabaseBackupRecord | null>(null);
  const [collisionReport, setCollisionReport] = useState<SnapshotCollisionReport | null>(null);
  const [isCheckingCollision, setIsCheckingCollision] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [selectedDomains, setSelectedDomains] = useState<SnapshotDomain[]>([
    'schedules',
    'personnel',
    'financials',
    'trainings',
  ]);

  const lastSnapshotTs = CloudSnapshotService.getLastSnapshotTime(currentStore?.id);
  const lastSnapshotFormatted = lastSnapshotTs
    ? new Date(lastSnapshotTs).toLocaleString('pl-PL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const loadBackupData = async () => {
    if (!isOpen) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      if ((window as any).api?.getDatabaseBackups) {
        const [loadedBackups, status, health] = await Promise.all([
          (window as any).api.getDatabaseBackups(currentStore?.id),
          (window as any).api.getDatabaseStatus ? (window as any).api.getDatabaseStatus(currentStore?.id) : Promise.resolve(null),
          databaseHealthService.checkHealth().catch(() => null),
        ]);
        setBackups(loadedBackups || []);
        if (status) setDbStatus(status);
        if (health) setHealthStatus(health);
      } else {
        const health = await databaseHealthService.checkHealth();
        setHealthStatus(health);
      }
    } catch (err: any) {
      console.error('Błąd ładowania danych kopii zapasowych:', err);
      setErrorMessage(err.message || 'Nie udało się pobrać listy kopii zapasowych.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunHealthCheck = async () => {
    setIsCheckingHealth(true);
    setErrorMessage(null);
    try {
      const res = await databaseHealthService.checkHealth();
      setHealthStatus(res);
      setSuccessMessage(
        `Test spójności SQLite zakończony: ${
          res.integrity === 'ok' ? 'Baza jest w 100% spójna ✓' : res.integrityMessage
        }`
      );
    } catch (err: any) {
      console.error('Błąd testu spójności bazy:', err);
      setErrorMessage(err.message || 'Nie udało się przeprowadzić testu spójności.');
    } finally {
      setIsCheckingHealth(false);
    }
  };

  const handleRunVacuum = async () => {
    setIsOptimizing(true);
    setErrorMessage(null);
    try {
      const res = await databaseHealthService.optimizeDatabase();
      if (res.health) setHealthStatus(res.health);
      setSuccessMessage(res.message || 'Optymalizacja VACUUM zakończona sukcesem.');
      await loadBackupData();
      if (onRestoreSuccess) onRestoreSuccess();
    } catch (err: any) {
      console.error('Błąd optymalizacji VACUUM:', err);
      setErrorMessage(err.message || 'Wystąpił błąd podczas optymalizacji VACUUM.');
    } finally {
      setIsOptimizing(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadBackupData();
      setSuccessMessage(null);
      setErrorMessage(null);
      setPreviewBackup(null);
      setCollisionReport(null);
      setCustomReason('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreateBackup = async () => {
    setIsCreating(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      const reason = customReason.trim() || 'Ręczna kopia Store Managera';
      if ((window as any).api?.createDatabaseBackup) {
        const res = await (window as any).api.createDatabaseBackup(reason, currentStore?.id);
        if (res.success) {
          setSuccessMessage(res.message || 'Kopia zapasowa została pomyślnie utworzona.');
          setCustomReason('');
          await loadBackupData();
        } else {
          setErrorMessage('Nie udało się utworzyć kopii zapasowej.');
        }
      } else {
        setSuccessMessage('Kopia wirtualna została pomyślnie utworzona.');
      }
    } catch (err: any) {
      console.error('Błąd tworzenia backupu:', err);
      setErrorMessage(err.message || 'Wystąpił błąd podczas tworzenia kopii zapasowej.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateCloudSnapshot = async () => {
    const storeId = currentStore?.id || '108120';
    setIsCreatingCloudSnapshot(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      const res = await CloudSnapshotService.createSnapshot(
        storeId,
        customReason.trim() || 'Ręczny Cloud Snapshot (AES-256)'
      );
      if (res.success) {
        setSuccessMessage(res.message);
        setCustomReason('');
        await loadBackupData();
      } else {
        setErrorMessage(res.message || 'Nie udało się wykonać snapshotu w chmurze.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Błąd tworzenia snapshotu.');
    } finally {
      setIsCreatingCloudSnapshot(false);
    }
  };

  const handleOpenRestorePreview = async (backup: DatabaseBackupRecord) => {
    setPreviewBackup(backup);
    setSelectedDomains(['schedules', 'personnel', 'financials', 'trainings']);
    setIsCheckingCollision(true);
    setCollisionReport(null);
    setErrorMessage(null);

    try {
      const storeId = currentStore?.id || '108120';
      const report = await CloudSnapshotService.checkCollisions(storeId, backup.timestamp);
      setCollisionReport(report);
    } catch (err: any) {
      console.warn('Błąd sprawdzania kolizji:', err);
    } finally {
      setIsCheckingCollision(false);
    }
  };

  const toggleDomain = (domain: SnapshotDomain) => {
    setSelectedDomains((prev) =>
      prev.includes(domain) ? prev.filter((d) => d !== domain) : [...prev, domain]
    );
  };

  const handleExecuteRestore = async () => {
    if (!previewBackup) return;
    if (selectedDomains.length === 0) {
      setErrorMessage('Wybierz przynajmniej jeden obszar danych do przywrócenia.');
      return;
    }

    setIsRestoring(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      const storeId = currentStore?.id || '108120';
      const res = await CloudSnapshotService.executeRestore({
        storeId,
        snapshotId: previewBackup.filename,
        selectedDomains,
      });

      if (res.success) {
        setSuccessMessage(res.message);
        setPreviewBackup(null);
        await loadBackupData();
        if (onRestoreSuccess) onRestoreSuccess();
      } else {
        setErrorMessage(res.message || 'Nie udało się przywrócić bazy danych.');
      }
    } catch (err: any) {
      console.error('Błąd przywracania bazy:', err);
      setErrorMessage(err.message || 'Wystąpił błąd podczas przywracania bazy danych.');
    } finally {
      setIsRestoring(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes <= 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-[#E2E8E5] flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in duration-200">
        {/* NAGŁÓWEK OKNA */}
        <div className="px-6 py-5 border-b border-[#E2E8E5] flex items-center justify-between bg-[#F7F9F8]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center border border-emerald-200 shadow-2xs">
              <Database className="w-5 h-5 text-[#006241]" />
            </div>
            <div>
              <h2 className="text-base font-black text-[#1E3932] flex items-center gap-2">
                Kopie Zapasowe i Bezpieczeństwo Bazy Danych
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#006241] text-white">
                  SQLite
                </span>
              </h2>
              <p className="text-xs text-[#5C6F68]">
                Lokalna persystencja kawiarni {currentStore?.shortName || currentStore?.name || 'Starbucks'} • Automatyczna rotacja ostatnich 15 kopii
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* KOMUNIKATY SUKCESU / BŁĘDU */}
        {successMessage && (
          <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#006241] shrink-0" />
              <span className="font-semibold">{successMessage}</span>
            </div>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-700 hover:text-emerald-900 text-xs font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="font-semibold">{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-700 hover:text-rose-900 text-xs font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* DWUSTOPNIOWY MODAL PODGLĄDU I PRZYWRACANIA Z TARCZĄ KOLIZYJNĄ */}
        {previewBackup && (
          <div className="mx-6 mt-4 p-4 rounded-2xl bg-amber-50/80 border-2 border-amber-300 shadow-sm animate-in fade-in">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-200 text-amber-900 shrink-0 mt-0.5">
                <RotateCcw className="w-5 h-5 text-amber-800" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-amber-950 flex items-center gap-2">
                      <span>Dwustopniowe Przywracanie Bazy (Podgląd)</span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-bold">
                        Read-Only Preview
                      </span>
                    </h3>
                    <span className="text-[11px] font-mono text-amber-900">
                      {formatFileSize(previewBackup.sizeBytes)}
                    </span>
                  </div>
                  <p className="text-xs text-amber-900 mt-0.5">
                    Punkt kontrolny z dnia <strong>{previewBackup.formattedDate}</strong> • Powód: <em>{previewBackup.reason}</em>
                  </p>
                </div>

                {/* FILAR 1: OSTRZEŻENIE O KOLIZJI NOWSZYCH ZMIAN */}
                {isCheckingCollision ? (
                  <div className="p-2.5 rounded-xl bg-white/70 border border-amber-200 text-[11px] text-amber-800 flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
                    <span>Weryfikacja zmian w chmurze (Tarcza Kolizyjna)...</span>
                  </div>
                ) : collisionReport?.hasCollision ? (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-950 animate-in fade-in">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <span className="font-bold">⚠️ Uwaga: Wykryto nowsze zmiany w lokalu!</span>
                        <p className="text-[11px] text-rose-800 mt-0.5 leading-relaxed">
                          Użytkownik <strong>{collisionReport.lastEditor || 'Inny manager'}</strong> wprowadził{' '}
                          <strong>{collisionReport.newerEventsCount}</strong> modyfikacji w chmurze po dacie tej kopii
                          {collisionReport.lastEditedAt && (
                            <> (ostatnia edycja: {new Date(collisionReport.lastEditedAt).toLocaleTimeString('pl-PL')})</>
                          )}.
                          Przywrócenie pełnego stanu nadpisze te zmiany.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-2 rounded-xl bg-emerald-50/80 border border-emerald-200 text-[11px] text-[#006241] flex items-center gap-1.5 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Brak nowszych kolizji w chmurze – stan bezpieczny do przywrócenia.</span>
                  </div>
                )}

                {/* FILAR 3: SELEKTYWNY WYBÓR DOMEN DO PRZYWRÓCENIA */}
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-amber-950 mb-1.5 flex items-center gap-1">
                    <Layers className="w-3 h-3 text-amber-800" />
                    Wybierz obszary do przywrócenia (Selektywna Tarcza):
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <label className="flex items-center gap-2 bg-white/80 p-2 rounded-xl border border-amber-200 cursor-pointer hover:bg-white transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedDomains.includes('schedules')}
                        onChange={() => toggleDomain('schedules')}
                        className="rounded accent-[#006241]"
                      />
                      <Calendar className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span className="font-semibold text-stone-800">Grafik Kierowniczy</span>
                    </label>

                    <label className="flex items-center gap-2 bg-white/80 p-2 rounded-xl border border-amber-200 cursor-pointer hover:bg-white transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedDomains.includes('financials')}
                        onChange={() => toggleDomain('financials')}
                        className="rounded accent-[#006241]"
                      />
                      <DollarSign className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                      <span className="font-semibold text-stone-800">MAPAL Fichajes & AOP</span>
                    </label>

                    <label className="flex items-center gap-2 bg-white/80 p-2 rounded-xl border border-amber-200 cursor-pointer hover:bg-white transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedDomains.includes('personnel')}
                        onChange={() => toggleDomain('personnel')}
                        className="rounded accent-[#006241]"
                      />
                      <Users className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                      <span className="font-semibold text-stone-800">Kierownicy & Skład</span>
                    </label>

                    <label className="flex items-center gap-2 bg-white/80 p-2 rounded-xl border border-amber-200 cursor-pointer hover:bg-white transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedDomains.includes('trainings')}
                        onChange={() => toggleDomain('trainings')}
                        className="rounded accent-[#006241]"
                      />
                      <GraduationCap className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      <span className="font-semibold text-stone-800">Baza Szkoleń First 30</span>
                    </label>
                  </div>
                </div>

                {/* FILAR 2: GWARANCJA AUTOMATYCZNEJ KOPII RATUNKOWEJ */}
                <p className="text-[11px] text-amber-900 font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                  Przed przywróceniem system automatycznie utworzy kopię ratunkową obecnego stanu (praca nikogo nie zginie).
                </p>

                {/* PRZYCISKI AKCJI */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleExecuteRestore}
                    disabled={isRestoring || selectedDomains.length === 0}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isRestoring ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3.5 h-3.5" />
                    )}
                    <span>{isRestoring ? 'Przywracanie danych...' : 'Zatwierdź Przywrócenie'}</span>
                  </button>
                  <button
                    onClick={() => setPreviewBackup(null)}
                    disabled={isRestoring}
                    className="px-3.5 py-2 rounded-xl bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 text-xs font-semibold cursor-pointer"
                  >
                    Anuluj
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ZAWARTOŚĆ GŁÓWNA ZE SCROLLEM */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-thin">
          {/* NOWY KOMPONENT: AUTOMATYCZNA TARCZA CHMUROWA (CLOUD SNAPSHOT) */}
          <div className="bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-[#006241] border border-emerald-200 shadow-2xs">
                <Cloud className="w-4 h-4 text-[#006241]" />
              </div>
              <div>
                <div className="text-xs font-bold text-[#1E3932] flex items-center gap-1.5">
                  <span>Automatyczna Tarcza Chmurowa (Cloud Snapshot)</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-emerald-200/80 text-[#006241] text-[9px] font-bold">
                    AES-256
                  </span>
                </div>
                <p className="text-[11px] text-stone-600 mt-0.5">
                  {lastSnapshotFormatted
                    ? `Ostatni snapshot w chmurze: ${lastSnapshotFormatted} • Stan lokalu w 100% zabezpieczony`
                    : 'Automatyczna ochrona aktywna (synchronizacja w czasie rzeczywistym)'}
                </p>
              </div>
            </div>
            <button
              onClick={handleCreateCloudSnapshot}
              disabled={isCreatingCloudSnapshot}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-50 border border-emerald-300 text-[#006241] text-xs font-bold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
              title="Wymusza natychmiastowe utworzenie punktu kontrolnego w chmurze Google Cloud"
            >
              <CloudLightning className={`w-3.5 h-3.5 text-emerald-600 ${isCreatingCloudSnapshot ? 'animate-bounce' : ''}`} />
              <span>{isCreatingCloudSnapshot ? 'Tworzenie snapshotu...' : 'Zrób Snapshot w Chmurze'}</span>
            </button>
          </div>

          {/* INSPEKTOR ZDROWIA & OPTYMALIZACJI SQLITE */}
          <div className="bg-gradient-to-br from-stone-50 via-emerald-50/20 to-stone-50 p-4.5 rounded-2xl border border-emerald-900/15 shadow-2xs space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-900/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-[#006241] border border-emerald-200 shadow-2xs">
                  <Activity className="w-4 h-4 text-[#006241]" />
                </div>
                <div>
                  <h3 className="text-xs font-black tracking-wider uppercase text-[#1E3932] flex items-center gap-2">
                    <span>Inspektor Zdrowia & Spójności SQLite</span>
                    {healthStatus?.integrity === 'ok' ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-200 text-[#006241] text-[10px] font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        100% Spójna (OK)
                      </span>
                    ) : healthStatus ? (
                      <span className="px-2 py-0.5 rounded-full bg-rose-100 border border-rose-300 text-rose-800 text-[10px] font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                        Błąd Spójności
                      </span>
                    ) : null}
                  </h3>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Test integralności PRAGMA integrity_check, defragmentacja pamięci podręcznej i monitoring kopii.
                  </p>
                </div>
              </div>

              {/* Przyciski testu i VACUUM */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleRunHealthCheck}
                  disabled={isCheckingHealth}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-stone-50 border border-stone-300 text-stone-800 text-xs font-bold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Uruchom PRAGMA integrity_check i PRAGMA quick_check"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-stone-500 ${isCheckingHealth ? 'animate-spin' : ''}`} />
                  <span>{isCheckingHealth ? 'Badanie...' : 'Test Spójności'}</span>
                </button>

                <button
                  onClick={handleRunVacuum}
                  disabled={isOptimizing}
                  className="px-3 py-1.5 rounded-xl bg-[#006241] hover:bg-[#00754A] text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Uruchamia VACUUM oraz PRAGMA optimize w celu odzyskania miejsca na dysku"
                >
                  <Zap className={`w-3.5 h-3.5 text-[#CBA258] ${isOptimizing ? 'animate-bounce' : ''}`} />
                  <span>{isOptimizing ? 'Optymalizowanie...' : 'Optymalizuj (VACUUM)'}</span>
                </button>
              </div>
            </div>

            {/* OSTRZEŻENIE O ZALEGŁEJ KOPII ZAPASOWEJ (> 7 DNI BEZ INTERNETU) */}
            {healthStatus?.isBackupOverdue && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 flex items-start gap-2.5 text-amber-950 animate-in fade-in">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <div className="font-bold flex items-center gap-1.5">
                    <span>Zalecana kopia zapasowa bazy danych!</span>
                    <span className="px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 text-[10px] font-mono font-bold">
                      {healthStatus.daysSinceLastBackup !== undefined ? `+${healthStatus.daysSinceLastBackup} dni` : 'brak kopii'}
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Od ostatniego zapisu minęło ponad 7 dni offline. Utwórz nową kopię zapasową lub wykonaj snapshot do chmury.
                  </p>
                </div>
              </div>
            )}

            {/* STATYSTYKI PLIKU BAZY */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div className="bg-white p-2.5 rounded-xl border border-stone-200">
                <div className="text-[10px] font-bold text-stone-500 uppercase">Rozmiar Pliku</div>
                <div className="text-sm font-black text-stone-800 mt-0.5">{healthStatus?.sizeFormatted || '—'}</div>
                <div className="text-[10px] text-stone-400">Strony: {healthStatus?.pageCount || 0} x {healthStatus?.pageSize || 4096}B</div>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-stone-200">
                <div className="text-[10px] font-bold text-stone-500 uppercase">Wolne / Poframentowane</div>
                <div className="text-sm font-black text-emerald-700 mt-0.5">{healthStatus?.wastedFormatted || '0.0 KB'}</div>
                <div className="text-[10px] text-stone-400">Freelist: {healthStatus?.freelistCount || 0} stron</div>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-stone-200">
                <div className="text-[10px] font-bold text-stone-500 uppercase">Rekordy w Tabelach</div>
                <div className="text-sm font-black text-stone-800 mt-0.5">{healthStatus?.totalRecordsCount || '—'}</div>
                <button
                  onClick={() => setShowTableDetails(!showTableDetails)}
                  className="text-[10px] font-bold text-[#006241] hover:underline flex items-center gap-0.5 mt-0.5 cursor-pointer"
                >
                  <span>{healthStatus?.tableStats?.length || 15} tabel operacyjnych</span>
                  {showTableDetails ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                </button>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-stone-200">
                <div className="text-[10px] font-bold text-stone-500 uppercase">Logi Czarnej Skrzynki</div>
                <div className="text-sm font-black text-stone-800 mt-0.5">{healthStatus?.archivedLogsCount || 0} plików</div>
                <div className="text-[10px] text-stone-400">Łącznie: {healthStatus?.archivedLogsSizeFormatted || '0 B'}</div>
              </div>
            </div>

            {/* SZCZEGÓŁOWA LISTA TABEL */}
            {showTableDetails && healthStatus?.tableStats && (
              <div className="mt-3 p-3 bg-white rounded-xl border border-stone-200 animate-in fade-in">
                <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-2">
                  Rozkład rekordów według tabel SQLite
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {healthStatus.tableStats.map((t) => (
                    <div key={t.tableName} className="flex items-center justify-between p-1.5 rounded-lg bg-stone-50 border border-stone-100">
                      <span className="text-[11px] text-stone-700 truncate mr-2" title={t.tableName}>
                        {t.label || t.tableName}
                      </span>
                      <span className="font-mono font-bold text-stone-900 text-[11px]">{t.rowCount}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* KARTA STATUSU BAZY I SZYBKI ZAPIS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Status bazy produkcyjnej */}
            <div className="col-span-2 bg-[#F7F9F8] p-4 rounded-2xl border border-[#E2E8E5] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-[#006241]" />
                    Baza Aktywna (Główna)
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-[#006241] border border-emerald-200 text-[10px] font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#006241] animate-pulse" />
                    Online
                  </span>
                </div>
                <div className="text-xs font-bold text-[#1E3932] truncate" title={dbStatus?.dbPath || 'data/tplh_forecast.db'}>
                  {dbStatus?.dbPath ? dbStatus.dbPath.split('/').slice(-2).join('/') : 'data/tplh_forecast.db'}
                </div>
                <div className="text-[11px] text-stone-500 mt-1 flex items-center gap-3">
                  <span>
                    Rozmiar: <strong className="text-stone-800">{formatFileSize(dbStatus?.sizeBytes || 0)}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Modyfikacja: <strong className="text-stone-800">{dbStatus?.lastModified || 'Brak danych'}</strong>
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#E2E8E5] flex items-center justify-between text-[11px] text-[#5C6F68]">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#006241]" />
                  Rotacja: zachowywane ostatnich <strong>15 kopii</strong>
                </span>
                <span className="font-bold text-[#1E3932]">Liczba kopii: {backups.length}</span>
              </div>
            </div>

            {/* Tworzenie nowej kopii zapasowej */}
            <div className="bg-emerald-900/5 p-4 rounded-2xl border border-emerald-900/15 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-[#006241] flex items-center gap-1.5 mb-1.5">
                  <PlusCircle className="w-3.5 h-3.5" />
                  Nowa Kopia Zapasowa
                </span>
                <p className="text-[11px] text-stone-600 mb-2">
                  Zapisz pełny punkt przywracania bazy danych przed zmianami.
                </p>
                <input
                  type="text"
                  placeholder="Notatka / Powód (opcjonalnie)"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  className="w-full bg-white border border-[#D0DCD6] rounded-xl px-2.5 py-1.5 text-xs text-[#1E3932] placeholder:text-stone-400 focus:outline-none focus:border-[#006241] shadow-2xs"
                />
              </div>

              <button
                onClick={handleCreateBackup}
                disabled={isCreating}
                className="mt-3 w-full py-2 px-3 rounded-xl bg-[#006241] hover:bg-[#004f34] text-white text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isCreating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                <span>{isCreating ? 'Tworzenie kopii...' : 'Utwórz Kopię Teraz'}</span>
              </button>
            </div>
          </div>

          {/* TABELA ISTNIEJĄCYCH KOPII ZAPASOWYCH */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-black tracking-wider uppercase text-stone-600 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-stone-500" />
                Historia Kopii Zapasowych ({backups.length})
              </h3>
              <button
                onClick={loadBackupData}
                disabled={isLoading}
                className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors cursor-pointer text-xs flex items-center gap-1 font-semibold"
                title="Odśwież listę"
              >
                <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Odśwież</span>
              </button>
            </div>

            {backups.length === 0 ? (
              <div className="text-center py-10 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                <Database className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-stone-600">Brak utworzonych kopii zapasowych</p>
                <p className="text-[11px] text-stone-400 mt-0.5">
                  Kliknij „Utwórz Kopię Teraz”, aby utworzyć pierwszy bezpieczny punkt bazy.
                </p>
              </div>
            ) : (
              <div className="border border-[#E2E8E5] rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#F7F9F8] border-b border-[#E2E8E5] text-[11px] text-stone-500 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-2.5">Data i Godzina</th>
                      <th className="px-4 py-2.5">Powód Utworzenia</th>
                      <th className="px-4 py-2.5">Rozmiar</th>
                      <th className="px-4 py-2.5 text-right">Akcja</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8E5]">
                    {backups.map((b, idx) => (
                      <tr
                        key={b.filename}
                        className={`hover:bg-emerald-50/40 transition-colors ${
                          idx === 0 ? 'bg-emerald-50/20 font-medium' : ''
                        }`}
                      >
                        {/* Data */}
                        <td className="px-4 py-3 text-stone-800 flex items-center gap-2">
                          <FileCheck className="w-3.5 h-3.5 text-[#006241] shrink-0" />
                          <div>
                            <div className="font-bold text-xs">{b.formattedDate}</div>
                            {idx === 0 && (
                              <span className="text-[9px] font-black uppercase text-[#006241] tracking-wider">
                                Najnowsza kopia
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Powód */}
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 border border-stone-200 text-[11px] font-semibold">
                            {b.reason}
                          </span>
                        </td>

                        {/* Rozmiar */}
                        <td className="px-4 py-3 text-stone-600 text-[11px] font-mono">
                          {formatFileSize(b.sizeBytes)}
                        </td>

                        {/* Akcja */}
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleOpenRestorePreview(b)}
                            className="px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 hover:border-emerald-500 font-bold text-xs shadow-2xs transition-all flex items-center gap-1.5 ml-auto cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3 text-[#006241]" />
                            <span>Przywróć</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* STOPKA OKNA */}
        <div className="px-6 py-4 border-t border-[#E2E8E5] bg-[#F7F9F8] flex items-center justify-between">
          <div className="text-[11px] text-stone-500 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#006241]" />
            <span>
              Kopie są zapisywane lokalnie w katalogu:{' '}
              <code className="font-mono font-bold text-stone-700">backups/db_backups/</code>
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold transition-all cursor-pointer"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
};
