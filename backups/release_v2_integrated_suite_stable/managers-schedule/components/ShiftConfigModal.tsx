import React, { useState } from 'react';
import { ShiftDefinition } from '../../../types';
import {
  X,
  Plus,
  Trash2,
  Check,
  Clock,
  Sun,
  Briefcase,
  CalendarOff,
  Sliders,
  AlertCircle
} from 'lucide-react';

interface ShiftConfigModalProps {
  shifts: ShiftDefinition[];
  onSave: (shifts: ShiftDefinition[]) => Promise<void>;
  onDelete?: (code: string) => Promise<void>;
  onClose: () => void;
}

export const ShiftConfigModal: React.FC<ShiftConfigModalProps> = ({
  shifts: initialShifts,
  onSave,
  onDelete,
  onClose
}) => {
  const [shifts, setShifts] = useState<ShiftDefinition[]>(
    JSON.parse(JSON.stringify(initialShifts))
  );
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Dodawanie nowej zmiany
  const handleAddShift = () => {
    const newShift: ShiftDefinition = {
      code: `Z${shifts.length + 1}`,
      name: 'Nowa Zmiana',
      start_time: '08:00',
      end_time: '16:00',
      hours: 8.0,
      is_nc: 0,
      is_absence: 0,
      category: 'coverage',
      is_sunday_only: 0,
      color_bg: 'bg-emerald-100 text-emerald-800 border-emerald-300'
    };
    setShifts([...shifts, newShift]);
  };

  const handleUpdate = (index: number, field: keyof ShiftDefinition, value: any) => {
    const updated = [...shifts];
    const shift = { ...updated[index], [field]: value };

    // Jeżeli zmieniono nazwę i zawiera "niedziela" -> automatycznie oznacz jako tylko w niedziele
    if (field === 'name' && typeof value === 'string') {
      if (value.toLowerCase().includes('niedziel')) {
        shift.is_sunday_only = 1;
      }
    }

    // Automatyczna synchronizacja flag is_nc i is_absence w zależności od kategorii
    if (field === 'category') {
      if (value === 'nc') {
        shift.is_nc = 1;
        shift.is_absence = 0;
      } else if (value === 'absence') {
        shift.is_nc = 0;
        shift.is_absence = 1;
      } else {
        shift.is_nc = 0;
        shift.is_absence = 0;
      }
    }

    // Jeśli zmieniono godziny start i end, spróbuj wyliczyć sugerowane godziny
    if (field === 'start_time' || field === 'end_time') {
      const startParts = (field === 'start_time' ? value : shift.start_time).split(':');
      const endParts = (field === 'end_time' ? value : shift.end_time).split(':');
      if (startParts.length === 2 && endParts.length === 2) {
        const startH = parseInt(startParts[0], 10) + parseInt(startParts[1], 10) / 60;
        const endH = parseInt(endParts[0], 10) + parseInt(endParts[1], 10) / 60;
        if (!isNaN(startH) && !isNaN(endH) && endH > startH) {
          shift.hours = Math.round((endH - startH) * 10) / 10;
        }
      }
    }

    updated[index] = shift;
    setShifts(updated);
  };

  const handleDelete = async (index: number) => {
    const shiftToDelete = shifts[index];
    if (onDelete && shiftToDelete.code) {
      await onDelete(shiftToDelete.code);
    }
    const updated = shifts.filter((_, i) => i !== index);
    setShifts(updated);
  };

  const handleSubmit = async () => {
    try {
      setIsSaving(true);
      await onSave(shifts);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 800);
    } catch (error) {
      console.error('Błąd zapisu definicji zmian:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredShifts = shifts.filter(s => {
    if (activeCategory === 'ALL') return true;
    if (activeCategory === 'coverage') return s.category === 'coverage' || (!s.is_nc && !s.is_absence && s.category !== 'dispo');
    if (activeCategory === 'nc') return s.is_nc || s.category === 'nc';
    if (activeCategory === 'absence') return s.is_absence || s.category === 'absence';
    if (activeCategory === 'dispo') return s.category === 'dispo';
    if (activeCategory === 'sunday') return s.is_sunday_only || s.name.toLowerCase().includes('niedziel') || ['AMN', 'PMN'].includes(s.code);
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 animate-fade-in">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-[#E2E8E5] w-full max-w-4xl overflow-hidden flex flex-col max-h-[88vh] animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Nagłówek */}
        <div className="bg-[#1E3932] text-white px-6 py-5 flex items-center justify-between border-b border-emerald-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-700/60 text-emerald-300">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                Katalog i Konfiguracja Zmian Starbucks
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-800/80 text-emerald-200 border border-emerald-600 font-medium">
                  {shifts.length} definicji
                </span>
              </h2>
              <p className="text-xs text-stone-300 mt-0.5">
                Konfiguruj godziny, kategorie oraz reguły niedzielne ("Niedziela" = dozwolona tylko w niedzielę)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-stone-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Zakładki kategorii */}
        <div className="px-6 py-3 bg-[#F7F9F8] border-b border-[#E2E8E5] flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setActiveCategory('ALL')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                activeCategory === 'ALL'
                  ? 'bg-[#006241] text-white shadow-xs'
                  : 'text-stone-600 hover:bg-stone-200/60'
              }`}
            >
              Wszystkie ({shifts.length})
            </button>
            <button
              onClick={() => setActiveCategory('coverage')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                activeCategory === 'coverage'
                  ? 'bg-[#006241] text-white shadow-xs'
                  : 'text-stone-600 hover:bg-stone-200/60'
              }`}
            >
              Coverage & Sala
            </button>
            <button
              onClick={() => setActiveCategory('nc')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                activeCategory === 'nc'
                  ? 'bg-purple-800 text-white shadow-xs'
                  : 'text-stone-600 hover:bg-stone-200/60'
              }`}
            >
              Non-Coverage
            </button>
            <button
              onClick={() => setActiveCategory('absence')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                activeCategory === 'absence'
                  ? 'bg-stone-800 text-white shadow-xs'
                  : 'text-stone-600 hover:bg-stone-200/60'
              }`}
            >
              Dni Wolne / Urlopy
            </button>
            <button
              onClick={() => setActiveCategory('sunday')}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 transition-all ${
                activeCategory === 'sunday'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span>Tylko Niedziela</span>
            </button>
          </div>

          <button
            onClick={handleAddShift}
            className="px-3 py-1.5 bg-white border border-[#E2E8E5] hover:border-[#006241] text-stone-700 hover:text-[#006241] rounded-xl font-bold flex items-center gap-1.5 shadow-2xs transition-all"
          >
            <Plus className="w-3.5 h-3.5 text-[#006241]" />
            <span>Dodaj Zmianę</span>
          </button>
        </div>

        {/* Lista zmian */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3 scrollbar-thin">
          {filteredShifts.map(s => {
            // Znajdź indeks w oryginalnej liście
            const index = shifts.findIndex(item => item.code === s.code);
            const isSunday = Boolean(s.is_sunday_only || s.name.toLowerCase().includes('niedziel') || ['AMN', 'PMN'].includes(s.code));

            return (
              <div
                key={s.code}
                className={`p-3.5 rounded-2xl border transition-all flex flex-wrap lg:flex-nowrap items-center gap-3 ${
                  isSunday
                    ? 'bg-amber-50/50 border-amber-200 hover:border-amber-300'
                    : 'bg-[#F7F9F8] border-[#E2E8E5] hover:border-emerald-300'
                }`}
              >
                {/* Kod zmiany */}
                <div className="w-20 shrink-0">
                  <label className="text-[10px] uppercase font-bold text-stone-500 block mb-0.5">
                    Kod
                  </label>
                  <input
                    type="text"
                    value={s.code}
                    onChange={e => handleUpdate(index, 'code', e.target.value.toUpperCase())}
                    className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-black text-[#1E3932] text-center focus:outline-hidden focus:ring-1 focus:ring-[#006241]"
                  />
                </div>

                {/* Nazwa zmiany */}
                <div className="flex-1 min-w-[150px]">
                  <label className="text-[10px] uppercase font-bold text-stone-500 block mb-0.5 flex items-center gap-1">
                    <span>Nazwa Zmiany</span>
                    {isSunday && (
                      <span className="text-[9px] font-black text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded-sm border border-amber-300">
                        NIEDZIELA
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={s.name}
                    onChange={e => handleUpdate(index, 'name', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-bold text-stone-800 focus:outline-hidden focus:ring-1 focus:ring-[#006241]"
                  />
                </div>

                {/* Godziny: Start - End */}
                <div className="w-36 shrink-0">
                  <label className="text-[10px] uppercase font-bold text-stone-500 block mb-0.5">
                    Godziny (Start – Stop)
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={s.start_time}
                      onChange={e => handleUpdate(index, 'start_time', e.target.value)}
                      placeholder="07:00"
                      className="w-16 px-1.5 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-semibold text-center text-stone-700 focus:outline-hidden focus:ring-1 focus:ring-[#006241]"
                    />
                    <span className="text-stone-400">–</span>
                    <input
                      type="text"
                      value={s.end_time}
                      onChange={e => handleUpdate(index, 'end_time', e.target.value)}
                      placeholder="15:00"
                      className="w-16 px-1.5 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-semibold text-center text-stone-700 focus:outline-hidden focus:ring-1 focus:ring-[#006241]"
                    />
                  </div>
                </div>

                {/* Wymiar godzinowy (h) */}
                <div className="w-20 shrink-0">
                  <label className="text-[10px] uppercase font-bold text-stone-500 block mb-0.5">
                    Wymiar
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="24"
                      value={s.hours}
                      onChange={e => handleUpdate(index, 'hours', parseFloat(e.target.value) || 0)}
                      className="w-full pl-2 pr-5 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-bold text-stone-800 focus:outline-hidden focus:ring-1 focus:ring-[#006241]"
                    />
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-stone-400 font-semibold pointer-events-none">
                      h
                    </span>
                  </div>
                </div>

                {/* Kategoria */}
                <div className="w-32 shrink-0">
                  <label className="text-[10px] uppercase font-bold text-stone-500 block mb-0.5">
                    Kategoria
                  </label>
                  <select
                    value={s.category || (s.is_nc ? 'nc' : s.is_absence ? 'absence' : 'coverage')}
                    onChange={e => handleUpdate(index, 'category', e.target.value)}
                    className="w-full px-2 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-semibold text-stone-700 focus:outline-hidden focus:ring-1 focus:ring-[#006241]"
                  >
                    <option value="coverage">Coverage (Sala)</option>
                    <option value="nc">Non-Coverage</option>
                    <option value="absence">Urlop / Wolne</option>
                    <option value="dispo">Dyspozycja</option>
                  </select>
                </div>

                {/* Przełącznik: TYLKO NIEDZIELA */}
                <div className="w-36 shrink-0">
                  <label className="text-[10px] uppercase font-bold text-amber-900 block mb-0.5 flex items-center gap-1">
                    <Sun className="w-3 h-3 text-amber-600" />
                    <span>Tylko Niedziela?</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer bg-white px-2.5 py-1.5 rounded-lg border border-stone-300 hover:border-amber-400 select-none transition-colors">
                    <input
                      type="checkbox"
                      checked={isSunday}
                      onChange={e => handleUpdate(index, 'is_sunday_only', e.target.checked ? 1 : 0)}
                      className="w-4 h-4 text-amber-600 rounded-sm focus:ring-amber-500 cursor-pointer"
                    />
                    <span className={`text-[11px] font-bold ${isSunday ? 'text-amber-900 font-black' : 'text-stone-500'}`}>
                      {isSunday ? 'TAK (Tylko Nd)' : 'Nie (dowolny dzień)'}
                    </span>
                  </label>
                </div>

                {/* Usunięcie */}
                <div className="pt-3.5">
                  <button
                    onClick={() => handleDelete(index)}
                    className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                    title={`Usuń definicję zmiany ${s.code}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Informacja o regule niedzielnej */}
        <div className="px-6 py-2.5 bg-amber-50/70 border-t border-amber-200 text-xs text-amber-900 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            <strong>Zasada Niedzieli:</strong> Każda zmiana oznaczona jako <em>Tylko Niedziela</em> lub mająca w nazwie słowo <em>"Niedziela"</em> (np. AMN, PMN) będzie zablokowana do wyboru od poniedziałku do soboty i dostępna wyłącznie w niedziele.
          </span>
        </div>

        {/* Stopka akcji */}
        <div className="bg-stone-50 px-6 py-4 border-t border-[#E2E8E5] flex justify-between items-center">
          <span className="text-xs text-stone-500">
            Kawiarnia <strong>108120 SBX Janki</strong> • Katalog zmian operacyjnych
          </span>
          <div className="flex gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-200 text-xs font-semibold transition-colors"
            >
              Anuluj
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-[#006241] hover:bg-[#00754A] text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              {saveSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Zapisano Katalog Zmian!</span>
                </>
              ) : isSaving ? (
                <span>Zapisywanie...</span>
              ) : (
                <span>Zapisz Konfigurację Zmian</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
