import React, { useState, useEffect, useCallback } from 'react';
import { ScheduleVersionRecord, PublicationStatusInfo } from '../../../types';
import { ManagerScheduleEngine } from '../services/managerScheduleEngine';
import {
  History,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Calendar,
  X,
  FileCheck,
  Layers,
  ArrowRight,
  Info
} from 'lucide-react';

interface ScheduleVersionModalProps {
  isOpen: boolean;
  onClose: () => void;
  year: number;
  month: number;
  monthName: string;
  onVersionRestored: () => Promise<void>;
}

export const ScheduleVersionModal: React.FC<ScheduleVersionModalProps> = ({
  isOpen,
  onClose,
  year,
  month,
  monthName,
  onVersionRestored
}) => {
  const [versions, setVersions] = useState<ScheduleVersionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [restoringId, setRestoringId] = useState<number | null>(null);

  const [newVersionTitle, setNewVersionTitle] = useState('');
  const [newVersionDesc, setNewVersionDesc] = useState('');
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Status publikacji grafiku (reguła 7 dni)
  const publicationStatus: PublicationStatusInfo = ManagerScheduleEngine.getPublicationStatus(year, month);

  // Pobranie listy wersji z SQLite
  const loadVersions = useCallback(async () => {
    try {
      setIsLoading(true);
      if ((window as any).api?.getScheduleVersions) {
        const res = await (window as any).api.getScheduleVersions(year, month);
        setVersions(res || []);
      }
    } catch (err) {
      console.error('Błąd pobierania historii wersji:', err);
    } finally {
      setIsLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    if (isOpen) {
      loadVersions();
      setActionMessage(null);
      setNewVersionTitle('');
      setNewVersionDesc('');
    }
  }, [isOpen, loadVersions]);

  // Zapisanie bieżącego stanu jako nowej wersji
  const handleCreateSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersionTitle.trim()) return;

    try {
      setIsSaving(true);
      if ((window as any).api?.saveScheduleVersion) {
        const payload = {
          year,
          month,
          title: newVersionTitle.trim(),
          description: newVersionDesc.trim(),
          version_type: publicationStatus.isPublished ? 'post_publication_edit' : 'draft',
          is_published: publicationStatus.isPublished ? 1 : 0
        };

        await (window as any).api.saveScheduleVersion(payload);
        setNewVersionTitle('');
        setNewVersionDesc('');
        setActionMessage({
          text: publicationStatus.isPublished
            ? 'Zapisano korektę po publikacji grafiku.'
            : 'Pomyślnie zapisano nowy punkt przywracania wersji roboczej.',
          type: 'success'
        });
        await loadVersions();
      }
    } catch (err: any) {
      setActionMessage({ text: err?.message || 'Błąd zapisu wersji.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  // Przywrócenie wersji
  const handleRestoreVersion = async (version: ScheduleVersionRecord) => {
    // Blokada cofania po publikacji zgodnie z regułą 7 dni
    if (publicationStatus.isPublished && version.version_type === 'draft') {
      setActionMessage({
        text: 'Niedozwolone: Zgodnie z art. 129 § 3 Kodeksu Pracy grafik na 7 dni przed wejściem w życie został opublikowany. Wcześniejsze wersje robocze zostały zamrożone i nie można ich przywrócić.',
        type: 'error'
      });
      return;
    }

    const confirmMsg = `Czy na pewno chcesz przywrócić "${version.title}" (wersja v${version.version_num})? Bieżący stan siatki grafiku zostanie nadpisany tym snapshotem.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setRestoringId(version.id);
      if ((window as any).api?.restoreScheduleVersion) {
        await (window as any).api.restoreScheduleVersion(version.id);
        setActionMessage({
          text: `Pomyślnie przywrócono stan z "${version.title}".`,
          type: 'success'
        });
        await onVersionRestored();
        await loadVersions();
      }
    } catch (err: any) {
      setActionMessage({ text: err?.message || 'Błąd przywracania wersji.', type: 'error' });
    } finally {
      setRestoringId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-[#E2E8E5] w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* NAGŁÓWEK OKNA */}
        <div className="bg-[#1E3932] text-white px-6 py-5 flex items-center justify-between border-b border-emerald-950">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/10 rounded-2xl">
              <History className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider font-semibold text-emerald-300 flex items-center gap-2">
                <span>Historia Wersji & Publikacja • {monthName} {year}</span>
              </div>
              <h2 className="text-xl font-black tracking-tight text-white mt-0.5">
                Rejestr Wersji Grafiku Managerskiego
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-stone-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* BANER STATUSU PUBLIKACJI (REGUŁA 7 DNI - ART. 129 § 3 KP) */}
          <div className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
            publicationStatus.isPublished
              ? 'bg-amber-50/80 border-amber-300 text-amber-950'
              : 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
          }`}>
            <div className={`p-2.5 rounded-xl flex-shrink-0 ${
              publicationStatus.isPublished ? 'bg-amber-200 text-amber-900' : 'bg-emerald-200 text-emerald-900'
            }`}>
              {publicationStatus.isPublished ? (
                <Lock className="w-5 h-5" />
              ) : (
                <Clock className="w-5 h-5" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-black text-sm uppercase tracking-wide">
                  {publicationStatus.statusLabel}
                </span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase ${
                  publicationStatus.isPublished
                    ? 'bg-amber-200 text-amber-900 border border-amber-300'
                    : 'bg-emerald-200 text-emerald-900 border border-emerald-300'
                }`}>
                  {publicationStatus.isPublished ? 'Zamrożony (Oficjalny)' : 'Planowanie'}
                </span>
              </div>
              <p className="text-xs mt-1 leading-relaxed opacity-90">
                {publicationStatus.statusDescription}
              </p>
              <div className="mt-2 text-[11px] font-semibold flex items-center gap-3 pt-2 border-t border-black/10">
                <span>Start grafiku: <strong>{publicationStatus.firstDayOfSchedule}</strong></span>
                <span>•</span>
                <span>Termin publikacji (-7 dni): <strong>{publicationStatus.publicationCutoffDate}</strong></span>
              </div>
            </div>
          </div>

          {/* POWIADOMIENIE O AKCJI */}
          {actionMessage && (
            <div className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
              actionMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                : 'bg-rose-50 text-rose-900 border-rose-300'
            }`}>
              {actionMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              )}
              <span>{actionMessage.text}</span>
            </div>
          )}

          {/* FORMULARZ ZAPISU NOWEGO PUNKTU PRZYWRACANIA / WERSJI */}
          <form onSubmit={handleCreateSnapshot} className="bg-stone-50 rounded-2xl p-4.5 border border-stone-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                <Save className="w-4 h-4 text-[#006241]" />
                <span>Zapisz bieżący stan jako wersję</span>
              </span>
              <span className="text-[11px] text-stone-500">
                {publicationStatus.isPublished ? 'Zapisze się jako modyfikacja po publikacji' : 'Utworzy punkt przywracania roboczego'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                value={newVersionTitle}
                onChange={e => setNewVersionTitle(e.target.value)}
                placeholder="Nazwa wersji (np. Po spotkaniu ze Store Managerem)"
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#006241]/30 font-medium"
                required
              />
              <input
                type="text"
                value={newVersionDesc}
                onChange={e => setNewVersionDesc(e.target.value)}
                placeholder="Notatka / uzasadnienie modyfikacji (opcjonalnie)"
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#006241]/30"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSaving || !newVersionTitle.trim()}
                className="px-4 py-2 rounded-xl bg-[#006241] hover:bg-[#00754A] active:scale-95 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Zapisywanie...' : 'Zapisz Migawkę Wersji'}</span>
              </button>
            </div>
          </form>

          {/* LISTA ZAREJESTROWANYCH WERSJI */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-600 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-stone-500" />
                <span>Zarejestrowane Wersje Grafiku ({versions.length})</span>
              </h3>
              {isLoading && <span className="text-xs text-stone-400 animate-pulse">Ładowanie historii...</span>}
            </div>

            {versions.length === 0 ? (
              <div className="p-8 text-center bg-stone-50 rounded-2xl border border-dashed border-stone-300 text-stone-500 text-xs">
                Brak zapisanych wersji dla tego miesiąca. Użyj powyższego formularza, aby zapisać pierwszy punkt kontrolny.
              </div>
            ) : (
              <div className="space-y-2.5">
                {versions.map(v => {
                  const isRestoring = restoringId === v.id;
                  const isDraft = v.version_type === 'draft';
                  const isOfficial = v.version_type === 'published';
                  const isPostEdit = v.version_type === 'post_publication_edit';

                  // Cofanie zablokowane po wejściu w życie grafiku
                  const isRestoreBlocked = publicationStatus.isPublished && isDraft;

                  return (
                    <div
                      key={v.id}
                      className={`p-3.5 rounded-2xl border transition-all flex flex-wrap items-center justify-between gap-3 ${
                        isOfficial
                          ? 'bg-purple-50/70 border-purple-200'
                          : isPostEdit
                          ? 'bg-amber-50/60 border-amber-200'
                          : 'bg-white border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-[240px]">
                        <div className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 mt-0.5 ${
                          isOfficial
                            ? 'bg-purple-200 text-purple-900 border border-purple-300'
                            : isPostEdit
                            ? 'bg-amber-200 text-amber-900 border border-amber-300'
                            : 'bg-stone-200 text-stone-700'
                        }`}>
                          {isOfficial && <Lock className="w-3 h-3" />}
                          {isPostEdit && <FileCheck className="w-3 h-3" />}
                          <span>v{v.version_num} • {isOfficial ? 'OPUBLIKOWANY' : isPostEdit ? 'KOREKTA' : 'DRAFT'}</span>
                        </div>

                        <div>
                          <div className="text-xs font-bold text-[#1E3932]">
                            {v.title}
                          </div>
                          {v.description && (
                            <div className="text-[11px] text-stone-600 mt-0.5">
                              {v.description}
                            </div>
                          )}
                          <div className="text-[10px] text-stone-400 mt-1 flex items-center gap-2">
                            <span>Utworzono: {v.created_at}</span>
                          </div>
                        </div>
                      </div>

                      {/* Akcja przywrócenia */}
                      <div>
                        {isRestoreBlocked ? (
                          <div
                            className="px-3 py-1.5 rounded-xl bg-stone-100 text-stone-400 text-[11px] font-medium border border-stone-200 cursor-not-allowed flex items-center gap-1.5"
                            title="Przywracanie starszych draftów jest zablokowane na 7 dni przed rozpoczęciem miesiąca (art. 129 § 3 KP). Obowiązuje wersja opublikowana."
                          >
                            <Lock className="w-3 h-3" />
                            <span>Zablokowane (Opublikowano)</span>
                          </div>
                        ) : isPostEdit ? (
                          <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-200">
                            Wpis w audycie
                          </span>
                        ) : (
                          <button
                            onClick={() => handleRestoreVersion(v)}
                            disabled={isRestoring}
                            className="px-3 py-1.5 rounded-xl border border-[#006241] text-[#006241] hover:bg-emerald-50 active:scale-95 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                            title="Przywróć ten zapis grafiku"
                          >
                            <RotateCcw className={`w-3.5 h-3.5 ${isRestoring ? 'animate-spin' : ''}`} />
                            <span>{isRestoring ? 'Przywracanie...' : 'Przywróć wersję'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* STOPKA */}
        <div className="p-4 bg-[#F7F9F8] border-t border-[#E2E8E5] flex items-center justify-between text-xs text-stone-500">
          <div className="flex items-center gap-1.5">
            <Info className="w-4 h-4 text-[#006241]" />
            <span>Kodeks Pracy: Grafik podany pracownikom na 7 dni przed startem jest wiążący (art. 129 § 3 KP).</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 font-semibold text-stone-800 text-xs transition-colors cursor-pointer"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
};
