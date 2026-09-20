import React, { useState } from 'react';
import { ManagerEmployee } from '../../../types';
import { X, Plus, Trash2, ArrowUp, ArrowDown, Check, UserCheck, Briefcase } from 'lucide-react';

interface ManagerTeamModalProps {
  employees: ManagerEmployee[];
  onSave: (employees: ManagerEmployee[]) => Promise<void>;
  onClose: () => void;
}

export const ManagerTeamModal: React.FC<ManagerTeamModalProps> = ({
  employees: initialEmployees,
  onSave,
  onClose
}) => {
  const [employees, setEmployees] = useState<ManagerEmployee[]>(
    JSON.parse(JSON.stringify(initialEmployees))
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Dodawanie nowego pracownika
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

  const handleToggleActive = (index: number) => {
    const updated = [...employees];
    updated[index].is_active = updated[index].is_active ? 0 : 1;
    setEmployees(updated);
  };

  const handleSubmit = async () => {
    try {
      setIsSaving(true);
      await onSave(employees);
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
        className="bg-white rounded-2xl shadow-2xl border border-[#E2E8E5] w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh] animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Nagłówek */}
        <div className="bg-[#1E3932] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <UserCheck className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-bold">Zarządzanie Zespołem Menedżerskim</h2>
              <p className="text-xs text-stone-300">Dodawaj, edytuj role, stawkę godzinową, wymiar etatu i kolejność w grafiku</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lista menedżerów */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          {employees.map((emp, index) => {
            return (
              <div
                key={emp.id || `new-${index}`}
                className="flex items-center gap-3 p-3.5 bg-[#F7F9F8] border border-[#E2E8E5] rounded-xl hover:border-emerald-300 transition-all"
              >
                {/* Kolejność (strzałki) */}
                <div className="flex flex-col gap-1 text-stone-400">
                  <button
                    onClick={() => handleMove(index, 'up')}
                    disabled={index === 0}
                    className="p-1 hover:text-[#006241] disabled:opacity-30"
                    title="Przesuń wyżej"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleMove(index, 'down')}
                    disabled={index === employees.length - 1}
                    className="p-1 hover:text-[#006241] disabled:opacity-30"
                    title="Przesuń niżej"
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

                {/* Aktywny / Usunięcie */}
                <div className="pt-4">
                  <button
                    onClick={() => handleToggleActive(index)}
                    className={`p-1.5 rounded-lg border transition-colors ${
                      emp.is_active
                        ? 'border-red-200 text-red-600 hover:bg-red-50'
                        : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                    }`}
                    title={emp.is_active ? 'Deaktywuj' : 'Aktywuj'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}

          <button
            onClick={handleAddEmployee}
            className="w-full py-2.5 border-2 border-dashed border-stone-300 hover:border-[#006241] text-stone-600 hover:text-[#006241] rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Dodaj Menedżera do Zespołu</span>
          </button>
        </div>

        {/* Pasek akcji */}
        <div className="bg-stone-50 px-6 py-4 border-t border-stone-200 flex justify-between items-center">
          <span className="text-xs text-stone-500">
            Menedżerowie widoczni w grafiku: {employees.filter(e => e.is_active).length}
          </span>
          <div className="flex gap-2">
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
                  <span>Zapisano Zmiany!</span>
                </>
              ) : isSaving ? (
                <span>Zapisywanie...</span>
              ) : (
                <span>Zapisz Zespół</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
