import React, { useState, useEffect } from 'react';
import { TrainingPartner, SkillCheckType, SkillCheckCriterion, TrainingSkillCheck } from '../types';
import { STANDARD_SKILL_CHECKS } from '../services/trainingStandardData';
import { Award, CheckCircle2, XCircle, AlertCircle, Save, X, User, Calendar, Coffee } from 'lucide-react';

interface DigitalSkillCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  partners: TrainingPartner[];
  selectedPartnerId?: number;
  onSaveSkillCheck: (check: Partial<TrainingSkillCheck>) => Promise<void>;
}

export const DigitalSkillCheckModal: React.FC<DigitalSkillCheckModalProps> = ({
  isOpen,
  onClose,
  partners,
  selectedPartnerId,
  onSaveSkillCheck
}) => {
  const [partnerId, setPartnerId] = useState<number>(selectedPartnerId || (partners[0]?.id || 1));
  const [checkType, setCheckType] = useState<SkillCheckType>('milk_steaming');
  const [examDate, setExamDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [examinerName, setExaminerName] = useState<string>('Dawid Apel');
  const [examinerRole, setExaminerRole] = useState<'SM' | 'BT' | 'ASM'>('SM');
  const [criteria, setCriteria] = useState<SkillCheckCriterion[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Zmiana kryteriów po zmianie typu egzaminu
  useEffect(() => {
    const std = STANDARD_SKILL_CHECKS[checkType];
    if (std) {
      setCriteria(std.criteria.map(c => ({ ...c, isPassed: true })));
    }
  }, [checkType]);

  useEffect(() => {
    if (selectedPartnerId) {
      setPartnerId(selectedPartnerId);
    }
  }, [selectedPartnerId]);

  if (!isOpen) return null;

  const handleToggleCriterion = (id: string) => {
    setCriteria(prev => prev.map(c => c.id === id ? { ...c, isPassed: !c.isPassed } : c));
  };

  const handleCriterionNoteChange = (id: string, noteText: string) => {
    setCriteria(prev => prev.map(c => c.id === id ? { ...c, notes: noteText } : c));
  };

  // Wyliczenie wyniku
  const totalCriteria = criteria.length;
  const passedCriteria = criteria.filter(c => c.isPassed).length;
  const scorePct = totalCriteria > 0 ? Math.round((passedCriteria / totalCriteria) * 100) : 100;
  const isPassed = scorePct >= 80;

  const currentStandard = STANDARD_SKILL_CHECKS[checkType];
  const currentPartner = partners.find(p => p.id === partnerId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSaveSkillCheck({
        partner_id: partnerId,
        check_type: checkType,
        exam_date: examDate,
        examiner_name: examinerName,
        examiner_role: examinerRole,
        is_passed: isPassed,
        score_pct: scorePct,
        criteria_results: criteria,
        notes: notes || null
      });
      onClose();
    } catch (err) {
      console.error('Błąd zapisu egzaminu:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-stone-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Nagłówek Modala */}
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center border border-emerald-200">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">
                Cyfrowy Arkusz Egzaminacyjny: {currentStandard?.title}
              </h3>
              <p className="text-xs text-stone-500">
                Oficjalne standardy weryfikacji kompetencji Starbucks First 30
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formularz */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Kontekst Egzaminu (Partner, Typ, Data, Egzaminator) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-stone-50 p-4 rounded-xl border border-stone-200/80 text-xs">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Kandydat / Partner:</label>
              <select
                value={partnerId}
                onChange={(e) => setPartnerId(Number(e.target.value))}
                className="w-full p-2 bg-white border border-stone-300 rounded-lg text-xs font-medium text-stone-800 focus:border-emerald-600 focus:outline-hidden"
              >
                {partners.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.current_program})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Typ Egzaminu / Weryfikacji:</label>
              <select
                value={checkType}
                onChange={(e) => setCheckType(e.target.value as SkillCheckType)}
                className="w-full p-2 bg-white border border-stone-300 rounded-lg text-xs font-medium text-stone-800 focus:border-emerald-600 focus:outline-hidden"
              >
                <option value="milk_steaming">1. Milk Steaming Routine Check</option>
                <option value="espresso_bar">2. Espresso Bar Skill Check #1</option>
                <option value="cold_beverage">3. Cold Beverage Station Skill Check #2</option>
                <option value="teaching_model">4. Teaching Model (Barista Trener)</option>
                <option value="completion_check">5. Certyfikacja First 30 & Zielona Przypinka</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Data Egzaminu:</label>
              <input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="w-full p-2 bg-white border border-stone-300 rounded-lg text-xs font-mono text-stone-800 focus:border-emerald-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Egzaminator & Rola:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={examinerName}
                  onChange={(e) => setExaminerName(e.target.value)}
                  placeholder="Imię i nazwisko"
                  className="flex-1 p-2 bg-white border border-stone-300 rounded-lg text-xs font-medium text-stone-800 focus:border-emerald-600 focus:outline-hidden"
                />
                <select
                  value={examinerRole}
                  onChange={(e) => setExaminerRole(e.target.value as any)}
                  className="w-20 p-2 bg-white border border-stone-300 rounded-lg text-xs font-medium text-stone-800 focus:border-emerald-600 focus:outline-hidden"
                >
                  <option value="SM">SM</option>
                  <option value="ASM">ASM</option>
                  <option value="BT">BT</option>
                </select>
              </div>
            </div>
          </div>

          {/* Podtytuł i standard */}
          <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 flex items-start gap-2.5">
            <Coffee className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-950">
              <span className="font-bold">{currentStandard?.title}:</span> {currentStandard?.subtitle}
            </div>
          </div>

          {/* Lista Kryteriów Egzaminacyjnych */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-stone-600 uppercase tracking-wider px-1">
              <span>Wymagane Standardy Starbucks</span>
              <span>Ocena</span>
            </div>

            {criteria.map((crit, idx) => (
              <div 
                key={crit.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  crit.isPassed
                    ? 'bg-white border-stone-200 hover:border-emerald-300'
                    : 'bg-red-50/30 border-red-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100/60 px-1.5 py-0.5 rounded">
                        {crit.category}
                      </span>
                      <span className="text-xs font-bold text-stone-900">
                        {crit.label}
                      </span>
                    </div>
                    <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                      {crit.description}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleCriterion(crit.id)}
                    className={`shrink-0 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      crit.isPassed
                        ? 'bg-emerald-700 text-white shadow-xs hover:bg-emerald-800'
                        : 'bg-red-600 text-white shadow-xs hover:bg-red-700'
                    }`}
                  >
                    {crit.isPassed ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Zaliczono
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5" />
                        Do poprawy
                      </>
                    )}
                  </button>
                </div>

                {/* Notatka opcjonalna per kryterium */}
                <div className="mt-2 pt-2 border-t border-stone-100">
                  <input
                    type="text"
                    value={crit.notes || ''}
                    onChange={(e) => handleCriterionNoteChange(crit.id, e.target.value)}
                    placeholder="Opcjonalny komentarz lub feedback do tego punktu..."
                    className="w-full text-[11px] p-1.5 bg-stone-50 border border-stone-200 rounded text-stone-700 focus:bg-white focus:outline-hidden"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Podsumowanie wyniku i werdykt */}
          <div className="p-4 rounded-xl border bg-stone-50 flex items-center justify-between">
            <div>
              <div className="text-xs text-stone-500 font-semibold">Wynik weryfikacji:</div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className={`text-2xl font-black ${isPassed ? 'text-emerald-700' : 'text-red-600'}`}>
                  {scorePct}%
                </span>
                <span className="text-xs text-stone-600 font-medium">
                  ({passedCriteria}/{totalCriteria} kryteriów spełnionych)
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border ${
                isPassed
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-red-100 text-red-800 border-red-300'
              }`}>
                {isPassed ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    EGZAMIN ZDANY (Standard Starbucks)
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-red-700" />
                    WYMAGANE POWTÓRZENIE SESJI
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Ogólne uwagi egzaminatora */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Podsumowanie i rekomendacja egzaminatora:
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Wpisz ogólny feedback dla baristy, mocne strony, obszary do pracy..."
              className="w-full text-xs p-2.5 bg-white border border-stone-300 rounded-xl focus:border-emerald-600 focus:outline-hidden"
            />
          </div>
        </form>

        {/* Stopka Modala z przyciskami */}
        <div className="px-6 py-4 border-t border-stone-100 flex items-center justify-between bg-stone-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-stone-100 text-stone-700 border border-stone-300 text-xs font-semibold rounded-xl transition-all"
          >
            Anuluj
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit}
            className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? 'Zapisywanie...' : 'Zatwierdź & Zapisz Arkusz Egzaminacyjny'}
          </button>
        </div>
      </div>
    </div>
  );
};
