import React, { useState, useEffect } from 'react';
import { TrainingPartner, TrainingProgram, PartnerTrainingStatus } from '../types';
import { UserPlus, UserCheck, X, Save, ShieldAlert, Calendar, User } from 'lucide-react';

interface PartnerEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  partner?: TrainingPartner | null;
  onSavePartner: (partner: Partial<TrainingPartner>) => Promise<void>;
  onDeletePartner?: (id: number) => Promise<void>;
}

export const PartnerEditModal: React.FC<PartnerEditModalProps> = ({
  isOpen,
  onClose,
  partner,
  onSavePartner,
  onDeletePartner
}) => {
  const [formData, setFormData] = useState<Partial<TrainingPartner>>({
    name: '',
    hire_date: new Date().toISOString().split('T')[0],
    current_program: 'first_30',
    assigned_trainer_name: 'Weronika Łukasiak',
    store_manager_name: 'Dawid Apel',
    sanepid_valid_until: '',
    bhp_completed_date: new Date().toISOString().split('T')[0],
    status: 'in_progress',
    notes: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (partner) {
      setFormData({
        id: partner.id,
        name: partner.name,
        hire_date: partner.hire_date,
        current_program: partner.current_program,
        assigned_trainer_name: partner.assigned_trainer_name || '',
        store_manager_name: partner.store_manager_name || 'Dawid Apel',
        sanepid_valid_until: partner.sanepid_valid_until || '',
        bhp_completed_date: partner.bhp_completed_date || '',
        status: partner.status,
        notes: partner.notes || ''
      });
    } else {
      setFormData({
        name: '',
        hire_date: new Date().toISOString().split('T')[0],
        current_program: 'first_30',
        assigned_trainer_name: 'Weronika Łukasiak',
        store_manager_name: 'Dawid Apel',
        sanepid_valid_until: '',
        bhp_completed_date: new Date().toISOString().split('T')[0],
        status: 'in_progress',
        notes: ''
      });
    }
  }, [partner, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) return;

    setIsSubmitting(true);
    try {
      await onSavePartner(formData);
      onClose();
    } catch (err) {
      console.error('Błąd zapisu partnera:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!partner?.id || !onDeletePartner) return;
    if (window.confirm(`Czy na pewno usunąć partnera ${partner.name} wraz ze wszystkimi przypisanymi zmianami T i egzaminami?`)) {
      await onDeletePartner(partner.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-stone-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center border border-emerald-200">
              {partner ? <UserCheck className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">
                {partner ? `Edycja Partnera: ${partner.name}` : 'Nowy Barista / Partner'}
              </h3>
              <p className="text-xs text-stone-500">
                Wprowadź dane do profilu szkoleniowego Starbucks
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Imię i Nazwisko Partnera: *
            </label>
            <input
              type="text"
              required
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="np. Kacper Wiśniewski"
              className="w-full p-2.5 bg-white border border-stone-300 rounded-lg font-medium text-stone-800 focus:border-emerald-600 focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Data Zatrudnienia: *
              </label>
              <input
                type="date"
                required
                value={formData.hire_date || ''}
                onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                className="w-full p-2.5 bg-white border border-stone-300 rounded-lg font-mono text-stone-800 focus:border-emerald-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Aktualny Program:
              </label>
              <select
                value={formData.current_program || 'first_30'}
                onChange={(e) => setFormData({ ...formData, current_program: e.target.value as TrainingProgram })}
                className="w-full p-2.5 bg-white border border-stone-300 rounded-lg font-medium text-stone-800 focus:border-emerald-600 focus:outline-hidden"
              >
                <option value="first_30">First 30 (Wdrożenie)</option>
                <option value="barista_90">Barista 90 (Relacje)</option>
                <option value="barista_180">Barista 180 (Coffee Academy 200)</option>
                <option value="barista_trainer">Barista Trener (Trening)</option>
                <option value="coffee_master">Coffee Master</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Dedykowany Trener Baristów:
              </label>
              <input
                type="text"
                value={formData.assigned_trainer_name || ''}
                onChange={(e) => setFormData({ ...formData, assigned_trainer_name: e.target.value })}
                placeholder="np. Weronika Łukasiak"
                className="w-full p-2.5 bg-white border border-stone-300 rounded-lg text-stone-800 focus:border-emerald-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Status Szkolenia:
              </label>
              <select
                value={formData.status || 'in_progress'}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as PartnerTrainingStatus })}
                className="w-full p-2.5 bg-white border border-stone-300 rounded-lg font-medium text-stone-800 focus:border-emerald-600 focus:outline-hidden"
              >
                <option value="in_progress">W trakcie (In Progress)</option>
                <option value="certified">Certyfikowany (Certified)</option>
                <option value="completed">Ukończony (Completed)</option>
                <option value="paused">Wstrzymany (Paused)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Badania Sanepid ważne do:
              </label>
              <input
                type="date"
                value={formData.sanepid_valid_until || ''}
                onChange={(e) => setFormData({ ...formData, sanepid_valid_until: e.target.value })}
                className="w-full p-2.5 bg-white border border-stone-300 rounded-lg font-mono text-stone-800 focus:border-emerald-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Szkolenie Wstępne BHP:
              </label>
              <input
                type="date"
                value={formData.bhp_completed_date || ''}
                onChange={(e) => setFormData({ ...formData, bhp_completed_date: e.target.value })}
                className="w-full p-2.5 bg-white border border-stone-300 rounded-lg font-mono text-stone-800 focus:border-emerald-600 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Store Manager (Opiekun):
            </label>
            <input
              type="text"
              value={formData.store_manager_name || 'Dawid Apel'}
              onChange={(e) => setFormData({ ...formData, store_manager_name: e.target.value })}
              className="w-full p-2.5 bg-white border border-stone-300 rounded-lg text-stone-800 focus:border-emerald-600 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Notatki & Uwagi:
            </label>
            <textarea
              rows={2}
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Dodatkowe informacje o dyspozycyjności lub postępach..."
              className="w-full p-2.5 bg-white border border-stone-300 rounded-lg text-stone-800 focus:border-emerald-600 focus:outline-hidden"
            />
          </div>

          <div className="pt-4 border-t border-stone-100 flex items-center justify-between">
            {partner?.id && onDeletePartner ? (
              <button
                type="button"
                onClick={handleDelete}
                className="text-xs text-red-600 hover:text-red-800 font-semibold px-2 py-1 hover:bg-red-50 rounded-lg transition-colors"
              >
                Usuń partnera
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-xl"
              >
                Anuluj
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-xs flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSubmitting ? 'Zapisywanie...' : 'Zapisz Partnera'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
