import React, { useState, useRef, useMemo } from 'react';
import {
  X,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Sparkles,
  TrendingUp,
  Clock,
  ShieldCheck,
  ArrowLeft,
  Save,
  Trash2,
  Search,
  Check,
  Edit3
} from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

interface AopMonthRow {
  key: string;
  year: number;
  month: string;
  month_code: string;
  weeks_count: number;
  plan_trx: number;
  target_tplh: number;
  labor_budget: number;
  avg_weekly_hours: number;
  plan_sales: number;
  plan_col_pln: number;
  plan_col_percent: number;
  plan_cos_pln: number;
  plan_cos_percent: number;
  plan_ops_profit: number;
}

interface MapalRecordRow {
  id?: string;
  date: string;
  year: number;
  month: string;
  week: string;
  week_key: string;
  day_of_week: string;
  employee: string;
  category: string;
  contract_type: string;
  computable_time: number;
  unit_code: string;
  unit_name: string;
  is_manager?: boolean;
}

type ModalStage = 'DROPZONE' | 'PREVIEW_AOP' | 'PREVIEW_MAPAL' | 'SUCCESS';

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const [stage, setStage] = useState<ModalStage>('DROPZONE');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // AOP Preview State
  const [aopYear, setAopYear] = useState<number>(2026);
  const [aopMonths, setAopMonths] = useState<AopMonthRow[]>([]);

  // MAPAL Preview State
  const [mapalRecords, setMapalRecords] = useState<MapalRecordRow[]>([]);
  const [searchEmployee, setSearchEmployee] = useState<string>('');

  // Warnings / Error messages
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Podsumowanie AOP na żywo z edytowanych danych
  const aopSummary = useMemo(() => {
    const totalSales = aopMonths.reduce((acc, m) => acc + (m.plan_sales || 0), 0);
    const totalTrx = aopMonths.reduce((acc, m) => acc + (m.plan_trx || 0), 0);
    const totalCol = aopMonths.reduce((acc, m) => acc + (m.plan_col_pln || 0), 0);
    const totalBudgetHours = aopMonths.reduce((acc, m) => acc + (m.labor_budget || 0), 0);
    const avgTplh = aopMonths.length > 0 ? Number((aopMonths.reduce((acc, m) => acc + m.target_tplh, 0) / aopMonths.length).toFixed(2)) : 6.7;
    const avgColPct = totalSales > 0 ? Number(((totalCol / totalSales) * 100).toFixed(2)) : 0;

    return { totalSales, totalTrx, totalCol, totalBudgetHours, avgTplh, avgColPct };
  }, [aopMonths]);

  // Filtrowane rekordy MAPAL
  const filteredMapalRecords = useMemo(() => {
    if (!searchEmployee.trim()) return mapalRecords;
    const q = searchEmployee.toLowerCase().trim();
    return mapalRecords.filter((r) => r.employee.toLowerCase().includes(q));
  }, [mapalRecords, searchEmployee]);

  const mapalSummary = useMemo(() => {
    const totalHours = Number(mapalRecords.reduce((acc, r) => acc + (r.computable_time || 0), 0).toFixed(2));
    const uniqueEmployees = new Set(mapalRecords.map((r) => r.employee)).size;
    const dates = mapalRecords.map((r) => r.date).sort();
    const minDate = dates[0] || '';
    const maxDate = dates[dates.length - 1] || '';
    return { totalHours, count: mapalRecords.length, uniqueEmployees, minDate, maxDate };
  }, [mapalRecords]);

  if (!isOpen) return null;

  const resetState = () => {
    setStage('DROPZONE');
    setIsProcessing(false);
    setIsSaving(false);
    setAopMonths([]);
    setMapalRecords([]);
    setSearchEmployee('');
    setValidationWarnings([]);
    setValidationErrors([]);
    setErrorMessage(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  // 1. Parsowanie pliku i przejście do widoku edycji / weryfikacji
  const handleProcessFile = async (file: File) => {
    setIsProcessing(true);
    setErrorMessage(null);
    setValidationWarnings([]);
    setValidationErrors([]);

    try {
      const api = (window as any).api;
      const parseFn = api?.parseReportBuffer;

      if (!parseFn) {
        setErrorMessage('Brak aktywnego połączenia z procesem desktopowym Electron.');
        setIsProcessing(false);
        return;
      }

      const buffer = await file.arrayBuffer();
      const res = await parseFn(buffer);

      if (!res.success) {
        setErrorMessage(res.message || 'Nie udało się przetworzyć przesłanego pliku.');
        setIsProcessing(false);
        return;
      }

      if (res.reportType === 'AOP_PL' && res.aopData) {
        setAopYear(res.aopData.year || 2026);
        setAopMonths(res.aopData.months || []);
        setValidationWarnings(res.validation?.warnings || []);
        setValidationErrors(res.validation?.errors || []);
        setStage('PREVIEW_AOP');
      } else if (res.reportType === 'MAPAL_FICHAJES' && res.mapalData) {
        setMapalRecords(res.mapalData.records || []);
        setValidationWarnings(res.validation?.warnings || []);
        setValidationErrors(res.validation?.errors || []);
        setStage('PREVIEW_MAPAL');
      } else {
        setErrorMessage(res.message || 'Nierozpoznany format raportu.');
      }
    } catch (err: any) {
      setErrorMessage(`Błąd odczytu pliku: ${err.message || String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNativeFileDialog = async () => {
    const api = (window as any).api;
    if (!api?.openFileDialog || !api?.parseReportFile) return;

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const filePath = await api.openFileDialog();
      if (filePath) {
        const res = await api.parseReportFile(filePath);
        if (!res.success) {
          setErrorMessage(res.message || 'Nie udało się przetworzyć wybranego pliku.');
          setIsProcessing(false);
          return;
        }

        if (res.reportType === 'AOP_PL' && res.aopData) {
          setAopYear(res.aopData.year || 2026);
          setAopMonths(res.aopData.months || []);
          setValidationWarnings(res.validation?.warnings || []);
          setValidationErrors(res.validation?.errors || []);
          setStage('PREVIEW_AOP');
        } else if (res.reportType === 'MAPAL_FICHAJES' && res.mapalData) {
          setMapalRecords(res.mapalData.records || []);
          setValidationWarnings(res.validation?.warnings || []);
          setValidationErrors(res.validation?.errors || []);
          setStage('PREVIEW_MAPAL');
        } else {
          setErrorMessage(res.message || 'Nierozpoznany format raportu.');
        }
      }
    } catch (err: any) {
      setErrorMessage(`Błąd importu: ${err.message || String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleProcessFile(file);
    }
  };

  // Edycja komórki AOP
  const handleAopCellChange = (
    index: number,
    field: keyof AopMonthRow,
    value: number
  ) => {
    setAopMonths((prev) => {
      const updated = [...prev];
      const row = { ...updated[index] };

      (row as any)[field] = value;

      // Automatyczne przeliczenia powiązane
      if (field === 'plan_trx' || field === 'target_tplh') {
        const tplh = field === 'target_tplh' ? value : row.target_tplh;
        const trx = field === 'plan_trx' ? value : row.plan_trx;
        if (tplh > 0) {
          row.labor_budget = Number((trx / tplh).toFixed(1));
          row.avg_weekly_hours = Number((row.labor_budget / row.weeks_count).toFixed(1));
        }
      }

      if (field === 'weeks_count') {
        if (row.weeks_count > 0 && row.labor_budget > 0) {
          row.avg_weekly_hours = Number((row.labor_budget / value).toFixed(1));
        }
      }

      if (field === 'plan_col_pln' || field === 'plan_sales') {
        const sales = field === 'plan_sales' ? value : row.plan_sales;
        const col = field === 'plan_col_pln' ? value : row.plan_col_pln;
        if (sales > 0) {
          row.plan_col_percent = Number(((col / sales) * 100).toFixed(2));
        }
      }

      updated[index] = row;
      return updated;
    });
  };

  // Edycja godzin MAPAL
  const handleMapalHoursChange = (index: number, hours: number) => {
    setMapalRecords((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        computable_time: Number(hours.toFixed(2)),
      };
      return updated;
    });
  };

  const handleRemoveMapalRecord = (index: number) => {
    setMapalRecords((prev) => prev.filter((_, idx) => idx !== index));
  };

  // 2. Zatwierdzenie AOP i zapis do SQLite
  const handleCommitAop = async () => {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const api = (window as any).api;
      if (!api?.commitAopImport) {
        setErrorMessage('Brak funkcji commitAopImport w API Electron.');
        setIsSaving(false);
        return;
      }

      const res = await api.commitAopImport({
        year: aopYear,
        months: aopMonths,
      });

      if (res.success) {
        setSuccessMessage(res.message);
        setStage('SUCCESS');
        onImportSuccess();
      } else {
        setErrorMessage(res.message || 'Wystąpił błąd podczas zapisu AOP.');
      }
    } catch (err: any) {
      setErrorMessage(`Błąd zapisu: ${err.message || String(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  // 3. Zatwierdzenie MAPAL i zapis do SQLite
  const handleCommitMapal = async () => {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const api = (window as any).api;
      if (!api?.commitMapalImport) {
        setErrorMessage('Brak funkcji commitMapalImport w API Electron.');
        setIsSaving(false);
        return;
      }

      const res = await api.commitMapalImport({
        records: mapalRecords,
      });

      if (res.success) {
        setSuccessMessage(res.message);
        setStage('SUCCESS');
        onImportSuccess();
      } else {
        setErrorMessage(res.message || 'Wystąpił błąd podczas zapisu logowań MAPAL.');
      }
    } catch (err: any) {
      setErrorMessage(`Błąd zapisu: ${err.message || String(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div
        className={`bg-white border border-[#D0DCD6] rounded-3xl shadow-2xl relative overflow-hidden flex flex-col transition-all duration-300 ${
          stage === 'PREVIEW_AOP' || stage === 'PREVIEW_MAPAL'
            ? 'max-w-5xl w-full max-h-[92vh]'
            : 'max-w-xl w-full'
        }`}
      >
        {/* Górny Pasek Nagłówka */}
        <div className="px-6 py-4 border-b border-[#E2E8E5] flex items-center justify-between bg-gradient-to-r from-[#F7F9F8] to-white shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-[#E8F5E9] text-[#006241] border border-[#C8E6C9] shadow-2xs">
              <Sparkles className="w-5 h-5 text-[#006241]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-[#1E3932]">
                  {stage === 'DROPZONE' && 'Inteligentny Import Raportów'}
                  {stage === 'PREVIEW_AOP' && `Weryfikacja Planu AOP P&L — Rok ${aopYear}`}
                  {stage === 'PREVIEW_MAPAL' && 'Weryfikacja Logowań MAPAL Fichajes'}
                  {stage === 'SUCCESS' && 'Import Zakończony Sukcesem'}
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#006241]/10 text-[#006241] border border-[#006241]/20">
                  {stage === 'DROPZONE' ? 'Auto-Detect' : 'Krok 2: Weryfikacja & Edycja'}
                </span>
              </div>
              <p className="text-xs text-[#5C6F68]">
                {stage === 'DROPZONE' && 'Przeciągnij raport, aby automatycznie zweryfikować i edytować dane przed importem.'}
                {stage === 'PREVIEW_AOP' && 'Możesz edytować wartości w tabeli poniżej. Zmiany zostaną zapisane dopiero po kliknięciu Zatwierdź.'}
                {stage === 'PREVIEW_MAPAL' && 'Zweryfikuj zaimportowane godziny pracowników i zatwierdź zapis do bazy danych.'}
                {stage === 'SUCCESS' && 'Dane zostały pomyślnie zwalidowane i zapisane w bazie SQLite.'}
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-1.5 rounded-full bg-[#F0F4F2] text-[#5C6F68] hover:text-[#1E3932] hover:bg-[#E2E8E5] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Ciało Modala w zależności od kroku */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {/* Komunikat o błędzie */}
          {errorMessage && (
            <div className="mb-4 p-3.5 rounded-2xl bg-[#FEF2F2] border border-[#FCA5A5] text-[#DC2626] text-xs font-semibold flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Ostrzeżenia walidacyjne */}
          {validationWarnings.length > 0 && (stage === 'PREVIEW_AOP' || stage === 'PREVIEW_MAPAL') && (
            <div className="mb-4 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Uwagi walidacyjne:
              </div>
              <ul className="list-disc pl-5 text-[11px] text-amber-700 space-y-0.5">
                {validationWarnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* KROK 1: DROPZONE */}
          {stage === 'DROPZONE' && (
            <div>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={handleNativeFileDialog}
                className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center ${
                  isDragging
                    ? 'border-[#006241] bg-[#006241]/5 scale-[0.99]'
                    : 'border-[#D0DCD6] hover:border-[#006241] bg-[#F7F9F8] hover:bg-white'
                }`}
              >
                <div className="w-16 h-16 rounded-full bg-white border border-[#E2E8E5] flex items-center justify-center text-[#006241] shadow-2xs mb-3">
                  <UploadCloud className="w-8 h-8" />
                </div>

                <span className="font-bold text-sm text-[#1E3932] block">
                  Przeciągnij i upuść raport Excel tutaj
                </span>
                <span className="text-xs text-[#5C6F68] mt-1 block">
                  lub kliknij, aby wybrać plik (.xlsx, .xls, .xlsm) z dysku
                </span>
                <span className="text-[11px] text-[#006241] font-semibold mt-3 bg-[#E8F5E9] px-3 py-1 rounded-lg border border-[#C8E6C9]">
                  🤖 Automatyczna detekcja formatu + tabela weryfikacji przed zapisem
                </span>
              </div>

              {/* Obsługiwane typy raportów */}
              <div className="mt-4 grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-3.5 rounded-2xl bg-[#F7F9F8] border border-[#E2E8E5] flex items-start gap-2.5">
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-[#1E3932]">Raport AOP P&L</div>
                    <div className="text-[11px] text-[#5C6F68] mt-0.5">
                      Roczne budżety: Sprzedaż, Transakcje (TRX), Koszt Pracy (COL), COS i zysk operacyjny.
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#F7F9F8] border border-[#E2E8E5] flex items-start gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-[#1E3932]">Ewidencja MAPAL</div>
                    <div className="text-[11px] text-[#5C6F68] mt-0.5">
                      Rzeczywiste logowania baristów i menedżerów (Fichajes) dla lokalu 108120 Janki.
                    </div>
                  </div>
                </div>
              </div>

              {/* Informacja o bezpieczeństwie */}
              <div className="mt-3.5 p-3 rounded-2xl bg-[#F0FDF4] border border-[#DCFCE7] text-[11px] text-[#166534] flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 shrink-0 text-[#16a34a]" />
                <span>
                  <strong>Bezpieczeństwo danych:</strong> Dane nie są importowane automatycznie w ciemno — po wczytaniu pliku zobaczysz podgląd z opcją edycji.
                </span>
              </div>

              {/* Loader */}
              {isProcessing && (
                <div className="mt-4 p-3.5 rounded-2xl bg-[#006241]/5 border border-[#006241]/20 flex items-center justify-center space-x-2.5 text-xs text-[#006241] font-bold">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Przetwarzanie i walidacja struktury raportu...</span>
                </div>
              )}
            </div>
          )}

          {/* KROK 2A: PODGLĄD I EDYCJA AOP */}
          {stage === 'PREVIEW_AOP' && (
            <div className="space-y-4">
              {/* Kafelki Podsumowania */}
              <div className="grid grid-cols-4 gap-2.5">
                <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200 text-center">
                  <div className="text-[10px] uppercase font-bold text-stone-500">Suma Sprzedaży</div>
                  <div className="text-sm font-black text-stone-900 mt-0.5">
                    {aopSummary.totalSales.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-blue-50/60 border border-blue-200 text-center">
                  <div className="text-[10px] uppercase font-bold text-blue-700">Suma Transakcji</div>
                  <div className="text-sm font-black text-blue-900 mt-0.5">
                    {aopSummary.totalTrx.toLocaleString('pl-PL')} TRX
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200 text-center">
                  <div className="text-[10px] uppercase font-bold text-emerald-700">Budżet Robocizny</div>
                  <div className="text-sm font-black text-emerald-900 mt-0.5">
                    {aopSummary.totalBudgetHours.toLocaleString('pl-PL')} h <span className="text-[10px] font-medium text-emerald-700">({aopSummary.avgTplh} TPLH)</span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-purple-50/60 border border-purple-200 text-center">
                  <div className="text-[10px] uppercase font-bold text-purple-700">Budżet COL (PLN / %)</div>
                  <div className="text-sm font-black text-purple-900 mt-0.5">
                    {aopSummary.totalCol.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł <span className="text-[10px] font-medium text-purple-700">({aopSummary.avgColPct}%)</span>
                  </div>
                </div>
              </div>

              {/* Tabela edycji 12 miesięcy */}
              <div className="border border-[#D0DCD6] rounded-2xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto max-h-[46vh] custom-scrollbar">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#F0F4F2] text-[#1E3932] font-black uppercase text-[10px] sticky top-0 z-10 border-b border-[#D0DCD6]">
                      <tr>
                        <th className="p-2.5 pl-3">Miesiąc</th>
                        <th className="p-2.5 text-center">Tyg.</th>
                        <th className="p-2.5">Sprzedaż (PLN)</th>
                        <th className="p-2.5">Transakcje (TRX)</th>
                        <th className="p-2.5">Cel TPLH</th>
                        <th className="p-2.5">Budżet (h)</th>
                        <th className="p-2.5">Śr. Tydz. (h)</th>
                        <th className="p-2.5">Budżet COL (PLN)</th>
                        <th className="p-2.5 pr-3 text-right">COL %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 font-medium">
                      {aopMonths.map((m, idx) => (
                        <tr key={m.month_code} className="hover:bg-emerald-50/30 transition-colors">
                          <td className="p-2 pl-3 font-bold text-stone-900 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-800 text-[11px] font-black mr-1.5 border border-stone-200">
                              {m.month_code}
                            </span>
                            {m.month}
                          </td>

                          <td className="p-2 text-center">
                            <select
                              value={m.weeks_count}
                              onChange={(e) => handleAopCellChange(idx, 'weeks_count', parseInt(e.target.value, 10))}
                              className="px-2 py-1 rounded-lg border border-stone-300 text-xs font-bold text-stone-800 bg-white hover:border-[#006241] focus:border-[#006241] outline-hidden"
                            >
                              <option value={5}>5 tyg.</option>
                              <option value={6}>6 tyg.</option>
                            </select>
                          </td>

                          <td className="p-2">
                            <input
                              type="number"
                              step="100"
                              value={m.plan_sales}
                              onChange={(e) => handleAopCellChange(idx, 'plan_sales', parseFloat(e.target.value) || 0)}
                              className="w-28 px-2 py-1 rounded-lg border border-stone-300 text-xs font-semibold text-stone-900 bg-white hover:border-[#006241] focus:border-[#006241] outline-hidden"
                            />
                          </td>

                          <td className="p-2">
                            <input
                              type="number"
                              step="10"
                              value={m.plan_trx}
                              onChange={(e) => handleAopCellChange(idx, 'plan_trx', parseInt(e.target.value, 10) || 0)}
                              className="w-24 px-2 py-1 rounded-lg border border-stone-300 text-xs font-semibold text-stone-900 bg-white hover:border-[#006241] focus:border-[#006241] outline-hidden"
                            />
                          </td>

                          <td className="p-2">
                            <input
                              type="number"
                              step="0.1"
                              value={m.target_tplh}
                              onChange={(e) => handleAopCellChange(idx, 'target_tplh', parseFloat(e.target.value) || 6.7)}
                              className="w-20 px-2 py-1 rounded-lg border border-stone-300 text-xs font-bold text-[#006241] bg-white hover:border-[#006241] focus:border-[#006241] outline-hidden"
                            />
                          </td>

                          <td className="p-2 font-bold text-stone-700 whitespace-nowrap">
                            {m.labor_budget.toFixed(1)} h
                          </td>

                          <td className="p-2 font-bold text-stone-600 whitespace-nowrap">
                            {m.avg_weekly_hours.toFixed(1)} h
                          </td>

                          <td className="p-2">
                            <input
                              type="number"
                              step="100"
                              value={m.plan_col_pln}
                              onChange={(e) => handleAopCellChange(idx, 'plan_col_pln', parseFloat(e.target.value) || 0)}
                              className="w-28 px-2 py-1 rounded-lg border border-stone-300 text-xs font-semibold text-stone-900 bg-white hover:border-[#006241] focus:border-[#006241] outline-hidden"
                            />
                          </td>

                          <td className="p-2 pr-3 text-right font-black text-stone-800 whitespace-nowrap">
                            {m.plan_col_percent.toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* KROK 2B: PODGLĄD I EDYCJA MAPAL */}
          {stage === 'PREVIEW_MAPAL' && (
            <div className="space-y-4">
              {/* Kafelki Podsumowania MAPAL */}
              <div className="grid grid-cols-4 gap-2.5">
                <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200 text-center">
                  <div className="text-[10px] uppercase font-bold text-stone-500">Liczba Logowań</div>
                  <div className="text-sm font-black text-stone-900 mt-0.5">
                    {mapalSummary.count} wpisów
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200 text-center">
                  <div className="text-[10px] uppercase font-bold text-emerald-700">Suma Godzin Pracy</div>
                  <div className="text-sm font-black text-emerald-900 mt-0.5">
                    {mapalSummary.totalHours} h
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-blue-50/60 border border-blue-200 text-center">
                  <div className="text-[10px] uppercase font-bold text-blue-700">Pracownicy</div>
                  <div className="text-sm font-black text-blue-900 mt-0.5">
                    {mapalSummary.uniqueEmployees} osób
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-purple-50/60 border border-purple-200 text-center">
                  <div className="text-[10px] uppercase font-bold text-purple-700">Zakres Dat</div>
                  <div className="text-xs font-bold text-purple-900 mt-1">
                    {mapalSummary.minDate} – {mapalSummary.maxDate}
                  </div>
                </div>
              </div>

              {/* Pasek Wyszukiwania */}
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1 max-w-xs">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Szukaj pracownika..."
                    value={searchEmployee}
                    onChange={(e) => setSearchEmployee(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-stone-300 text-xs font-semibold text-stone-900 placeholder-stone-400 focus:border-[#006241] outline-hidden"
                  />
                </div>
                <div className="text-xs text-stone-500 font-medium">
                  Wyświetlono: <strong>{filteredMapalRecords.length}</strong> z {mapalRecords.length}
                </div>
              </div>

              {/* Tabela Logowań MAPAL */}
              <div className="border border-[#D0DCD6] rounded-2xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto max-h-[46vh] custom-scrollbar">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#F0F4F2] text-[#1E3932] font-black uppercase text-[10px] sticky top-0 z-10 border-b border-[#D0DCD6]">
                      <tr>
                        <th className="p-2.5 pl-3">Data</th>
                        <th className="p-2.5">Dzień</th>
                        <th className="p-2.5">Pracownik</th>
                        <th className="p-2.5">Kategoria</th>
                        <th className="p-2.5">Godziny (Computable)</th>
                        <th className="p-2.5">Lokal</th>
                        <th className="p-2.5 pr-3 text-center">Akcja</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 font-medium">
                      {filteredMapalRecords.map((rec, idx) => {
                        const originalIndex = mapalRecords.findIndex((r) => r === rec);
                        return (
                          <tr key={rec.id || idx} className="hover:bg-emerald-50/30 transition-colors">
                            <td className="p-2 pl-3 font-semibold text-stone-800 whitespace-nowrap">
                              {rec.date}
                            </td>
                            <td className="p-2 font-bold text-stone-600">
                              {rec.day_of_week}
                            </td>
                            <td className="p-2 font-bold text-stone-900 flex items-center gap-1.5">
                              {rec.employee}
                              {rec.is_manager && (
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300">
                                  MGR
                                </span>
                              )}
                            </td>
                            <td className="p-2 text-stone-600 text-[11px]">
                              {rec.category || 'Barista'}
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                step="0.25"
                                min="0"
                                max="24"
                                value={rec.computable_time}
                                onChange={(e) =>
                                  handleMapalHoursChange(originalIndex, parseFloat(e.target.value) || 0)
                                }
                                className="w-20 px-2 py-1 rounded-lg border border-stone-300 text-xs font-bold text-[#006241] bg-white hover:border-[#006241] focus:border-[#006241] outline-hidden"
                              />
                            </td>
                            <td className="p-2 text-stone-600 text-[11px] truncate max-w-[160px]" title={rec.unit_name}>
                              {rec.unit_code === '18120' || rec.unit_name.includes('Janki') ? (
                                <span className="text-[#006241] font-semibold">108120 Janki</span>
                              ) : (
                                <span className="text-blue-700 font-semibold">{rec.unit_name}</span>
                              )}
                            </td>
                            <td className="p-2 pr-3 text-center">
                              <button
                                onClick={() => handleRemoveMapalRecord(originalIndex)}
                                title="Usuń ten wpis"
                                className="p-1 rounded-md text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* KROK 3: SUKCES */}
          {stage === 'SUCCESS' && (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#E8F5E9] text-[#006241] border border-[#C8E6C9] flex items-center justify-center mx-auto shadow-sm animate-in zoom-in-50 duration-200">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div>
                <h4 className="text-lg font-black text-[#1E3932]">
                  Dane zostały pomyślnie zaimportowane!
                </h4>
                <p className="text-xs text-[#5C6F68] mt-1 max-w-md mx-auto">
                  {successMessage}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Dolny Pasek Akcji */}
        <div className="px-6 py-3.5 border-t border-[#E2E8E5] bg-[#F7F9F8] flex items-center justify-between shrink-0">
          {stage === 'DROPZONE' && (
            <div className="text-xs text-stone-500 font-medium">
              Wybierz plik Excel, aby przejść do podglądu danych
            </div>
          )}

          {(stage === 'PREVIEW_AOP' || stage === 'PREVIEW_MAPAL') && (
            <button
              onClick={resetState}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-stone-700 hover:bg-stone-200 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Wybierz inny plik</span>
            </button>
          )}

          {stage === 'PREVIEW_AOP' && (
            <button
              onClick={handleCommitAop}
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#006241] hover:bg-[#00754A] text-white transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Zatwierdź i Zapisz Plan AOP ({aopMonths.length} mies.)</span>
            </button>
          )}

          {stage === 'PREVIEW_MAPAL' && (
            <button
              onClick={handleCommitMapal}
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#006241] hover:bg-[#00754A] text-white transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Zatwierdź i Zaimportuj Logowania ({mapalRecords.length})</span>
            </button>
          )}

          {stage === 'SUCCESS' && (
            <button
              onClick={handleClose}
              className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#006241] hover:bg-[#00754A] text-white transition-colors cursor-pointer shadow-xs"
            >
              <Check className="w-4 h-4" />
              <span>Gotowe / Zamknij</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
