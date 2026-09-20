import React, { useState } from 'react';
import { ManagerEmployee } from '../../../types';
import { X, Plus, Trash2, ArrowUp, ArrowDown, Check, UserCheck, Copy, AlertCircle } from 'lucide-react';

interface ManagerTeamModalProps {
  employees: ManagerEmployee[];
  year: number;
  month: number;
  monthName: string;
  onSave: (payload: { employees: ManagerEmployee[]; propagateToFuture: boolean }) => Promise<void>;
  onCopyPreviousMonth?: () => Promise<void>;
  onClose: () => void;
}

export const ManagerTeamModal: React.FC<ManagerTeamModalProps> = ({
  employees: initialEmployees,
  year,
  month,
  monthName,
  onSave,
  onCopyPreviousMonth,
  onClose
}) => {
  const [employees, setEmployees] = useState<ManagerEmployee[]>(
    JSON.parse(JSON.stringify(initialEmployees))
  );
  const [propagateToFuture, setPropagateToFuture] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [confirmCopy, setConfirmCopy] = useState(false);

  // Dodawanie nowego pracownika do składu
  const handleAddEmployee = () => {
    const newEmp: ManagerEmployee = {
      id: 0, // id 0 dla nowego (w bazie AUTOINCREMENT)
      name: 'Nowy Menedżer',
      role: 'SSV',
      contract_type: 'FULL',
      contract_hours_ratio: 1.0,
      hourly_rate: 32.5,
      sort_order: employees.length + 1,
      is_active: 1
    };
    setEmployees([...employees, newEmp]);
  };

  // Usunięcie pracownika ze składu na ten miesiąc
  const handleRemoveFromMonth = (index: number) => {
    const updated = employees.filter((_, i) => i !== index);
    // Przenumerowanie kolejności sortowania
    updated.forEach((emp, i) => {
      emp.sort_order = i + 1;
    });
    setEmployees(updated);
  };

  const handleUpdate = (index: number, field: keyof ManagerEmployee, value: any) => {
    const updated = [...employees];
    updated[index] = { ...updated[index], [field]: value };

    // Aktualizacja proporcji jeśli zmieniono contract_type
    if (field === 'contract_type') {
      const type = String(value);
      if (type === 'FULL') updated[index].contract_hours_ratio = 1.0;
      else if (type === '0.75') updated[index].contract_hours_ratio = 0.75;
      else if (type === '0.5') updated[index].contract_hours_ratio = 0.5;
      else if (type === '0.25') updated[index].contract_hours_ratio = 0.25;
    }

    setEmployees(updated);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === employees.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...employees];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    // Przypisanie nowego sort_order
    updated.forEach((emp, i) => {
      emp.sort_order = i + 1;
    });

    setEmployees(updated);
  };

  const handleCopyFromPrevious = async () => {
    if (!onCopyPreviousMonth) return;
    try {
      setIsCopying(true);
      await onCopyPreviousMonth();
      setConfirmCopy(false);
      onClose();
    } catch (error) {
      console.error('Błąd kopiowania składu z poprzedniego miesiąca:', error);
    } finally {
      setIsCopying(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setIsSaving(true);
      await onSave({
        employees,
        propagateToFuture
      });
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 800);
    } catch (error) {
      console.error('Błąd zapisu zespołu:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-[#E2E8E5] w-full max-w-3xl overflow-hidden flex flex-col max-h-[88vh] animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Nagłówek */}
        <div className="bg-[#1E3932] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <UserCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold">Skład Menedżerski — {monthName} {year}</h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-900/80 text-emerald-200 text-[10px] font-bold border border-emerald-700">
                  {employees.length} menedżerów
                </span>
              </div>
              <p className="text-xs text-stone-300 mt-0.5">
                Zarządzaj zespołem przypisanym do tego miesiąca. Zmiany nie wpłyną na minione/zamknięte miesiące grafiku.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pasek pomocniczy: Kopiowanie z poprzedniego miesiąca */}
        <div className="bg-emerald-50/50 border-b border-emerald-100 px-6 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-[#006241]">
            <span className="font-semibold">Każdy miesiąc ma autonomiczny skład managerski.</span>
            <span className="text-stone-500">Menedżerowie odchodzący lub dochodzący są izolowani per miesiąc.</span>
          </div>

          {onCopyPreviousMonth && (
            <div>
              {!confirmCopy ? (
                <button
                  onClick={() => setConfirmCopy(true)}
                  className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-emerald-100 text-[#006241] border border-emerald-200 rounded-lg text-xs font-bold transition-all shadow-2xs"
                  title="Pobierz i odtwórz strukturę zespołu z poprzedniego miesiąca"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Kopiuj z poprzedniego m-ca</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5 animate-fade-in">
                  <span className="text-xs font-bold text-rose-700 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Zastąpić obecny skład?
                  </span>
                  <button
                    onClick={handleCopyFromPrevious}
                    disabled={isCopying}
                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all"
                  >
                    {isCopying ? 'Kopiowanie...' : 'Tak, pobierz'}
                  </button>
                  <button
                    onClick={() => setConfirmCopy(false)}
                    className="px-2 py-1 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-lg text-xs font-semibold transition-all"
                  >
                    Anuluj
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Lista menedżerów */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          {employees.length === 0 ? (
            <div className="p-8 text-center text-stone-500 bg-stone-50 rounded-xl border border-dashed border-stone-200">
              <p className="text-sm font-semibold">Brak menedżerów przypisanych do tego miesiąca.</p>
              <p className="text-xs text-stone-400 mt-1">Kliknij przycisk poniżej, aby dodać osobę lub pobierz skład z poprzedniego miesiąca.</p>
            </div>
          ) : (
            employees.map((emp, index) => {
              return (
                <div
                  key={emp.id ? `emp-${emp.id}` : `new-${index}`}
                  className="flex items-center gap-3 p-3.5 bg-[#F7F9F8] border border-[#E2E8E5] rounded-xl hover:border-emerald-300 transition-all"
                >
                  {/* Kolejność (strzałki) */}
                  <div className="flex flex-col gap-1 text-stone-400">
                    <button
                      onClick={() => handleMove(index, 'up')}
                      disabled={index === 0}
                      className="p-1 hover:text-[#006241] disabled:opacity-30"
                      title="Przesuń wyżej w grafiku"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleMove(index, 'down')}
                      disabled={index === employees.length - 1}
                      className="p-1 hover:text-[#006241] disabled:opacity-30"
                      title="Przesuń niżej w grafiku"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Imię i nazwisko */}
                  <div className="flex-1 min-w-[140px]">
                    <label className="text-[10px] uppercase font-semibold text-stone-500">
                      Imię i Nazwisko
                    </label>
                    <input
                      type="text"
                      value={emp.name}
                      onChange={e => handleUpdate(index, 'name', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-bold text-stone-800 focus:outline-hidden focus:ring-1 focus:ring-[#006241]"
                    />
                  </div>

                  {/* Stanowisko / Rola */}
                  <div className="w-44">
                    <label className="text-[10px] uppercase font-semibold text-stone-500">
                      Stanowisko
                    </label>
                    <select
                      value={emp.role}
                      onChange={e => handleUpdate(index, 'role', e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-semibold text-stone-700 focus:outline-hidden focus:ring-1 focus:ring-[#006241]"
                    >
                      <option value="CUSTOMER AND SALES MANAGER">STORE MANAGER (SM)</option>
                      <option value="ASSISTANT STORE MANAGER">ASSISTANT SM (ASM)</option>
                      <option value="SSV">SHIFT SUPERVISOR (SSV)</option>
                      <option value="SM IN TRAINING">SM IN TRAINING</option>
                      <option value="ASM IN TRAINING">ASM IN TRAINING</option>
                      <option value="SSV IN TRAINING">SSV IN TRAINING</option>
                    </select>
                  </div>

                  {/* Wymiar etatu */}
                  <div className="w-28">
                    <label className="text-[10px] uppercase font-semibold text-stone-500">
                      Wymiar Etatu
                    </label>
                    <select
                      value={emp.contract_type}
                      onChange={e => handleUpdate(index, 'contract_type', e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-bold text-emerald-800 focus:outline-hidden focus:ring-1 focus:ring-[#006241]"
                    >
                      <option value="FULL">FULL (1.0)</option>
                      <option value="0.75">3/4 (0.75)</option>
                      <option value="0.5">1/2 (0.5)</option>
                      <option value="0.25">1/4 (0.25)</option>
                    </select>
                  </div>

                  {/* Stawka godzinowa (PLN/h) */}
                  <div className="w-28">
                    <label className="text-[10px] uppercase font-semibold text-stone-500">
                      Stawka (zł/h)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={emp.hourly_rate ?? ''}
                        onChange={e => handleUpdate(index, 'hourly_rate', e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                        placeholder="np. 32.50"
                        className="w-full pl-2.5 pr-7 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-bold text-stone-800 focus:outline-hidden focus:ring-1 focus:ring-[#006241]"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-stone-400 font-semibold pointer-events-none">
                        zł/h
                      </span>
                    </div>
                  </div>

                  {/* Usunięcie ze składu na ten miesiąc */}
                  <div className="pt-4">
                    <button
                      onClick={() => handleRemoveFromMonth(index)}
                      className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                      title={`Usuń ${emp.name} ze składu na ten miesiąc`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}

          <button
            onClick={handleAddEmployee}
            className="w-full py-2.5 border-2 border-dashed border-stone-300 hover:border-[#006241] text-stone-600 hover:text-[#006241] rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Dodaj Menedżera do Składu ({monthName} {year})</span>
          </button>
        </div>

        {/* Pasek akcji */}
        <div className="bg-stone-50 px-6 py-4 border-t border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Checkbox propagacji na przyszłe miesiące */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={propagateToFuture}
              onChange={e => setPropagateToFuture(e.target.checked)}
              className="w-4 h-4 rounded-sm text-[#006241] focus:ring-[#006241] border-stone-300 cursor-pointer accent-[#006241]"
            />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-stone-800">
                Zastosuj zmiany również do kolejnych miesięcy
              </span>
              <span className="text-[10px] text-stone-500">
                Aktualizuje skład na przyszłe miesiące; miesiące przeszłe pozostają nienaruszone
              </span>
            </div>
          </label>

          <div className="flex items-center gap-2 self-end sm:self-auto">
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
                  <span>Zapisano Skład!</span>
                </>
              ) : isSaving ? (
                <span>Zapisywanie...</span>
              ) : (
                <span>
                  {propagateToFuture ? `Zapisz na ${monthName} i kolejne` : `Zapisz tylko na ${monthName}`}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
