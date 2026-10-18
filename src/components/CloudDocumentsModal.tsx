// src/components/CloudDocumentsModal.tsx
import React, { useState, useEffect } from 'react';
import {
  Cloud,
  CloudUpload,
  CloudDownload,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileText,
  Database,
  Lock,
  Layers,
  Sparkles,
  RefreshCw,
  X,
  Eye,
  Check,
  Building,
  Calendar,
  Clock,
  ListChecks,
} from 'lucide-react';
import {
  FirebaseDocsService,
  CloudOperationalDoc,
  CloudDocsSyncResult,
} from '../services/firebaseDocsService';

interface CloudDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CloudDocumentsModal: React.FC<CloudDocumentsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [docs, setDocs] = useState<CloudOperationalDoc[]>(() =>
    FirebaseDocsService.getCachedDocs()
  );
  const [selectedDoc, setSelectedDoc] = useState<CloudOperationalDoc | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [syncResult, setSyncResult] = useState<CloudDocsSyncResult | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDocs(FirebaseDocsService.getCachedDocs());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleExportToFirebase = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const res = await FirebaseDocsService.exportSanitizedDocsToFirebase();
      setSyncResult(res);
      setDocs(FirebaseDocsService.getCachedDocs());
    } catch (e: any) {
      console.error('Błąd eksportu do Firebase:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFetchFromFirebase = async () => {
    setIsFetching(true);
    try {
      const remoteDocs = await FirebaseDocsService.fetchCloudDocs();
      setDocs(remoteDocs);
    } catch (e: any) {
      console.error('Błąd pobierania z Firebase:', e);
    } finally {
      setIsFetching(false);
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'labor_law':
        return <ShieldCheck className="w-4 h-4 text-emerald-600" />;
      case 'shift_templates':
        return <Clock className="w-4 h-4 text-blue-600" />;
      case 'nc_standards':
        return <Layers className="w-4 h-4 text-purple-600" />;
      case 'checklists':
        return <ListChecks className="w-4 h-4 text-amber-600" />;
      case 'stores':
        return <Building className="w-4 h-4 text-rose-600" />;
      default:
        return <FileText className="w-4 h-4 text-stone-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* NAGŁÓWEK */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-[#1E3932] via-[#006241] to-[#0b4834] text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-emerald-200 shadow-inner">
              <Cloud className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-tight">
                  Biblioteka Danych & Dokumentów w Chmurze (Firebase)
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-800 text-emerald-200 border border-emerald-600">
                  Zero Danych Wrażliwych
                </span>
              </div>
              <p className="text-xs text-emerald-100/80 mt-0.5">
                Odciążenie aplikacji: centralne szablony, normy prawne i procedury przechowywane w Firestore bez imion i nazwisk.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-emerald-100 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Zamknij"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BANER BEZPIECZEŃSTWA DANYCH (ZERO PII & ZERO CHRONIONYCH DOKUMENTÓW) */}
        <div className="px-6 py-3 bg-emerald-50/80 border-b border-emerald-200/80 flex items-center justify-between text-xs text-emerald-950 shrink-0">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-[#006241] shrink-0" />
            <span>
              <strong>100% Bezpieczeństwa:</strong> Wszystkie dane wysyłane do Firebase są zanonimizowane — brak danych osobowych (PII), brak imion/nazwisk, brak grafików personalnych oraz brak zastrzeżonych dokumentów wewnętrznych.
            </span>
          </div>

          <div className="flex items-center space-x-2 shrink-0 ml-4">
            <button
              onClick={handleFetchFromFirebase}
              disabled={isFetching}
              className="px-3 py-1.5 bg-white hover:bg-stone-100 border border-emerald-300 text-emerald-800 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              <span>{isFetching ? 'Pobieranie...' : 'Odśwież z Chmury'}</span>
            </button>

            <button
              onClick={handleExportToFirebase}
              disabled={isSyncing}
              className="px-3.5 py-1.5 bg-[#006241] hover:bg-[#00754A] text-white rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
            >
              <CloudUpload className={`w-3.5 h-3.5 ${isSyncing ? 'animate-bounce' : ''}`} />
              <span>{isSyncing ? 'Eksportowanie...' : 'Eksportuj do Firebase'}</span>
            </button>
          </div>
        </div>

        {/* KOMUNIKAT WYNIKU SYNCHRONIZACJI */}
        {syncResult && (
          <div className="px-6 py-2.5 bg-emerald-100/70 border-b border-emerald-300 flex items-center justify-between text-xs text-emerald-900 shrink-0">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>
                Pomyślnie zsynchronizowano <strong>{syncResult.exportedCount}</strong> zanonimizowanych dokumentów z Firebase Firestore (Kolekcja: <code>cloud_operational_docs</code>).
              </span>
            </div>
            <span className="text-[10px] text-emerald-700 font-mono">
              {new Date(syncResult.timestamp).toLocaleTimeString()}
            </span>
          </div>
        )}

        {/* GŁÓWNA ZAWARTOŚĆ */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* LEWA KOLUMNA: LISTA DOKUMENTÓW W CHMURZE */}
          <div className="w-full md:w-1/2 border-r border-stone-200 overflow-y-auto p-4 space-y-2.5 bg-stone-50/50">
            <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1">
              Dostępne Zasoby w Firebase ({docs.length})
            </div>

            {docs.map((doc) => {
              const isSelected = selectedDoc?.id === doc.id;
              return (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDoc(doc)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative group ${
                    isSelected
                      ? 'bg-emerald-50 border-[#006241] ring-2 ring-[#006241]/20 shadow-xs'
                      : 'bg-white hover:bg-stone-50 border-stone-200 shadow-2xs'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-2 bg-stone-100 rounded-xl group-hover:bg-emerald-100 transition-colors">
                        {getCategoryIcon(doc.category)}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-stone-900 group-hover:text-[#006241] transition-colors">
                          {doc.title}
                        </h4>
                        <span className="text-[10px] font-mono text-stone-400">
                          ID: {doc.id}
                        </span>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300 shrink-0">
                      {doc.itemCount} poz.
                    </span>
                  </div>

                  <p className="text-[11px] text-stone-600 mt-2 line-clamp-2">
                    {doc.description}
                  </p>

                  <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-stone-100 text-[10px] text-stone-400">
                    <span className="flex items-center gap-1 text-emerald-700 font-medium">
                      <Check className="w-3 h-3" /> Bez PII & Danych Wrażliwych
                    </span>
                    <span>Aktualizacja: {new Date(doc.lastUpdated).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* PRAWA KOLUMNA: PODGLĄD ZAWARTOŚCI WYBRANEGO DOKUMENTU */}
          <div className="w-full md:w-1/2 overflow-y-auto p-5 bg-white flex flex-col justify-between">
            {selectedDoc ? (
              <div className="space-y-4">
                <div className="border-b border-stone-200 pb-3">
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(selectedDoc.category)}
                    <h3 className="text-sm font-bold text-stone-900">
                      {selectedDoc.title}
                    </h3>
                  </div>
                  <p className="text-xs text-stone-500 mt-1">
                    {selectedDoc.description}
                  </p>
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
                    Struktura Danych w Chmurze (JSON Preview)
                  </span>
                  <div className="p-3 bg-stone-900 text-emerald-400 font-mono text-[11px] rounded-xl overflow-x-auto max-h-72 border border-stone-800">
                    <pre>{JSON.stringify(selectedDoc.data, null, 2)}</pre>
                  </div>
                </div>

                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs space-y-1.5 text-stone-600">
                  <div className="flex justify-between">
                    <span className="text-stone-500">Kolekcja Firebase:</span>
                    <strong className="text-stone-800">cloud_operational_docs</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Identyfikator dokumentu:</span>
                    <strong className="text-stone-800">{selectedDoc.id}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Status PII:</span>
                    <span className="font-bold text-emerald-700 flex items-center gap-1">
                      <Check className="w-3 h-3" /> W 100% Zanonimizowany
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-stone-400">
                <FileText className="w-12 h-12 text-stone-300 mb-2" />
                <p className="text-sm font-bold text-stone-600">Wybierz dokument z listy</p>
                <p className="text-xs text-stone-400 mt-1 max-w-xs">
                  Kliknij dowolny dokument po lewej stronie, aby podejrzeć jego zanonimizowaną strukturę przechowywaną w Firebase.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* STOPKA MODALA */}
        <div className="px-6 py-3.5 bg-stone-100 border-t border-stone-200 flex items-center justify-between text-xs text-stone-600 shrink-0">
          <div className="flex items-center space-x-2">
            <Lock className="w-4 h-4 text-emerald-700" />
            <span className="font-medium">
              Dokumenty operacyjne są pobierane na żądanie przez Firebase REST API, nie obciążając lokalnego instalatora programu.
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-stone-200/70 border border-stone-300 rounded-xl font-bold text-stone-700 transition-colors cursor-pointer"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
};
