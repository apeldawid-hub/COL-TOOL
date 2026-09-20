import React, { useState } from 'react';
import { TrainingPartner, TrainingShift } from '../types';
import { FIRST_30_SHIFTS } from '../services/trainingStandardData';
import { 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Circle, 
  AlertCircle, 
  Sparkles, 
  BookOpen, 
  User, 
  Plus, 
  Edit2, 
  Coffee,
  Info
} from 'lucide-react';

interface TrainingShiftsScheduleProps {
  partner: TrainingPartner;
  shifts: TrainingShift[];
  onUpdateShift: (shift: TrainingShift) => Promise<void>;
  onGenerateDefaultShifts: () => Promise<void>;
}

export const TrainingShiftsSchedule: React.FC<TrainingShiftsScheduleProps> = ({
  partner,
  shifts,
  onUpdateShift,
  onGenerateDefaultShifts
}) => {
  const [editingShiftId, setEditingShiftId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<TrainingShift>>({});
  const [selectedTopicsShift, setSelectedTopicsShift] = useState<TrainingShift | null>(null);

  const handleStartEdit = (shift: TrainingShift) => {
    setEditingShiftId(shift.id || null);
    setEditForm({
      scheduled_date: shift.scheduled_date,
      start_time: shift.start_time,
      end_time: shift.end_time,
      barista_hours_t: shift.barista_hours_t,
      trainer_hours_t: shift.trainer_hours_t,
      sm_hours_t: shift.sm_hours_t,
      trainer_name: shift.trainer_name,
      station: shift.station,
      notes: shift.notes
    });
  };

  const handleSaveEdit = async (shift: TrainingShift) => {
    const updated = {
      ...shift,
      ...editForm,
      barista_hours_t: Number(editForm.barista_hours_t) || shift.barista_hours_t,
      trainer_hours_t: Number(editForm.trainer_hours_t) || 0,
      sm_hours_t: Number(editForm.sm_hours_t) || 0
    };
    await onUpdateShift(updated);
    setEditingShiftId(null);
  };

  const handleToggleStatus = async (shift: TrainingShift) => {
    const nextStatus = shift.status === 'completed' ? 'planned' : 'completed';
    await onUpdateShift({
      ...shift,
      status: nextStatus
    });
  };

  // Znajdź opis i tematy z podręcznika
  const getTopicsForShift = (code: string) => {
    const match = FIRST_30_SHIFTS.find(s => s.shift_code === code);
    return match ? match.learning_topics : [];
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
      {/* Nagłówek panelu harmonogramu */}
      <div className="p-5 border-b border-stone-100 flex flex-wrap items-center justify-between gap-4 bg-stone-50/50">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-bold bg-emerald-100 text-emerald-800 rounded-md border border-emerald-200">
              Zmiany T
            </span>
            <h3 className="text-base font-bold text-stone-900">
              Harmonogram Treningowy: {partner.name}
            </h3>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Rejestr sesji szkoleniowych T1–T10 z podziałem godzin na Baristę, Trenera i Store Managera (NC Training).
          </p>
        </div>

        <div className="flex items-center gap-2">
          {shifts.length === 0 ? (
            <button
              onClick={onGenerateDefaultShifts}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Generuj standardowe Zmiany T (First 30)
            </button>
          ) : (
            <button
              onClick={onGenerateDefaultShifts}
              className="px-3 py-1.5 bg-white hover:bg-stone-50 text-stone-700 border border-stone-300 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5"
              title="Przywróć standardowy 2-tygodniowy plan T1-T10"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              Resetuj do szablonu T1–T10
            </button>
          )}
        </div>
      </div>

      {/* Baner informacyjny Non-Coverage */}
      <div className="px-5 py-2.5 bg-emerald-50/70 border-b border-emerald-100 flex items-center gap-2 text-xs text-emerald-900">
        <Info className="w-4 h-4 text-emerald-700 shrink-0" />
        <span>
          <b>Zasada Starbucks NC:</b> Zmiany T są w 100% rozliczane w budżecie <b>Non-Coverage (Szkolenia)</b>. Nie wliczają się do obsady Floor (32h/dzień) kawiarni Janki, chroniąc przepustowość operacyjną.
        </span>
      </div>

      {/* Tabela zmian T */}
      {shifts.length === 0 ? (
        <div className="p-12 text-center">
          <Coffee className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <h4 className="text-sm font-semibold text-stone-700">Brak zaplanowanych Zmian T dla tego partnera</h4>
          <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto">
            Kliknij przycisk powyżej, aby automatycznie utworzyć 2-tygodniowy wzorcowy program First 30 (10 zmian T1–T10, 56.5h łącznej inwestycji).
          </p>
          <button
            onClick={onGenerateDefaultShifts}
            className="mt-4 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-xs inline-flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            Utwórz Zmiany T1–T10 od daty zatrudnienia ({partner.hire_date})
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-100/75 text-stone-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3 w-12 text-center">Status</th>
                <th className="py-2.5 px-3 w-16">Kod</th>
                <th className="py-2.5 px-4">Tytuł & Stanowisko</th>
                <th className="py-2.5 px-3 w-32">Data</th>
                <th className="py-2.5 px-3 w-28">Czas</th>
                <th className="py-2.5 px-3 w-20 text-right">Barista (T)</th>
                <th className="py-2.5 px-3 w-20 text-right">Trener (T)</th>
                <th className="py-2.5 px-3 w-16 text-right">SM (T)</th>
                <th className="py-2.5 px-4">Trener Prowadzący</th>
                <th className="py-2.5 px-3 w-24 text-center">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {shifts.map((shift) => {
                const isEditing = editingShiftId === shift.id;
                const isCompleted = shift.status === 'completed';

                return (
                  <tr 
                    key={shift.id || shift.shift_code}
                    className={`hover:bg-stone-50/80 transition-colors ${
                      isCompleted ? 'bg-emerald-50/30' : ''
                    }`}
                  >
                    {/* Status Checkbox */}
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => handleToggleStatus(shift)}
                        className="cursor-pointer transition-transform active:scale-90"
                        title={isCompleted ? 'Kliknij aby cofnąć do zaplanowanej' : 'Kliknij aby oznaczyć jako zrealizowaną'}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-100" />
                        ) : (
                          <Circle className="w-5 h-5 text-stone-300 hover:text-emerald-500" />
                        )}
                      </button>
                    </td>

                    {/* Kod zmiany */}
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center justify-center font-black px-2 py-0.5 rounded text-xs border ${
                        shift.shift_code.startsWith('T')
                          ? 'bg-emerald-700 text-white border-emerald-800'
                          : 'bg-amber-600 text-white border-amber-700'
                      }`}>
                        {shift.shift_code}
                      </span>
                    </td>

                    {/* Tytuł & Stanowisko */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-stone-900 flex items-center gap-1.5">
                        {shift.title}
                        {getTopicsForShift(shift.shift_code).length > 0 && (
                          <button
                            onClick={() => setSelectedTopicsShift(shift)}
                            className="text-stone-400 hover:text-emerald-700 transition-colors"
                            title="Pokaż zagadnienia z podręcznika"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="text-[11px] text-stone-500 mt-0.5 flex items-center gap-2">
                        <span className="bg-stone-100 px-1.5 py-0.5 rounded text-stone-600 font-medium">
                          {shift.station || 'Stanowisko ogólne'}
                        </span>
                        {shift.notes && (
                          <span className="truncate max-w-xs text-stone-400" title={shift.notes}>
                            {shift.notes}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Data */}
                    <td className="py-3 px-3">
                      {isEditing ? (
                        <input
                          type="date"
                          value={editForm.scheduled_date || ''}
                          onChange={(e) => setEditForm({ ...editForm, scheduled_date: e.target.value })}
                          className="w-full text-xs p-1 border border-stone-300 rounded font-mono"
                        />
                      ) : (
                        <div className="flex items-center gap-1 text-stone-700 font-mono">
                          <Calendar className="w-3.5 h-3.5 text-stone-400" />
                          <span>{shift.scheduled_date}</span>
                        </div>
                      )}
                    </td>

                    {/* Czas (Od - Do) */}
                    <td className="py-3 px-3">
                      {isEditing ? (
                        <div className="flex items-center gap-1 font-mono">
                          <input
                            type="text"
                            value={editForm.start_time || ''}
                            onChange={(e) => setEditForm({ ...editForm, start_time: e.target.value })}
                            className="w-12 text-xs p-1 border border-stone-300 rounded text-center"
                            placeholder="09:00"
                          />
                          <span>-</span>
                          <input
                            type="text"
                            value={editForm.end_time || ''}
                            onChange={(e) => setEditForm({ ...editForm, end_time: e.target.value })}
                            className="w-12 text-xs p-1 border border-stone-300 rounded text-center"
                            placeholder="13:00"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-stone-600 font-mono">
                          <Clock className="w-3.5 h-3.5 text-stone-400" />
                          <span>{shift.start_time} - {shift.end_time}</span>
                        </div>
                      )}
                    </td>

                    {/* Godziny Barista (T) */}
                    <td className="py-3 px-3 text-right">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.25"
                          value={editForm.barista_hours_t ?? ''}
                          onChange={(e) => setEditForm({ ...editForm, barista_hours_t: parseFloat(e.target.value) })}
                          className="w-14 text-xs p-1 border border-stone-300 rounded text-right font-mono"
                        />
                      ) : (
                        <span className="font-bold text-stone-900 bg-emerald-50 px-1.5 py-0.5 rounded text-emerald-800 border border-emerald-200">
                          {Number(shift.barista_hours_t).toFixed(2)}h
                        </span>
                      )}
                    </td>

                    {/* Godziny Trener BT (T) */}
                    <td className="py-3 px-3 text-right">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.25"
                          value={editForm.trainer_hours_t ?? ''}
                          onChange={(e) => setEditForm({ ...editForm, trainer_hours_t: parseFloat(e.target.value) })}
                          className="w-14 text-xs p-1 border border-stone-300 rounded text-right font-mono"
                        />
                      ) : (
                        <span className={`font-medium px-1.5 py-0.5 rounded ${
                          shift.trainer_hours_t > 0
                            ? 'text-amber-800 bg-amber-50 border border-amber-200 font-bold'
                            : 'text-stone-400'
                        }`}>
                          {Number(shift.trainer_hours_t).toFixed(2)}h
                        </span>
                      )}
                    </td>

                    {/* Godziny SM (T) */}
                    <td className="py-3 px-3 text-right">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.25"
                          value={editForm.sm_hours_t ?? ''}
                          onChange={(e) => setEditForm({ ...editForm, sm_hours_t: parseFloat(e.target.value) })}
                          className="w-14 text-xs p-1 border border-stone-300 rounded text-right font-mono"
                        />
                      ) : (
                        <span className={`font-medium px-1.5 py-0.5 rounded ${
                          shift.sm_hours_t > 0
                            ? 'text-blue-800 bg-blue-50 border border-blue-200 font-bold'
                            : 'text-stone-400'
                        }`}>
                          {Number(shift.sm_hours_t).toFixed(2)}h
                        </span>
                      )}
                    </td>

                    {/* Trener Prowadzący */}
                    <td className="py-3 px-4">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.trainer_name || ''}
                          onChange={(e) => setEditForm({ ...editForm, trainer_name: e.target.value })}
                          className="w-full text-xs p-1 border border-stone-300 rounded"
                          placeholder="Imię Trenera Baristów"
                        />
                      ) : (
                        <div className="flex items-center gap-1.5 text-stone-700">
                          {shift.trainer_name ? (
                            <>
                              <User className="w-3.5 h-3.5 text-stone-400" />
                              <span>{shift.trainer_name}</span>
                            </>
                          ) : (
                            <span className="text-stone-400 italic">Brak / SM</span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Akcje */}
                    <td className="py-3 px-3 text-center">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleSaveEdit(shift)}
                            className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold"
                          >
                            Zapisz
                          </button>
                          <button
                            onClick={() => setEditingShiftId(null)}
                            className="px-2 py-0.5 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded text-[10px]"
                          >
                            Anuluj
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleStartEdit(shift)}
                          className="p-1 hover:bg-stone-100 rounded text-stone-500 hover:text-stone-800 transition-colors"
                          title="Edytuj godziny lub datę"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal / Podgląd tematów z podręcznika */}
      {selectedTopicsShift && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 border border-stone-200 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-emerald-700 text-white text-xs font-bold rounded">
                  {selectedTopicsShift.shift_code}
                </span>
                <h4 className="font-bold text-stone-900 text-sm">
                  {selectedTopicsShift.title}
                </h4>
              </div>
              <button
                onClick={() => setSelectedTopicsShift(null)}
                className="text-stone-400 hover:text-stone-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="mt-4">
              <p className="text-xs text-stone-600 font-medium mb-2">
                Zagadnienia z oficjalnego Planu Treningowego Starbucks:
              </p>
              <ul className="space-y-2 text-xs text-stone-700">
                {getTopicsForShift(selectedTopicsShift.shift_code).map((topic, i) => (
                  <li key={i} className="flex items-start gap-2 bg-stone-50 p-2 rounded-lg border border-stone-100">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{topic}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-5 pt-3 border-t border-stone-100 flex justify-end">
              <button
                onClick={() => setSelectedTopicsShift(null)}
                className="px-4 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-lg"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
