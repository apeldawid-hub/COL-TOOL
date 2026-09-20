import React, { useState, useEffect, useCallback } from 'react';
import { 
  TrainingPartner, 
  TrainingShift, 
  TrainingSkillCheck 
} from '../types';
import { TrainingEngine } from '../services/trainingEngine';
import { TrainingStatsCard } from './TrainingStatsCard';
import { TrainingShiftsSchedule } from './TrainingShiftsSchedule';
import { DigitalSkillCheckModal } from './DigitalSkillCheckModal';
import { PartnerEditModal } from './PartnerEditModal';
import { PartnerJourneyTracker } from './PartnerJourneyTracker';
import { 
  GraduationCap, 
  Plus, 
  Award, 
  RefreshCw, 
  Calendar, 
  Compass, 
  BookOpen, 
  UserCheck, 
  CheckCircle2, 
  AlertCircle,
  Coffee,
  Clock,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';

interface TrainingsViewProps {
  selectedYear: number;
  selectedMonth: number; // 1-12
}

export const TrainingsView: React.FC<TrainingsViewProps> = ({
  selectedYear,
  selectedMonth
}) => {
  const [partners, setPartners] = useState<TrainingPartner[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null);
  const [shifts, setShifts] = useState<TrainingShift[]>([]);
  const [allShifts, setAllShifts] = useState<TrainingShift[]>([]);
  const [skillChecks, setSkillChecks] = useState<TrainingSkillCheck[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Tab State: 'shifts' | 'journey' | 'exams' | 'standards'
  const [activeTab, setActiveTab] = useState<'shifts' | 'journey' | 'exams' | 'standards'>('shifts');

  // Modale
  const [isSkillCheckModalOpen, setIsSkillCheckModalOpen] = useState(false);
  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<TrainingPartner | null>(null);

  // Pobieranie danych z bazy SQLite
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      if ((window as any).api?.getTrainingPartners) {
        const fetchedPartners: TrainingPartner[] = await (window as any).api.getTrainingPartners();
        setPartners(fetchedPartners);

        // Ustal wybranego partnera
        const currentSelected = selectedPartnerId 
          ? fetchedPartners.find(p => p.id === selectedPartnerId) 
          : fetchedPartners[0];

        const targetId = currentSelected ? currentSelected.id : (fetchedPartners[0]?.id || null);
        setSelectedPartnerId(targetId);

        // Pobierz wszystkie zmiany i zmiany per partner
        if ((window as any).api?.getTrainingShifts) {
          const allS: TrainingShift[] = await (window as any).api.getTrainingShifts();
          setAllShifts(allS);
          if (targetId) {
            const partnerS: TrainingShift[] = await (window as any).api.getTrainingShifts(targetId);
            setShifts(partnerS);
          }
        }

        // Pobierz egzaminy
        if ((window as any).api?.getTrainingSkillChecks) {
          const checks: TrainingSkillCheck[] = await (window as any).api.getTrainingSkillChecks();
          setSkillChecks(checks);
        }
      }
    } catch (err) {
      console.error('Błąd wczytywania danych modułu szkoleń:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedPartnerId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Przełączanie partnera
  const handleSelectPartner = async (id: number) => {
    setSelectedPartnerId(id);
    if ((window as any).api?.getTrainingShifts) {
      const partnerS: TrainingShift[] = await (window as any).api.getTrainingShifts(id);
      setShifts(partnerS);
    }
  };

  // Generowanie standardowych Zmian T dla wybranego partnera
  const handleGenerateDefaultShifts = async () => {
    const p = partners.find(item => item.id === selectedPartnerId);
    if (!p) return;

    const defaultShifts = TrainingEngine.generateDefaultShiftsForPartner(
      p.id,
      p.hire_date,
      p.current_program,
      p.assigned_trainer_name
    );

    if ((window as any).api?.saveTrainingShiftsBatch) {
      await (window as any).api.saveTrainingShiftsBatch(p.id, defaultShifts);
      await loadData();
    }
  };

  // Aktualizacja pojedynczej zmiany
  const handleUpdateShift = async (shift: TrainingShift) => {
    if ((window as any).api?.updateTrainingShift) {
      await (window as any).api.updateTrainingShift(shift);
      await loadData();
    }
  };

  // Zapis / edycja partnera
  const handleSavePartner = async (partnerData: Partial<TrainingPartner>) => {
    if ((window as any).api?.saveTrainingPartner) {
      const newId = await (window as any).api.saveTrainingPartner(partnerData);
      // Jeśli nowy partner, od razu wygeneruj dla niego zmiany T
      if (!partnerData.id && newId && partnerData.hire_date) {
        const defaultShifts = TrainingEngine.generateDefaultShiftsForPartner(
          newId,
          partnerData.hire_date,
          partnerData.current_program || 'first_30',
          partnerData.assigned_trainer_name
        );
        if ((window as any).api?.saveTrainingShiftsBatch) {
          await (window as any).api.saveTrainingShiftsBatch(newId, defaultShifts);
        }
      }
      await loadData();
    }
  };

  // Usunięcie partnera
  const handleDeletePartner = async (id: number) => {
    if ((window as any).api?.deleteTrainingPartner) {
      await (window as any).api.deleteTrainingPartner(id);
      setSelectedPartnerId(null);
      await loadData();
    }
  };

  // Zapis egzaminu Skill Check
  const handleSaveSkillCheck = async (checkData: Partial<TrainingSkillCheck>) => {
    if ((window as any).api?.saveTrainingSkillCheck) {
      await (window as any).api.saveTrainingSkillCheck(checkData);
      await loadData();
    }
  };

  const selectedPartner = partners.find(p => p.id === selectedPartnerId) || partners[0] || null;

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Nagłówek Modułu Szkoleń */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-800 text-white flex items-center justify-center shadow-md">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-stone-900 tracking-tight">
                Starbucks Training Suite — Moduł Szkoleniowy
              </h2>
              <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full border border-emerald-300">
                108120 Janki
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Program First 30, Zmiany T (Non-Coverage), standardy Starbucks i cyfrowe arkusze egzaminacyjne Skill Check.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditingPartner(null);
              setIsPartnerModalOpen(true);
            }}
            className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            Nowy Barista / Partner
          </button>

          <button
            onClick={() => setIsSkillCheckModalOpen(true)}
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
          >
            <Award className="w-4 h-4" />
            Przeprowadź Skill Check
          </button>

          <button
            onClick={loadData}
            className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-xl transition-colors"
            title="Odśwież dane"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Kafelki Podsumowania i KPI */}
      <TrainingStatsCard
        partners={partners}
        allShifts={allShifts}
        skillChecks={skillChecks}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
      />

      {/* 3. Selektor Partnerów w Pigułkach */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold text-stone-500 uppercase tracking-wider">
            Aktywny Zespół w Szkoleniu ({partners.length})
          </div>
          {selectedPartner && (
            <button
              onClick={() => {
                setEditingPartner(selectedPartner);
                setIsPartnerModalOpen(true);
              }}
              className="text-xs text-emerald-800 hover:text-emerald-950 font-semibold flex items-center gap-1"
            >
              Edytuj profil partnera
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {partners.map(p => {
            const isSelected = p.id === selectedPartnerId;
            const badge = TrainingEngine.getPartnerStatusBadge(p.status);

            return (
              <button
                key={p.id}
                onClick={() => handleSelectPartner(p.id)}
                className={`px-3 py-2 rounded-xl border text-xs font-medium transition-all flex items-center gap-2 cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                    : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                  isSelected ? 'bg-white text-emerald-900' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {p.name.charAt(0)}
                </div>
                <span>{p.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded border ${
                  isSelected ? 'bg-emerald-900 text-emerald-100 border-emerald-700' : badge.bg
                }`}>
                  {badge.text}
                </span>
              </button>
            );
          })}
        </div>

        {/* Pasek szczegółów wybranego partnera */}
        {selectedPartner && (
          <div className="mt-4 pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-600 bg-stone-50/50 p-2.5 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-stone-900 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-stone-400" />
                Data startu: {selectedPartner.hire_date}
              </span>
              <span>•</span>
              <span>Program: <b>{TrainingEngine.getProgramLabel(selectedPartner.current_program)}</b></span>
              <span>•</span>
              <span>Trener: <b>{selectedPartner.assigned_trainer_name || 'Brak'}</b></span>
              <span>•</span>
              <span>Opiekun SM: <b>{selectedPartner.store_manager_name}</b></span>
            </div>

            <div className="flex items-center gap-2">
              {selectedPartner.sanepid_valid_until && (
                <span className="flex items-center gap-1 text-[11px] bg-white px-2 py-0.5 rounded border border-stone-200 text-stone-700">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Sanepid do: <b>{selectedPartner.sanepid_valid_until}</b>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4. Nawigacja Zakładkami */}
      <div className="flex border-b border-stone-200 gap-6 text-xs font-bold">
        <button
          onClick={() => setActiveTab('shifts')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'shifts'
              ? 'border-emerald-800 text-emerald-900'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Harmonogram Zmian T (T1–T10)
        </button>

        <button
          onClick={() => setActiveTab('journey')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'journey'
              ? 'border-emerald-800 text-emerald-900'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Compass className="w-4 h-4" />
          Oś Czasu (The Barista Journey)
        </button>

        <button
          onClick={() => setActiveTab('exams')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'exams'
              ? 'border-emerald-800 text-emerald-900'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Award className="w-4 h-4" />
          Rejestr Skill Check ({skillChecks.length})
        </button>

        <button
          onClick={() => setActiveTab('standards')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'standards'
              ? 'border-emerald-800 text-emerald-900'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Baza Standardów & Podręcznik Starbucks
        </button>
      </div>

      {/* 5. Zawartość Aktywnej Zakładki */}
      {selectedPartner ? (
        <>
          {activeTab === 'shifts' && (
            <TrainingShiftsSchedule
              partner={selectedPartner}
              shifts={shifts}
              onUpdateShift={handleUpdateShift}
              onGenerateDefaultShifts={handleGenerateDefaultShifts}
            />
          )}

          {activeTab === 'journey' && (
            <PartnerJourneyTracker partner={selectedPartner} />
          )}

          {activeTab === 'exams' && (
            <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
              <div className="p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
                <div>
                  <h3 className="text-base font-bold text-stone-900">
                    Rejestr Egzaminów i Weryfikacji Praktycznych Skill Check
                  </h3>
                  <p className="text-xs text-stone-500 mt-1">
                    Archiwum ocen, zdawalności i certyfikacji baristów kawiarni 108120 Janki.
                  </p>
                </div>
                <button
                  onClick={() => setIsSkillCheckModalOpen(true)}
                  className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nowa Ocena
                </button>
              </div>

              {skillChecks.length === 0 ? (
                <div className="p-8 text-center text-xs text-stone-500">
                  Brak zarejestrowanych egzaminów. Kliknij przycisk powyżej, aby przeprowadzić pierwszy Skill Check.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-stone-200 bg-stone-100/75 text-stone-600 font-bold uppercase tracking-wider text-[11px]">
                        <th className="py-2.5 px-4">Kandydat / Partner</th>
                        <th className="py-2.5 px-4">Typ Egzaminu</th>
                        <th className="py-2.5 px-3">Data</th>
                        <th className="py-2.5 px-4">Egzaminator</th>
                        <th className="py-2.5 px-3 text-center">Wynik</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4">Uwagi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {skillChecks.map(sc => {
                        const candidate = partners.find(p => p.id === sc.partner_id);
                        return (
                          <tr key={sc.id} className="hover:bg-stone-50">
                            <td className="py-3 px-4 font-semibold text-stone-900">
                              {candidate ? candidate.name : `Partner #${sc.partner_id}`}
                            </td>
                            <td className="py-3 px-4 font-medium text-stone-800">
                              {sc.check_type === 'milk_steaming' && 'Milk Steaming Routine'}
                              {sc.check_type === 'espresso_bar' && 'Espresso Bar Skill Check #1'}
                              {sc.check_type === 'cold_beverage' && 'Cold Beverage Skill Check #2'}
                              {sc.check_type === 'teaching_model' && 'Teaching Model (Trener)'}
                              {sc.check_type === 'completion_check' && 'Certyfikacja First 30'}
                            </td>
                            <td className="py-3 px-3 font-mono text-stone-600">
                              {sc.exam_date}
                            </td>
                            <td className="py-3 px-4 text-stone-700">
                              {sc.examiner_name} ({sc.examiner_role})
                            </td>
                            <td className="py-3 px-3 text-center font-bold text-stone-900">
                              {sc.score_pct}%
                            </td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${
                                sc.is_passed
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-red-50 text-red-800 border-red-200'
                              }`}>
                                {sc.is_passed ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <AlertCircle className="w-3.5 h-3.5 text-red-600" />}
                                {sc.is_passed ? 'ZALICZONE' : 'DO POPRAWY'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-stone-500 truncate max-w-xs" title={sc.notes || ''}>
                              {sc.notes || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'standards' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Sekcja 1: Rutyna spieniania mleka (Milk Steaming) */}
              <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs space-y-3">
                <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
                  <Coffee className="w-5 h-5 text-emerald-700" />
                  <h4 className="font-bold text-sm text-stone-900">
                    Rutyna Spieniania Mleka (Milk Steaming Routine)
                  </h4>
                </div>
                <div className="space-y-2.5 text-xs text-stone-700">
                  <div className="p-2.5 bg-stone-50 rounded-lg border border-stone-200/60">
                    <b>1. Wlewanie świeżego mleka:</b> Odmierzenie odpowiedniej ilości z lodówki do kreski w dzbanku bez marnotrawstwa.
                  </div>
                  <div className="p-2.5 bg-stone-50 rounded-lg border border-stone-200/60">
                    <b>2. Napowietrzanie (Aeration):</b> Końcówka dyszy tuż pod powierzchnią. 1–3 sekundy dla Latte/Flat White, 6–8 sekund dla Cappuccino.
                  </div>
                  <div className="p-2.5 bg-stone-50 rounded-lg border border-stone-200/60">
                    <b>3. Tworzenie wiru (Vortex):</b> Oparcie dzbanka pod kątem, wytworzenie wiru bez dużych pęcherzy powietrza do temperatury ok. 65°C.
                  </div>
                  <div className="p-2.5 bg-stone-50 rounded-lg border border-stone-200/60">
                    <b>4. Dezynfekcja dyszy:</b> Natychmiastowe przetarcie ściereczką barową i przedmuchanie (purge) przez 2 sekundy.
                  </div>
                  <div className="p-2.5 bg-stone-50 rounded-lg border border-stone-200/60">
                    <b>5. Polerowanie mleka:</b> Stuknięcie dzbankiem o blat i delikatne wirowanie do uzyskania konsystencji lśniącej tafli mokrej farby.
                  </div>
                </div>
              </div>

              {/* Sekcja 2: 4-etapowy Model Nauczania (Barista Trener) */}
              <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs space-y-3">
                <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
                  <GraduationCap className="w-5 h-5 text-amber-700" />
                  <h4 className="font-bold text-sm text-stone-900">
                    Model Nauczania Starbucks (Teaching Model)
                  </h4>
                </div>
                <div className="space-y-2.5 text-xs text-stone-700">
                  <div className="p-2.5 bg-amber-50/50 rounded-lg border border-amber-200/60">
                    <b>1. Przygotowanie (Prepare):</b> Przygotowanie stanowiska, materiałów, budowanie przyjaznej atmosfery i wyjaśnienie celu lekcji.
                  </div>
                  <div className="p-2.5 bg-amber-50/50 rounded-lg border border-amber-200/60">
                    <b>2. Prezentacja (Present):</b> Wzorcowy pokaz czynności przez Trenera z wyjaśnieniem "dlaczego" tak postępujemy.
                  </div>
                  <div className="p-2.5 bg-amber-50/50 rounded-lg border border-amber-200/60">
                    <b>3. Ćwiczenie (Practice):</b> Samodzielna próba nowego baristy pod czujnym okiem trenera, dająca przestrzeń na naukę na błędach.
                  </div>
                  <div className="p-2.5 bg-amber-50/50 rounded-lg border border-amber-200/60">
                    <b>4. Follow-up:</b> Konstruktywna informacja zwrotna, pytania sprawdzające i docenienie wysiłku (Green Apron Card).
                  </div>
                </div>
              </div>

              {/* Sekcja 3: Zasady Rozliczania Zmian T (Non-Coverage) */}
              <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs space-y-3 md:col-span-2">
                <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
                  <Clock className="w-5 h-5 text-emerald-800" />
                  <h4 className="font-bold text-sm text-stone-900">
                    Standard Rozliczania Zmian T w Budżecie Operacyjnym (Non-Coverage Training)
                  </h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-stone-700">
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                    <span className="font-bold text-stone-900 block mb-1">Barista w szkoleniu:</span>
                    Otrzymuje w First 30 łącznie <b>38h 45m</b> godzin szkoleniowych (T1–T10). Wszystkie godziny są kodowane jako NC i nie wliczają się do flooru.
                  </div>
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                    <span className="font-bold text-stone-900 block mb-1">Trener Baristów (BT):</span>
                    Dedykowane wsparcie 1:1 w wymiarze <b>14h 15m</b> godzin T (T2, T3, T4, T5, T6, T7, T9, T10). Podczas T8 trener wspiera z regularnej zmiany (Coverage).
                  </div>
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                    <span className="font-bold text-stone-900 block mb-1">Store Manager (SM):</span>
                    Zaangażowanie w wymiarze <b>3h 30m</b> (T1 First Sip 2h, T4 Check-In 0.5h, T6/T7 weryfikacje po 15m, T10 Certyfikacja 0.5h).
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
          <Coffee className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-stone-800">Brak partnerów w bazie szkoleń</h3>
          <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
            Dodaj pierwszego baristę, aby zaplanować cykl wdrożenia First 30 i wygenerować harmonogram Zmian T.
          </p>
          <button
            onClick={() => {
              setEditingPartner(null);
              setIsPartnerModalOpen(true);
            }}
            className="mt-4 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Dodaj Nowego Baristę
          </button>
        </div>
      )}

      {/* Modale */}
      <DigitalSkillCheckModal
        isOpen={isSkillCheckModalOpen}
        onClose={() => setIsSkillCheckModalOpen(false)}
        partners={partners}
        selectedPartnerId={selectedPartnerId || undefined}
        onSaveSkillCheck={handleSaveSkillCheck}
      />

      <PartnerEditModal
        isOpen={isPartnerModalOpen}
        onClose={() => setIsPartnerModalOpen(false)}
        partner={editingPartner}
        onSavePartner={handleSavePartner}
        onDeletePartner={handleDeletePartner}
      />
    </div>
  );
};
