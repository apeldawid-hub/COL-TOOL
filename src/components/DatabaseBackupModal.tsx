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
  FolderArchive,
  UploadCloud,
  DownloadCloud,
  Trash2
} from 'lucide-react';

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
}

export const DatabaseBackupModal: React.FC<DatabaseBackupModalProps> = ({
  isOpen,
  onClose,
  onRestoreSuccess
}) => {
  const [backups, setBackups] = useState<DatabaseBackupRecord[]>([]);
  const [dbStatus, setDbStatus] = useState<DatabaseStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [customReason, setCustomReason] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmRestoreFile, setConfirmRestoreFile] = useState<string | null>(null);
  const [confirmCleanSlate, setConfirmCleanSlate] = useState<boolean>(false);
  const [confirmHistoricalImport, setConfirmHistoricalImport] = useState<boolean>(false);
  const [isProcessingPackage, setIsProcessingPackage] = useState<boolean>(false);

  const loadBackupData = async () => {
    if (!isOpen) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      if ((window as any).api?.getDatabaseBackups) {
        const [loadedBackups, status] = await Promise.all([
          (window as any).api.getDatabaseBackups(),
          (window as any).api.getDatabaseStatus ? (window as any).api.getDatabaseStatus() : Promise.resolve(null)
        ]);
        setBackups(loadedBackups || []);
        if (status) setDbStatus(status);
      }
    } catch (err: any) {
      console.error('Błąd ładowania danych kopii zapasowych:', err);
      setErrorMessage(err.message || 'Nie udało się pobrać listy kopii zapasowych.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadBackupData();
      setSuccessMessage(null);
      setErrorMessage(null);
      setConfirmRestoreFile(null);
      setConfirmCleanSlate(false);
      setConfirmHistoricalImport(false);
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
        const res = await (window as any).api.createDatabaseBackup(reason);
        if (res.success) {
          setSuccessMessage(res.message || 'Kopia zapasowa została pomyślnie utworzona.');
          setCustomReason('');
          await loadBackupData();
        } else {
          setErrorMessage('Nie udało się utworzyć kopii zapasowej.');
        }
      } else {
        setSuccessMessage('Tryb demonstracyjny przeglądarki: utworzono kopię wirtualną.');
      }
    } catch (err: any) {
      console.error('Błąd tworzenia backupu:', err);
      setErrorMessage(err.message || 'Wystąpił błąd podczas tworzenia kopii zapasowej.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleExportPackage = async () => {
    setIsProcessingPackage(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      if ((window as any).api?.exportHistoricalPackage) {
        const res = await (window as any).api.exportHistoricalPackage();
        if (res.success) {
          setSuccessMessage(res.message || 'Pomyślnie wyeksportowano pełną paczkę danych do folderu ./IMPORT/.');
        } else {
          setErrorMessage('Wystąpił błąd podczas eksportu paczki danych.');
        }
      } else {
        setSuccessMessage('Paczka wyeksportowana pomyślnie.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Błąd eksportu do folderu IMPORT.');
    } finally {
      setIsProcessingPackage(false);
    }
  };

  const handleImportHistoricalPackage = async () => {
    setIsProcessingPackage(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    setConfirmHistoricalImport(false);
    try {
      if ((window as any).api?.importHistoricalPackage) {
        const res = await (window as any).api.importHistoricalPackage();
        if (res.success) {
          setSuccessMessage(res.message || 'Pomyślnie wgrano pełną paczkę danych historycznych.');
          await loadBackupData();
          if (onRestoreSuccess) onRestoreSuccess();
        } else {
          setErrorMessage('Nie udało się wgrać paczki historycznej.');
        }
      } else {
        setSuccessMessage('Wgrano dane demonstracyjne.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Błąd importu paczki z folderu IMPORT.');
    } finally {
      setIsProcessingPackage(false);
    }
  };

  const handleCleanSlateReset = async () => {
    setIsProcessingPackage(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    setConfirmCleanSlate(false);
    try {
      if ((window as any).api?.resetToCleanSlate) {
        const res = await (window as any).api.resetToCleanSlate();
        if (res.success) {
          setSuccessMessage(res.message || 'Baza danych została zresetowana do czystego stanu instalacyjnego.');
          await loadBackupData();
          if (onRestoreSuccess) onRestoreSuccess();
        } else {
          setErrorMessage('Nie udało się zresetować bazy.');
        }
      } else {
        setSuccessMessage('Zresetowano do wersji startowej.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Błąd resetowania bazy.');
    } finally {
      setIsProcessingPackage(false);
    }
  };

  const handleExecuteRestore = async () => {
    if (!confirmRestoreFile) return;
    setIsRestoring(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      if ((window as any).api?.restoreDatabaseBackup) {
        const res = await (window as any).api.restoreDatabaseBackup(confirmRestoreFile);
        if (res.success) {
          setSuccessMessage(res.message || 'Baza została pomyślnie przywrócona.');
          setConfirmRestoreFile(null);
          await loadBackupData();
          if (onRestoreSuccess) onRestoreSuccess();
        } else {
          setErrorMessage('Nie udało się przywrócić bazy danych.');
        }
      } else {
        setSuccessMessage(`Tryb demonstracyjny: zasymulowano przywrócenie pliku ${confirmRestoreFile}`);
        setConfirmRestoreFile(null);
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
                Lokalna persystencja kawiarni 108120 Janki • Automatyczna rotacja ostatnich 15 kopii
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

        {/* DIALOG POTWIERDZENIA PRZYWRÓCENIA KOPII */}
        {confirmRestoreFile && (
          <div className="mx-6 mt-4 p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 shadow-sm animate-in fade-in">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-200 text-amber-900 shrink-0 mt-0.5">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-black text-amber-950">
                  Potwierdzenie przywrócenia bazy danych
                </h3>
                <p className="text-xs text-amber-900 mt-1 leading-relaxed">
                  Czy na pewno chcesz przywrócić stan bazy danych z pliku:
                  <br />
                  <code className="font-bold bg-amber-200/70 px-1.5 py-0.5 rounded text-[11px] text-amber-950 mt-1 inline-block">
                    {confirmRestoreFile}
                  </code>
                </p>
                <p className="text-[11px] text-amber-800 font-semibold mt-2 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                  Przed przywróceniem system automatycznie wykona bezpieczną kopię ratunkową obecnego stanu.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={handleExecuteRestore}
                    disabled={isRestoring}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isRestoring ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3.5 h-3.5" />
                    )}
                    <span>{isRestoring ? 'Przywracanie bazy...' : 'Tak, przywróć ten stan'}</span>
                  </button>
                  <button
                    onClick={() => setConfirmRestoreFile(null)}
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

        {/* DIALOG POTWIERDZENIA IMPORTU PACZKI HISTORYCZNEJ */}
        {confirmHistoricalImport && (
          <div className="mx-6 mt-4 p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-400 shadow-sm animate-in fade-in">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-emerald-200 text-emerald-900 shrink-0 mt-0.5">
                <DownloadCloud className="w-5 h-5 text-[#006241]" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-black text-emerald-950">
                  Wgranie pełnej paczki danych historycznych z folderu IMPORT
                </h3>
                <p className="text-xs text-emerald-900 mt-1 leading-relaxed">
                  Ta operacja wgra kompletną bazę master ze wszystkimi danymi operacyjnymi (AOP 2021–2036, logowania MAPAL Fichajes, 9 miesięcy grafików 2026, zespół i szkolenia).
                </p>
                <p className="text-[11px] text-emerald-800 font-semibold mt-2 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                  Przed wgraniem system automatycznie wykona bezpieczną kopię ratunkową obecnego stanu.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={handleImportHistoricalPackage}
                    disabled={isProcessingPackage}
                    className="px-4 py-2 rounded-xl bg-[#006241] hover:bg-[#004f34] text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isProcessingPackage ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <DownloadCloud className="w-3.5 h-3.5" />
                    )}
                    <span>{isProcessingPackage ? 'Wgrywanie paczki...' : 'Wgraj Paczkę Historyczną'}</span>
                  </button>
                  <button
                    onClick={() => setConfirmHistoricalImport(false)}
                    disabled={isProcessingPackage}
                    className="px-3.5 py-2 rounded-xl bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 text-xs font-semibold cursor-pointer"
                  >
                    Anuluj
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DIALOG POTWIERDZENIA CLEAN SLATE (CZYSTA WERSJA STARTOWA) */}
        {confirmCleanSlate && (
          <div className="mx-6 mt-4 p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 shadow-sm animate-in fade-in">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-rose-200 text-rose-900 shrink-0 mt-0.5">
                <Trash2 className="w-5 h-5 text-rose-700" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-black text-rose-950">
                  Przywrócenie Czystej Wersji Startowej (Clean Slate)
                </h3>
                <p className="text-xs text-rose-900 mt-1 leading-relaxed">
                  Czy na pewno chcesz wyczyścić wszystkie dane operacyjne (grafiki, zespół, logowania MAPAL, szkolenia)?
                  <br />
                  <strong>Zachowane zostaną nienaruszalne fundamenty</strong> (katalog 25 kodów zmian Starbucks, 252 miesiące norm Kodeksu Pracy 2016–2036, kalendarz tygodni biznesowych i reguły floor/NC).
                </p>
                <p className="text-[11px] text-rose-800 font-semibold mt-2 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                  Przed wyczyszczeniem system automatycznie utworzy kopię ratunkową w backups/db_backups/.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={handleCleanSlateReset}
                    disabled={isProcessingPackage}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isProcessingPackage ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    <span>{isProcessingPackage ? 'Czyszczenie bazy...' : 'Tak, wyczyść do wersji startowej'}</span>
                  </button>
                  <button
                    onClick={() => setConfirmCleanSlate(false)}
                    disabled={isProcessingPackage}
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
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
          
          {/* CENTRUM DANYCH & PACZEK HISTORYCZNYCH (CLEAN SLATE & IMPORT HUB) */}
          <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-xs font-black tracking-wider uppercase text-[#1E3932] flex items-center gap-1.5">
                  <FolderArchive className="w-4 h-4 text-[#006241]" />
                  Centrum Paczek Danych & Instalacji (Folder ./IMPORT)
                </h3>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Zarządzaj kompletną paczką danych lub zresetuj aplikację do czystego stanu instalacyjnego.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Eksport paczki do IMPORT */}
              <div className="bg-white p-3 rounded-xl border border-stone-200 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-bold text-stone-800 flex items-center gap-1.5 mb-1">
                    <UploadCloud className="w-3.5 h-3.5 text-blue-600" />
                    Eksport do ./IMPORT/
                  </div>
                  <p className="text-[10px] text-stone-500">
                    Wyeksportuj 17 tabel i bazę master do folderu IMPORT.
                  </p>
                </div>
                <button
                  onClick={handleExportPackage}
                  disabled={isProcessingPackage}
                  className="mt-3 w-full py-1.5 px-2.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {isProcessingPackage ? <RefreshCw className="w-3 h-3 animate-spin" /> : <UploadCloud className="w-3 h-3" />}
                  <span>Eksportuj Paczkę</span>
                </button>
              </div>

              {/* Import paczki z IMPORT */}
              <div className="bg-white p-3 rounded-xl border border-stone-200 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-bold text-stone-800 flex items-center gap-1.5 mb-1">
                    <DownloadCloud className="w-3.5 h-3.5 text-emerald-600" />
                    Wgraj z ./IMPORT/
                  </div>
                  <p className="text-[10px] text-stone-500">
                    Wgraj pełną historię: AOP 2021–2036, MAPAL i 9 mies. grafików.
                  </p>
                </div>
                <button
                  onClick={() => setConfirmHistoricalImport(true)}
                  disabled={isProcessingPackage}
                  className="mt-3 w-full py-1.5 px-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#006241] border border-emerald-300 text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {isProcessingPackage ? <RefreshCw className="w-3 h-3 animate-spin" /> : <DownloadCloud className="w-3 h-3" />}
                  <span>Wgraj Historię</span>
                </button>
              </div>

              {/* Czysta Wersja Startowa */}
              <div className="bg-white p-3 rounded-xl border border-rose-200/80 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-bold text-rose-900 flex items-center gap-1.5 mb-1">
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    Wersja Startowa
                  </div>
                  <p className="text-[10px] text-stone-500">
                    Wyczyść dane operacyjne (Clean Slate) z zachowaniem norm KP.
                  </p>
                </div>
                <button
                  onClick={() => setConfirmCleanSlate(true)}
                  disabled={isProcessingPackage}
                  className="mt-3 w-full py-1.5 px-2.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {isProcessingPackage ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  <span>Clean Slate (Wyczyść)</span>
                </button>
              </div>
            </div>
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
                  <span>Rozmiar: <strong className="text-stone-800">{formatFileSize(dbStatus?.sizeBytes || 0)}</strong></span>
                  <span>•</span>
                  <span>Modyfikacja: <strong className="text-stone-800">{dbStatus?.lastModified || 'Brak danych'}</strong></span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#E2E8E5] flex items-center justify-between text-[11px] text-[#5C6F68]">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#006241]" />
                  Rotacja: zachowywane ostatnich <strong>15 kopii</strong>
                </span>
                <span className="font-bold text-[#1E3932]">
                  Liczba kopii: {backups.length}
                </span>
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
                {isCreating ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Database className="w-3.5 h-3.5" />
                )}
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
                            onClick={() => setConfirmRestoreFile(b.filename)}
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
            <span>Kopie są zapisywane lokalnie w katalogu: <code className="font-mono font-bold text-stone-700">backups/db_backups/</code></span>
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
