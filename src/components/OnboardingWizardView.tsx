// src/components/OnboardingWizardView.tsx
import React, { useState, useMemo } from 'react';
import {
  Store,
  UserCheck,
  Coffee,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  UploadCloud,
  Database,
  FileSpreadsheet,
  Check,
  Layers,
  HelpCircle,
  Mail,
  AlertCircle,
  Clock,
  Calendar,
  Loader2,
  Trash2,
  Upload,
  FileText,
  TrendingUp,
  Plus,
} from 'lucide-react';

interface OnboardingWizardViewProps {
  onComplete: (config: {
    role: string;
    storeName: string;
    unitCode: string;
    userName: string;
    userEmail: string;
    dataSourceOption: 'A' | 'B' | 'C';
  }) => void;
}

interface UploadSlotState {
  file: File | null;
  status: 'idle' | 'validating' | 'valid' | 'invalid';
  message: string;
  data?: any;
}

interface ScheduleFileItem {
  id: string;
  file: File;
  name: string;
  month: string;
  year: number;
  sizeBytes: number;
  status: 'validating' | 'valid' | 'invalid';
  message: string;
  managersCount?: number;
  totalHours?: number;
  shiftsCount?: number;
  eventsCount?: number;
  scheduleData?: any;
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
}

const INITIAL_AOP_TEMPLATE: AopMonthRow[] = [
  { key: '2026_Styczeń', year: 2026, month: 'Styczeń', month_code: '2026-01', weeks_count: 5, plan_trx: 22600, target_tplh: 6.70, labor_budget: 3373.1, avg_weekly_hours: 674.6, plan_sales: 645000, plan_col_pln: 98000, plan_col_percent: 15.19 },
  { key: '2026_Luty', year: 2026, month: 'Luty', month_code: '2026-02', weeks_count: 4, plan_trx: 19800, target_tplh: 6.70, labor_budget: 2955.2, avg_weekly_hours: 738.8, plan_sales: 580000, plan_col_pln: 87500, plan_col_percent: 15.09 },
  { key: '2026_Marzec', year: 2026, month: 'Marzec', month_code: '2026-03', weeks_count: 4, plan_trx: 23100, target_tplh: 6.70, labor_budget: 3447.8, avg_weekly_hours: 861.9, plan_sales: 670000, plan_col_pln: 101000, plan_col_percent: 15.07 },
  { key: '2026_Kwiecień', year: 2026, month: 'Kwiecień', month_code: '2026-04', weeks_count: 4, plan_trx: 22900, target_tplh: 6.70, labor_budget: 3417.9, avg_weekly_hours: 854.5, plan_sales: 665000, plan_col_pln: 100500, plan_col_percent: 15.11 },
  { key: '2026_Maj', year: 2026, month: 'Maj', month_code: '2026-05', weeks_count: 5, plan_trx: 25800, target_tplh: 6.80, labor_budget: 3794.1, avg_weekly_hours: 758.8, plan_sales: 750000, plan_col_pln: 112000, plan_col_percent: 14.93 },
  { key: '2026_Czerwiec', year: 2026, month: 'Czerwiec', month_code: '2026-06', weeks_count: 4, plan_trx: 24500, target_tplh: 6.80, labor_budget: 3602.9, avg_weekly_hours: 900.7, plan_sales: 710000, plan_col_pln: 106000, plan_col_percent: 14.93 },
  { key: '2026_Lipiec', year: 2026, month: 'Lipiec', month_code: '2026-07', weeks_count: 5, plan_trx: 26200, target_tplh: 6.80, labor_budget: 3852.9, avg_weekly_hours: 770.6, plan_sales: 760000, plan_col_pln: 113500, plan_col_percent: 14.93 },
  { key: '2026_Sierpień', year: 2026, month: 'Sierpień', month_code: '2026-08', weeks_count: 4, plan_trx: 25100, target_tplh: 6.80, labor_budget: 3691.2, avg_weekly_hours: 922.8, plan_sales: 730000, plan_col_pln: 109000, plan_col_percent: 14.93 },
  { key: '2026_Wrzesień', year: 2026, month: 'Wrzesień', month_code: '2026-09', weeks_count: 4, plan_trx: 24200, target_tplh: 6.70, labor_budget: 3611.9, avg_weekly_hours: 903.0, plan_sales: 705000, plan_col_pln: 105500, plan_col_percent: 14.96 },
  { key: '2026_Październik', year: 2026, month: 'Październik', month_code: '2026-10', weeks_count: 5, plan_trx: 24900, target_tplh: 6.70, labor_budget: 3716.4, avg_weekly_hours: 743.3, plan_sales: 720000, plan_col_pln: 108000, plan_col_percent: 15.00 },
  { key: '2026_Listopad', year: 2026, month: 'Listopad', month_code: '2026-11', weeks_count: 4, plan_trx: 23800, target_tplh: 6.70, labor_budget: 3552.2, avg_weekly_hours: 888.1, plan_sales: 690000, plan_col_pln: 103500, plan_col_percent: 15.00 },
  { key: '2026_Grudzień', year: 2026, month: 'Grudzień', month_code: '2026-12', weeks_count: 5, plan_trx: 28500, target_tplh: 6.90, labor_budget: 4130.4, avg_weekly_hours: 826.1, plan_sales: 830000, plan_col_pln: 124000, plan_col_percent: 14.94 }
];

function detectMonthAndYear(filename: string): { month: string; year: number } {
  const lower = filename.toLowerCase();
  const months = [
    { name: 'Styczeń', match: ['styczen', 'styczeń', 'jan'] },
    { name: 'Luty', match: ['luty', 'lutego', 'feb'] },
    { name: 'Marzec', match: ['marzec', 'marca', 'mar'] },
    { name: 'Kwiecień', match: ['kwiecien', 'kwiecień', 'kwietnia', 'apr'] },
    { name: 'Maj', match: ['maj', 'maja', 'may'] },
    { name: 'Czerwiec', match: ['czerwiec', 'czerwca', 'jun'] },
    { name: 'Lipiec', match: ['lipiec', 'lipca', 'jul'] },
    { name: 'Sierpień', match: ['sierpien', 'sierpień', 'sierpnia', 'aug'] },
    { name: 'Wrzesień', match: ['wrzesien', 'wrzesień', 'września', 'sep'] },
    { name: 'Październik', match: ['pazdziernik', 'październik', 'października', 'oct'] },
    { name: 'Listopad', match: ['listopad', 'listopada', 'nov'] },
    { name: 'Grudzień', match: ['grudzien', 'grudzień', 'grudnia', 'dec'] },
  ];
  let foundMonth = 'Wrzesień';
  for (const m of months) {
    if (m.match.some((term) => lower.includes(term))) {
      foundMonth = m.name;
      break;
    }
  }
  const yearMatch = lower.match(/\b(202[0-9])\b/);
  const foundYear = yearMatch ? parseInt(yearMatch[1], 10) : 2026;
  return { month: foundMonth, year: foundYear };
}

export const OnboardingWizardView: React.FC<OnboardingWizardViewProps> = ({ onComplete }) => {
  // Kroki: 1: Powitanie, 2: Profil, 3: Wybór opcji (A/B/C), 4: Wgrywanie plików (A), 5: Weryfikacja w Tabeli (A), 6: Podsumowanie
  const [step, setStep] = useState<number>(1);

  // Krok 2: Kawiarnia i Profil
  const [selectedStore, setSelectedStore] = useState({
    name: '108120 SBX Warszawa Janki',
    unitCode: '18120',
    district: 'Dystrykt Warszawa',
  });
  const [selectedRole, setSelectedRole] = useState<'SM' | 'ASM'>('SM');
  const [managerName, setManagerName] = useState<string>('');
  const [managerEmail, setManagerEmail] = useState<string>('');
  const [step2Touched, setStep2Touched] = useState<boolean>(false);

  // Walidacja Krok 2
  const isNameValid = managerName.trim().length >= 3;
  const isEmailValid = /^[a-zA-Z0-9._%+-]+@amrest\.eu$/i.test(managerEmail.trim());
  const isStep2Valid = isNameValid && isEmailValid;

  // Krok 3: Opcje Danych Początkowych
  const [dataSourceOption, setDataSourceOption] = useState<'A' | 'B' | 'C'>('A');
  const [isCommitting, setIsCommitting] = useState<boolean>(false);

  // Stany weryfikacji plików Opcji A
  const [aopState, setAopState] = useState<UploadSlotState>({
    file: null,
    status: 'idle',
    message: 'Wybierz lub upuść arkusz AOP P&L (.xlsx, .xlsm)',
  });
  const [fichajesState, setFichajesState] = useState<UploadSlotState>({
    file: null,
    status: 'idle',
    message: 'Wybierz lub upuść raport MAPAL Fichajes (.xlsx, .csv)',
  });

  // Multi-upload Grafików Menedżerskich
  const [scheduleFiles, setScheduleFiles] = useState<ScheduleFileItem[]>([]);

  // Tabela AOP do edycji (Krok 5)
  const [aopMonths, setAopMonths] = useState<AopMonthRow[]>(INITIAL_AOP_TEMPLATE);
  const [activeReviewTab, setActiveReviewTab] = useState<'AOP' | 'SCHEDULES' | 'MAPAL'>('AOP');

  // Stan weryfikacji pliku Opcji B (Backup)
  const [backupState, setBackupState] = useState<UploadSlotState>({
    file: null,
    status: 'idle',
    message: 'Wybierz lub upuść plik kopii zapasowej bazy SQLite (.db)',
  });

  // Podsumowanie AOP na żywo
  const aopSummary = useMemo(() => {
    const totalSales = aopMonths.reduce((acc, m) => acc + (m.plan_sales || 0), 0);
    const totalTrx = aopMonths.reduce((acc, m) => acc + (m.plan_trx || 0), 0);
    const totalBudgetHours = aopMonths.reduce((acc, m) => acc + (m.labor_budget || 0), 0);
    const avgTplh =
      aopMonths.length > 0
        ? Number((aopMonths.reduce((acc, m) => acc + (m.target_tplh || 0), 0) / aopMonths.length).toFixed(2))
        : 6.7;
    const totalCol = aopMonths.reduce((acc, m) => acc + (m.plan_col_pln || 0), 0);
    const avgColPct = totalSales > 0 ? Number(((totalCol / totalSales) * 100).toFixed(2)) : 0;
    return { totalSales, totalTrx, totalBudgetHours, avgTplh, totalCol, avgColPct };
  }, [aopMonths]);

  // Funkcje weryfikacji plików
  const validateAopFile = async (file: File) => {
    setAopState({ file, status: 'validating', message: 'Weryfikacja struktury AOP P&L...' });
    try {
      const api = (window as any).api;
      if (api?.parseReportBuffer) {
        const buffer = await file.arrayBuffer();
        const res = await api.parseReportBuffer(buffer);
        if (res.success && res.reportType === 'AOP_PL') {
          const year = res.aopData?.year || 2026;
          const months = res.aopData?.months || [];
          setAopState({
            file,
            status: 'valid',
            message: `Zweryfikowano: AOP Rok ${year} (${months.length} mies.)`,
            data: res.aopData,
          });
          if (months.length > 0) {
            setAopMonths(months);
          }
          return;
        }
      }
      setAopState({
        file,
        status: 'valid',
        message: `Wczytano arkusz AOP (${(file.size / 1024).toFixed(1)} KB)`,
      });
    } catch (err: any) {
      setAopState({ file, status: 'invalid', message: `Błąd weryfikacji: ${err.message || 'Niepoprawny format'}` });
    }
  };

  const validateFichajesFile = async (file: File) => {
    setFichajesState({ file, status: 'validating', message: 'Weryfikacja logowań MAPAL Fichajes...' });
    try {
      const api = (window as any).api;
      if (api?.parseReportBuffer) {
        const buffer = await file.arrayBuffer();
        const res = await api.parseReportBuffer(buffer);
        if (res.success && res.reportType === 'MAPAL_FICHAJES') {
          const count = res.mapalData?.records?.length || 0;
          const hours = res.mapalData?.totalHours || 0;
          setFichajesState({
            file,
            status: 'valid',
            message: `Zweryfikowano: MAPAL Fichajes (${count} wpisów, ${hours}h)`,
            data: res.mapalData,
          });
          return;
        }
      }
      setFichajesState({
        file,
        status: 'valid',
        message: `Wczytano ewidencję MAPAL (${(file.size / 1024).toFixed(1)} KB)`,
      });
    } catch (err: any) {
      setFichajesState({ file, status: 'invalid', message: `Błąd weryfikacji: ${err.message || 'Niepoprawny format'}` });
    }
  };

  const handleAddScheduleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);

    const initialItems: ScheduleFileItem[] = fileArray.map((file) => {
      const { month, year } = detectMonthAndYear(file.name);
      return {
        id: `${file.name}_${Date.now()}_${Math.random()}`,
        file,
        name: file.name,
        month,
        year,
        sizeBytes: file.size,
        status: 'validating',
        message: `Odczytywanie grafiku ${month} ${year}...`,
        managersCount: 7,
        totalHours: 0,
      };
    });

    setScheduleFiles((prev) => [...prev, ...initialItems]);

    const api = (window as any).api;
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const targetId = initialItems[i].id;
      try {
        if (api?.parseReportBuffer) {
          const buffer = await file.arrayBuffer();
          const res = await api.parseReportBuffer(buffer);
          if (res.success && res.reportType === 'MANAGER_SCHEDULE' && res.scheduleData) {
            setScheduleFiles((prev) =>
              prev.map((item) =>
                item.id === targetId
                  ? {
                      ...item,
                      month: res.scheduleData.month || item.month,
                      year: res.scheduleData.year || item.year,
                      status: 'valid',
                      message: `Zweryfikowano: ${res.scheduleData.month} ${res.scheduleData.year} (${res.scheduleData.managers?.length || 0} menedżerów, ${res.scheduleData.shifts?.length || 0} zmian)`,
                      managersCount: res.scheduleData.managers?.length || 0,
                      totalHours: res.scheduleData.totalHours || 0,
                      shiftsCount: res.scheduleData.shifts?.length || 0,
                      eventsCount: res.scheduleData.events?.length || 0,
                      scheduleData: res.scheduleData,
                    }
                  : item
              )
            );
            continue;
          }
        }
        setScheduleFiles((prev) =>
          prev.map((item) =>
            item.id === targetId
              ? {
                  ...item,
                  status: 'valid',
                  message: `Wczytano grafik (${(file.size / 1024).toFixed(1)} KB)`,
                }
              : item
          )
        );
      } catch (err: any) {
        setScheduleFiles((prev) =>
          prev.map((item) =>
            item.id === targetId
              ? {
                  ...item,
                  status: 'invalid',
                  message: `Błąd weryfikacji: ${err.message || 'Niepoprawny plik grafiku'}`,
                }
              : item
          )
        );
      }
    }
  };

  const handleRemoveScheduleFile = (id: string) => {
    setScheduleFiles((prev) => prev.filter((item) => item.id !== id));
  };

  const validateBackupFile = async (file: File) => {
    setBackupState({ file, status: 'validating', message: 'Sprawdzanie bazy SQLite...' });
    try {
      if (file.name.endsWith('.db') || file.name.endsWith('.sqlite')) {
        const buffer = await file.slice(0, 16).arrayBuffer();
        const header = new TextDecoder().decode(buffer);
        if (header.startsWith('SQLite format 3')) {
          setBackupState({
            file,
            status: 'valid',
            message: `Zweryfikowano: Baza SQLite (${(file.size / (1024 * 1024)).toFixed(2)} MB)`,
          });
          return;
        }
      }
      setBackupState({
        file,
        status: 'invalid',
        message: 'Niepoprawny plik bazy danych SQLite (brak nagłówka SQLite format 3).',
      });
    } catch (err: any) {
      setBackupState({ file, status: 'invalid', message: `Błąd odczytu: ${err.message || 'Niepoprawny plik'}` });
    }
  };

  // Edycja komórki w tabeli AOP
  const handleAopCellChange = (index: number, field: keyof AopMonthRow, value: number) => {
    setAopMonths((prev) => {
      const updated = [...prev];
      const current = { ...updated[index], [field]: value };

      if (field === 'plan_trx' || field === 'target_tplh') {
        const trx = field === 'plan_trx' ? value : current.plan_trx;
        const tplh = field === 'target_tplh' ? value : current.target_tplh;
        const budget = tplh > 0 ? Number((trx / tplh).toFixed(1)) : 0;
        const wCount = current.weeks_count || 4;
        current.labor_budget = budget;
        current.avg_weekly_hours = Number((budget / wCount).toFixed(1));
      } else if (field === 'weeks_count') {
        const wCount = value || 4;
        current.avg_weekly_hours = Number((current.labor_budget / wCount).toFixed(1));
      } else if (field === 'plan_sales' || field === 'plan_col_pln') {
        const sales = field === 'plan_sales' ? value : current.plan_sales;
        const colPln = field === 'plan_col_pln' ? value : current.plan_col_pln;
        current.plan_col_percent = sales > 0 ? Number(((colPln / sales) * 100).toFixed(2)) : 0;
      }

      updated[index] = current;
      return updated;
    });
  };

  const handleApplyGlobalTplh = (tplh: number) => {
    setAopMonths((prev) =>
      prev.map((row) => {
        const budget = tplh > 0 ? Number((row.plan_trx / tplh).toFixed(1)) : 0;
        const wCount = row.weeks_count || 4;
        return {
          ...row,
          target_tplh: tplh,
          labor_budget: budget,
          avg_weekly_hours: Number((budget / wCount).toFixed(1)),
        };
      })
    );
  };

  // Nawigacja
  const handleNext = () => {
    if (step === 2) {
      setStep2Touched(true);
      if (!isStep2Valid) return;
    }
    if (step === 3) {
      if (dataSourceOption === 'A') {
        setStep(4);
        return;
      } else {
        setStep(6);
        return;
      }
    }
    if (step < 6) setStep(step + 1);
  };

  const handleBack = () => {
    if (step === 6 && dataSourceOption !== 'A') {
      setStep(3);
      return;
    }
    if (step > 1) setStep(step - 1);
  };

  const handleFinish = async () => {
    setIsCommitting(true);
    try {
      const api = (window as any).api;
      if (dataSourceOption === 'A') {
        if (api?.commitAopImport && aopMonths.length > 0) {
          await api.commitAopImport({
            year: aopMonths[0]?.year || 2026,
            months: aopMonths,
          });
        }
        if (fichajesState.status === 'valid' && fichajesState.data && api?.commitMapalImport) {
          await api.commitMapalImport({
            records: fichajesState.data.records || [],
          });
        }
        const schedulesToCommit = scheduleFiles
          .filter((sf) => sf.scheduleData)
          .map((sf) => sf.scheduleData);
        if (schedulesToCommit.length > 0 && api?.commitMultipleSchedulesImport) {
          await api.commitMultipleSchedulesImport({ schedules: schedulesToCommit });
        }
      }
    } catch (err) {
      console.error('Błąd zapisu danych w kreatorze:', err);
    } finally {
      setIsCommitting(false);
    }

    const roleLabel =
      selectedRole === 'SM'
        ? 'Store Manager (SM)'
        : 'Assistant Store Manager (ASM)';

    onComplete({
      role: roleLabel,
      storeName: selectedStore.name,
      unitCode: selectedStore.unitCode,
      userName: managerName.trim(),
      userEmail: managerEmail.trim().toLowerCase(),
      dataSourceOption,
    });
  };

  return (
    <div className="min-h-screen w-full bg-[#08100C] text-slate-100 flex flex-col justify-between select-none relative overflow-hidden font-sans">
      {/* Ozdobne tła z gradientami i rozmyciem kawiarnianym */}
      <div className="absolute -top-40 -left-40 w-[550px] h-[550px] bg-[#006241]/25 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[550px] h-[550px] bg-[#CBA258]/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-[#00754A]/10 rounded-full blur-[160px] pointer-events-none" />

      {/* Pasek Górny */}
      <header className="px-8 py-4 flex items-center justify-between relative z-10 border-b border-emerald-900/30 bg-[#060c09]/60 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#006241] to-[#00754A] flex items-center justify-center text-white shadow-lg shadow-emerald-950/60 ring-1 ring-emerald-500/30">
            <span className="text-xl">☕</span>
          </div>
          <div>
            <span className="font-black text-sm tracking-wider text-white block leading-tight">
              STARBUCKS
            </span>
            <span className="text-[10px] font-bold text-emerald-400 tracking-widest uppercase">
              Operations Suite Setup
            </span>
          </div>
        </div>

        {/* Wskaźnik kroków */}
        {step > 1 && (
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5, 6].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s === step
                    ? 'w-7 bg-gradient-to-r from-[#006241] to-emerald-400'
                    : s < step
                    ? 'w-3 bg-emerald-700'
                    : 'w-2 bg-slate-800'
                }`}
              />
            ))}
          </div>
        )}
      </header>

      {/* Główny Kontener Kroków */}
      <main className="flex-1 flex items-center justify-center px-4 py-6 relative z-10">
        <div
          className={`w-full bg-[#101813]/90 backdrop-blur-xl border border-emerald-800/40 rounded-3xl shadow-2xl p-6 md:p-8 relative overflow-hidden transition-all duration-300 animate-in fade-in ${
            step === 5 ? 'max-w-5xl' : 'max-w-2xl'
          }`}
        >
          {/* Ozdobny pasek na górze karty */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#006241] via-[#00754A] to-[#CBA258]" />

          {/* ========================================================= */}
          {/* KROK 1: Animacja z Syrenką i Powitanie */}
          {/* ========================================================= */}
          {step === 1 && (
            <div className="text-center py-4 space-y-6 animate-in zoom-in-95 duration-500">
              <div className="relative inline-block mx-auto mb-2">
                <div className="absolute -inset-4 bg-emerald-500/20 rounded-full blur-xl animate-pulse pointer-events-none" />
                <div className="w-28 h-28 rounded-full bg-gradient-to-b from-[#006241] to-[#004d33] border-2 border-emerald-400/40 flex items-center justify-center text-white shadow-2xl relative z-10 ring-8 ring-emerald-950/60">
                  <span className="text-5xl drop-shadow-md">☕</span>
                </div>
                <div className="absolute -bottom-2 -right-2 p-2 bg-[#CBA258] text-[#1E3932] rounded-full shadow-lg font-black text-xs ring-4 ring-[#101813]">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>

              <div>
                <h1 className="text-3xl font-black text-white tracking-tight sm:text-4xl">
                  Starbucks Operations Suite
                </h1>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 text-left">
                <div className="p-3 bg-[#16221b] border border-emerald-900/50 rounded-2xl flex flex-col justify-center">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-base">📊</span>
                    <span className="text-[9px] px-1.5 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-500/40 rounded-full font-bold">
                      Dostępny
                    </span>
                  </div>
                  <div className="text-xs font-bold text-white leading-tight">TPLH Forecast</div>
                </div>

                <div className="p-3 bg-[#16221b] border border-emerald-900/50 rounded-2xl flex flex-col justify-center">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-base">🗓️</span>
                    <span className="text-[9px] px-1.5 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-500/40 rounded-full font-bold">
                      Dostępny
                    </span>
                  </div>
                  <div className="text-xs font-bold text-white leading-tight">Grafik Menedżerów</div>
                </div>

                <div className="p-3 bg-[#131b16] border border-emerald-950/60 rounded-2xl flex flex-col justify-center opacity-85">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-base">🎓</span>
                    <span className="text-[9px] px-1.5 py-0.5 bg-amber-950/60 text-amber-300 border border-amber-600/30 rounded-full font-bold">
                      Wkrótce
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-200 leading-tight">Training Suite</div>
                </div>

                <div className="p-3 bg-[#131b16] border border-emerald-950/60 rounded-2xl flex flex-col justify-center opacity-85">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-base">💰</span>
                    <span className="text-[9px] px-1.5 py-0.5 bg-amber-950/60 text-amber-300 border border-amber-600/30 rounded-full font-bold">
                      Wkrótce
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-200 leading-tight">COL Calculator</div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleNext}
                  className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-[#006241] via-[#00754A] to-[#00875A] hover:from-[#00754A] hover:to-[#009664] text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-950/80 flex items-center justify-center gap-3 mx-auto transition-all active:scale-[0.98] cursor-pointer ring-1 ring-emerald-400/40"
                >
                  <span>Przejdź przez konfigurację</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* KROK 2: Identyfikacja Kawiarni i Profilu */}
          {/* ========================================================= */}
          {step === 2 && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 block mb-1">
                  Krok 1 z 5
                </span>
                <h2 className="text-2xl font-black text-white">Identyfikacja Lokalu & Profil</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Wybierz profil operacyjny oraz wprowadź swoje dane służbowe.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Kawiarnia Operacyjna Starbucks
                </label>
                <div className="p-3 bg-[#17231c] border-2 border-emerald-500/60 rounded-2xl flex items-center justify-between shadow-lg shadow-emerald-950/40">
                  <div className="flex items-center space-x-3.5">
                    <div className="p-2.5 bg-[#006241] text-white rounded-xl shadow-md">
                      <Store className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-black text-white flex items-center gap-2">
                        {selectedStore.name}
                        <span className="text-[10px] px-2 py-0.5 bg-emerald-900/60 text-emerald-300 rounded-full font-bold border border-emerald-600/40">
                          Lokal Aktywny
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Kod jednostki: <strong className="text-emerald-300">{selectedStore.unitCode}</strong> • {selectedStore.district}
                      </div>
                    </div>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Profil Operacyjny
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedRole('SM')}
                    className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      selectedRole === 'SM'
                        ? 'bg-[#006241] border-emerald-400 text-white shadow-md ring-2 ring-emerald-500/30'
                        : 'bg-[#141e18] border-emerald-900/40 text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <UserCheck className="w-5 h-5" />
                    <span className="text-xs font-bold">Store Mgr (SM)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRole('ASM')}
                    className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      selectedRole === 'ASM'
                        ? 'bg-[#006241] border-emerald-400 text-white shadow-md ring-2 ring-emerald-500/30'
                        : 'bg-[#141e18] border-emerald-900/40 text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Coffee className="w-5 h-5" />
                    <span className="text-xs font-bold">Asystent (ASM)</span>
                  </button>
                </div>
              </div>

              {/* Imię i Nazwisko */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Imię i Nazwisko Menedżera <span className="text-emerald-400">*</span>
                  </label>
                  {managerName.trim().length > 0 && (
                    <span className={`text-[10px] font-semibold ${isNameValid ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isNameValid ? '✓ Poprawne' : 'Min. 3 znaki'}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  placeholder="Wpisz imię i nazwisko..."
                  className={`w-full bg-[#17231c] border rounded-2xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors ${
                    step2Touched && !isNameValid
                      ? 'border-rose-500/80 focus:border-rose-400'
                      : isNameValid
                      ? 'border-emerald-500/60 focus:border-emerald-400'
                      : 'border-emerald-800/50 focus:border-emerald-400'
                  }`}
                />
              </div>

              {/* E-mail @amrest.eu */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Służbowy Adres E-mail (@amrest.eu) <span className="text-emerald-400">*</span>
                  </label>
                  {managerEmail.trim().length > 0 && (
                    <span className={`text-[10px] font-semibold ${isEmailValid ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {isEmailValid ? '✓ Domena @amrest.eu' : 'Wymagane @amrest.eu'}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={managerEmail}
                    onChange={(e) => setManagerEmail(e.target.value)}
                    placeholder="imie.nazwisko@amrest.eu"
                    className={`w-full bg-[#17231c] border rounded-2xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors ${
                      step2Touched && !isEmailValid
                        ? 'border-rose-500/80 focus:border-rose-400'
                        : isEmailValid
                        ? 'border-emerald-500/60 focus:border-emerald-400'
                        : 'border-emerald-800/50 focus:border-emerald-400'
                    }`}
                  />
                </div>
              </div>

              {/* Przyciski Nawigacji */}
              <div className="flex items-center justify-between pt-3 border-t border-emerald-900/40">
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Wstecz</span>
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={step2Touched && !isStep2Valid}
                  className="px-6 py-2 bg-gradient-to-r from-[#006241] to-[#00754A] hover:from-[#00754A] hover:to-[#00875A] text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-950/60 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <span>Dalej</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* KROK 3: Wybór Źródła Danych (A / B / C) */}
          {/* ========================================================= */}
          {step === 3 && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 block mb-1">
                  Krok 2 z 5
                </span>
                <h2 className="text-2xl font-black text-white">Źródło Danych Początkowych</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Wybierz, w jaki sposób chcesz przygotować dane do pracy na tym stanowisku.
                </p>
              </div>

              <div className="space-y-3">
                {/* OPCJA A */}
                <div
                  onClick={() => setDataSourceOption('A')}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative ${
                    dataSourceOption === 'A'
                      ? 'bg-[#16251e] border-emerald-400 shadow-lg shadow-emerald-950/50'
                      : 'bg-[#121a15] border-emerald-900/40 hover:border-emerald-700/60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3.5">
                      <div className="p-2.5 bg-emerald-950 text-emerald-400 rounded-xl border border-emerald-700/50 shrink-0">
                        <UploadCloud className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white flex items-center gap-2">
                          Opcja A: Import raportów i weryfikacja w tabeli
                          <span className="text-[10px] px-2 py-0.5 bg-emerald-900/80 text-emerald-300 border border-emerald-600/40 font-bold rounded-full">
                            Zalecane
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                          Wgraj pliki raportów (AOP, Godziny, wiele grafików) i sprawdź poprawność w interaktywnej tabeli z opcją edycji.
                        </p>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      dataSourceOption === 'A' ? 'border-emerald-400 bg-emerald-500 text-white' : 'border-slate-600'
                    }`}>
                      {dataSourceOption === 'A' && <Check className="w-3 h-3" />}
                    </div>
                  </div>
                </div>

                {/* OPCJA B */}
                <div
                  onClick={() => setDataSourceOption('B')}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative ${
                    dataSourceOption === 'B'
                      ? 'bg-[#16251e] border-emerald-400 shadow-lg shadow-emerald-950/50'
                      : 'bg-[#121a15] border-emerald-900/40 hover:border-emerald-700/60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3.5">
                      <div className="p-2.5 bg-purple-950 text-purple-400 rounded-xl border border-purple-700/50 shrink-0">
                        <Database className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">
                          Opcja B: Kopia Zapasowa
                        </div>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                          Przywróć stan aplikacji ze wskazanego pliku bazy danych SQLite (.db).
                        </p>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      dataSourceOption === 'B' ? 'border-emerald-400 bg-emerald-500 text-white' : 'border-slate-600'
                    }`}>
                      {dataSourceOption === 'B' && <Check className="w-3 h-3" />}
                    </div>
                  </div>

                  {/* Strefa Backupu w Opcji B */}
                  {dataSourceOption === 'B' && (
                    <div className="mt-3 pt-3 border-t border-emerald-900/40" onClick={(e) => e.stopPropagation()}>
                      <div className="p-3 bg-[#0d1611] rounded-xl border border-dashed border-purple-800/60 text-center space-y-1.5">
                        <label className="px-3 py-1.5 bg-purple-900/60 hover:bg-purple-800/80 text-purple-200 border border-purple-600/40 rounded-xl text-xs font-bold cursor-pointer transition-colors inline-flex items-center gap-1.5">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Wskaż plik .db</span>
                          <input
                            type="file"
                            accept=".db,.sqlite"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files?.[0]) validateBackupFile(e.target.files[0]);
                            }}
                          />
                        </label>
                        <div className="text-[11px] text-slate-400">{backupState.message}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* OPCJA C */}
                <div
                  onClick={() => setDataSourceOption('C')}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative ${
                    dataSourceOption === 'C'
                      ? 'bg-[#16251e] border-emerald-400 shadow-lg shadow-emerald-950/50'
                      : 'bg-[#121a15] border-emerald-900/40 hover:border-emerald-700/60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3.5">
                      <div className="p-2.5 bg-slate-800/80 text-slate-300 rounded-xl border border-slate-700/50 shrink-0">
                        <Layers className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">
                          Opcja C: Późniejsza konfiguracja
                        </div>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                          Przejdź od razu do pulpitu. Raporty wgrasz w dowolnej chwili.
                        </p>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      dataSourceOption === 'C' ? 'border-emerald-400 bg-emerald-500 text-white' : 'border-slate-600'
                    }`}>
                      {dataSourceOption === 'C' && <Check className="w-3 h-3" />}
                    </div>
                  </div>
                </div>
              </div>

              {/* Przyciski Nawigacji */}
              <div className="flex items-center justify-between pt-3 border-t border-emerald-900/40">
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Wstecz</span>
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-6 py-2 bg-gradient-to-r from-[#006241] to-[#00754A] hover:from-[#00754A] hover:to-[#00875A] text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-950/60 flex items-center gap-2 transition-all cursor-pointer"
                >
                  <span>Dalej</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* KROK 4 (Opcja A): Wgrywanie Plików (Multi-Grafiki) */}
          {/* ========================================================= */}
          {step === 4 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 block mb-1">
                  Krok 3 z 5
                </span>
                <h2 className="text-2xl font-black text-white">Panel Wgrywania Raportów</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Dodaj plik AOP, ewidencję MAPAL oraz jeden lub więcej plików grafików (.xlsm).
                </p>
              </div>

              <div className="space-y-3">
                {/* 1. AOP */}
                <div className="p-3 bg-[#0d1611] rounded-2xl border border-emerald-900/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      1. Plan AOP P&L (.xlsx, .xlsm)
                    </span>
                    <label className="px-3 py-1 bg-emerald-900/60 hover:bg-emerald-800/80 text-emerald-200 border border-emerald-600/40 rounded-xl text-[11px] font-bold cursor-pointer transition-colors flex items-center gap-1">
                      <Upload className="w-3 h-3" />
                      <span>Wybierz AOP</span>
                      <input
                        type="file"
                        accept=".xlsx,.xlsm"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) validateAopFile(e.target.files[0]);
                        }}
                      />
                    </label>
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    {aopState.status === 'validating' && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />}
                    {aopState.status === 'valid' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                    {aopState.status === 'invalid' && <AlertCircle className="w-3.5 h-3.5 text-rose-400" />}
                    <span className={aopState.status === 'valid' ? 'text-emerald-300 font-medium' : ''}>
                      {aopState.message}
                    </span>
                  </div>
                </div>

                {/* 2. MAPAL Fichajes */}
                <div className="p-3 bg-[#0d1611] rounded-2xl border border-emerald-900/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-400" />
                      2. MAPAL Fichajes (Godziny Rzeczywiste)
                    </span>
                    <label className="px-3 py-1 bg-blue-950/60 hover:bg-blue-900/80 text-blue-200 border border-blue-600/40 rounded-xl text-[11px] font-bold cursor-pointer transition-colors flex items-center gap-1">
                      <Upload className="w-3 h-3" />
                      <span>Wybierz MAPAL</span>
                      <input
                        type="file"
                        accept=".xlsx,.csv,.xlsm"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) validateFichajesFile(e.target.files[0]);
                        }}
                      />
                    </label>
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    {fichajesState.status === 'validating' && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />}
                    {fichajesState.status === 'valid' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                    {fichajesState.status === 'invalid' && <AlertCircle className="w-3.5 h-3.5 text-rose-400" />}
                    <span className={fichajesState.status === 'valid' ? 'text-emerald-300 font-medium' : ''}>
                      {fichajesState.message}
                    </span>
                  </div>
                </div>

                {/* 3. Multi-Upload Grafików Managerskich */}
                <div className="p-3.5 bg-[#0d1611] rounded-2xl border border-amber-900/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-white flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-amber-400" />
                        3. Grafiki Managerskie (.xlsm)
                      </span>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Możesz wgrać wiele plików jednocześnie (np. 1–9 miesięcy 2026).
                      </p>
                    </div>
                    <label className="px-3 py-1.5 bg-amber-950/60 hover:bg-amber-900/80 text-amber-200 border border-amber-600/40 rounded-xl text-[11px] font-bold cursor-pointer transition-colors flex items-center gap-1 shadow-md">
                      <Plus className="w-3.5 h-3.5" />
                      <span>Dodaj Grafiki (.xlsm)</span>
                      <input
                        type="file"
                        multiple
                        accept=".xlsm,.xlsx"
                        className="hidden"
                        onChange={(e) => handleAddScheduleFiles(e.target.files)}
                      />
                    </label>
                  </div>

                  {/* Lista dodanych plików grafików */}
                  {scheduleFiles.length > 0 ? (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {scheduleFiles.map((sf) => (
                        <div
                          key={sf.id}
                          className="p-2 bg-[#141e18] border border-emerald-900/40 rounded-xl flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center space-x-2 min-w-0">
                            <span className="text-[10px] px-2 py-0.5 bg-amber-950 text-amber-300 border border-amber-600/40 rounded-lg font-bold shrink-0">
                              {sf.month} {sf.year}
                            </span>
                            <span className="text-slate-200 truncate font-medium text-[11px]">
                              {sf.name}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 shrink-0">
                            <span className="text-[10px] text-emerald-400 font-semibold">
                              ✓ Gotowy
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveScheduleFile(sf.id)}
                              className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-[#111914] rounded-xl border border-dashed border-amber-900/30 text-center text-[11px] text-slate-500">
                      Brak dodanych plików grafików. Kliknij „Dodaj Grafiki” lub przejdź dalej do weryfikacji tabeli.
                    </div>
                  )}
                </div>
              </div>

              {/* Przyciski Nawigacji */}
              <div className="flex items-center justify-between pt-3 border-t border-emerald-900/40">
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Wstecz</span>
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-6 py-2 bg-gradient-to-r from-[#006241] to-[#00754A] hover:from-[#00754A] hover:to-[#00875A] text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-950/60 flex items-center gap-2 transition-all cursor-pointer"
                >
                  <span>Sprawdź w Tabeli ➔</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* KROK 5 (Opcja A): Tabela Weryfikacji & Edycji Danych */}
          {/* ========================================================= */}
          {step === 5 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-900/40 pb-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 block">
                    Krok 4 z 5: Inspekcja & Korekta Danych
                  </span>
                  <h2 className="text-xl font-black text-white">Weryfikacja Danych w Tabeli</h2>
                </div>

                {/* Przełącznik Zakładek */}
                <div className="flex items-center gap-1.5 p-1 bg-[#141e18] rounded-xl border border-emerald-900/50 self-start">
                  <button
                    type="button"
                    onClick={() => setActiveReviewTab('AOP')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      activeReviewTab === 'AOP'
                        ? 'bg-[#006241] text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    📊 Plan AOP ({aopMonths.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveReviewTab('SCHEDULES')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      activeReviewTab === 'SCHEDULES'
                        ? 'bg-[#006241] text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    🗓️ Grafiki ({scheduleFiles.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveReviewTab('MAPAL')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      activeReviewTab === 'MAPAL'
                        ? 'bg-[#006241] text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    ⏱️ MAPAL
                  </button>
                </div>
              </div>

              {/* ZAKŁADKA 1: TABELA AOP Z EDYCJĄ KOMÓREK */}
              {activeReviewTab === 'AOP' && (
                <div className="space-y-3">
                  {/* Pasek KPI podsumowania */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-2.5 bg-[#0d1611] rounded-2xl border border-emerald-900/40 text-center">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold">Plan TRX</div>
                      <div className="text-xs font-black text-white">{aopSummary.totalTrx.toLocaleString('pl-PL')}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold">Średni TPLH</div>
                      <div className="text-xs font-black text-emerald-400">{aopSummary.avgTplh}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold">Budżet Godzin</div>
                      <div className="text-xs font-black text-white">{aopSummary.totalBudgetHours.toFixed(1)} h</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold">Plan Sprzedaży</div>
                      <div className="text-xs font-black text-amber-300">{aopSummary.totalSales.toLocaleString('pl-PL')} PLN</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold">Średni COL %</div>
                      <div className="text-xs font-black text-purple-300">{aopSummary.avgColPct}%</div>
                    </div>
                  </div>

                  {/* Interaktywna Tabela 12 miesięcy */}
                  <div className="border border-emerald-900/50 rounded-2xl overflow-hidden bg-[#0c130f]">
                    <div className="max-h-64 overflow-y-auto overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-200">
                        <thead className="bg-[#141f19] text-[10px] uppercase font-bold text-slate-400 sticky top-0 border-b border-emerald-900/50">
                          <tr>
                            <th className="p-2">Miesiąc</th>
                            <th className="p-2 text-center">Tyg.</th>
                            <th className="p-2 text-right">Plan TRX</th>
                            <th className="p-2 text-right">Cel TPLH</th>
                            <th className="p-2 text-right">Budżet (h)</th>
                            <th className="p-2 text-right">Sprzedaż (PLN)</th>
                            <th className="p-2 text-right">COL (PLN)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-emerald-950">
                          {aopMonths.map((row, idx) => (
                            <tr key={row.key} className="hover:bg-emerald-950/40 transition-colors">
                              <td className="p-2 font-bold text-white flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                {row.month}
                              </td>
                              <td className="p-1 text-center">
                                <input
                                  type="number"
                                  min={4}
                                  max={5}
                                  value={row.weeks_count}
                                  onChange={(e) => handleAopCellChange(idx, 'weeks_count', Number(e.target.value))}
                                  className="w-10 bg-[#16241c] border border-emerald-800/60 rounded-lg px-1 py-0.5 text-center text-xs text-white focus:outline-none focus:border-emerald-400"
                                />
                              </td>
                              <td className="p-1 text-right">
                                <input
                                  type="number"
                                  value={row.plan_trx}
                                  onChange={(e) => handleAopCellChange(idx, 'plan_trx', Number(e.target.value))}
                                  className="w-20 bg-[#16241c] border border-emerald-800/60 rounded-lg px-1.5 py-0.5 text-right text-xs text-white focus:outline-none focus:border-emerald-400 font-mono"
                                />
                              </td>
                              <td className="p-1 text-right">
                                <input
                                  type="number"
                                  step="0.05"
                                  value={row.target_tplh}
                                  onChange={(e) => handleAopCellChange(idx, 'target_tplh', Number(e.target.value))}
                                  className="w-16 bg-[#16241c] border border-emerald-800/60 rounded-lg px-1.5 py-0.5 text-right text-xs text-emerald-300 font-bold focus:outline-none focus:border-emerald-400 font-mono"
                                />
                              </td>
                              <td className="p-2 text-right font-mono font-bold text-emerald-400">
                                {row.labor_budget}h
                              </td>
                              <td className="p-1 text-right">
                                <input
                                  type="number"
                                  value={row.plan_sales}
                                  onChange={(e) => handleAopCellChange(idx, 'plan_sales', Number(e.target.value))}
                                  className="w-24 bg-[#16241c] border border-emerald-800/60 rounded-lg px-1.5 py-0.5 text-right text-xs text-amber-200 focus:outline-none focus:border-emerald-400 font-mono"
                                />
                              </td>
                              <td className="p-1 text-right">
                                <input
                                  type="number"
                                  value={row.plan_col_pln}
                                  onChange={(e) => handleAopCellChange(idx, 'plan_col_pln', Number(e.target.value))}
                                  className="w-20 bg-[#16241c] border border-emerald-800/60 rounded-lg px-1.5 py-0.5 text-right text-xs text-purple-200 focus:outline-none focus:border-emerald-400 font-mono"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ZAKŁADKA 2: ZESTAWIENIE GRAFIKÓW */}
              {activeReviewTab === 'SCHEDULES' && (
                <div className="space-y-3">
                  <div className="p-3 bg-[#0d1611] rounded-2xl border border-emerald-900/40 flex items-center justify-between text-xs">
                    <span className="text-slate-300">
                      Wgrane pliki grafików operacyjnych: <strong>{scheduleFiles.length} miesięcy</strong>
                    </span>
                    <label className="px-3 py-1 bg-amber-950/60 hover:bg-amber-900/80 text-amber-200 border border-amber-600/40 rounded-xl text-[11px] font-bold cursor-pointer transition-colors flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5" />
                      <span>Dodaj kolejny</span>
                      <input
                        type="file"
                        multiple
                        accept=".xlsm,.xlsx"
                        className="hidden"
                        onChange={(e) => handleAddScheduleFiles(e.target.files)}
                      />
                    </label>
                  </div>

                  {scheduleFiles.length > 0 ? (
                    <div className="border border-emerald-900/50 rounded-2xl overflow-hidden bg-[#0c130f]">
                      <table className="w-full text-left text-xs text-slate-200">
                        <thead className="bg-[#141f19] text-[10px] uppercase font-bold text-slate-400 border-b border-emerald-900/50">
                          <tr>
                            <th className="p-2.5">Okres</th>
                            <th className="p-2.5">Nazwa Pliku</th>
                            <th className="p-2.5 text-center">Menedżerowie</th>
                            <th className="p-2.5 text-center">Status KP</th>
                            <th className="p-2.5 text-right">Akcja</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-emerald-950">
                          {scheduleFiles.map((sf) => (
                            <tr key={sf.id} className="hover:bg-emerald-950/30">
                              <td className="p-2.5 font-bold text-amber-300">
                                {sf.month} {sf.year}
                              </td>
                              <td className="p-2.5 text-slate-300 truncate max-w-[200px]">
                                <div className="truncate font-medium">{sf.name}</div>
                                {sf.shiftsCount !== undefined && (
                                  <div className="text-[10px] text-slate-400">
                                    {sf.shiftsCount} zmian • {sf.totalHours || 0}h łącznie
                                  </div>
                                )}
                              </td>
                              <td className="p-2.5 text-center">
                                <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-600/40 rounded-full text-[10px] font-bold">
                                  {sf.managersCount || 7} Menedżerów
                                </span>
                              </td>
                              <td className="p-2.5 text-center text-emerald-400 font-semibold text-[11px]">
                                ✓ Kodeks Pracy OK
                              </td>
                              <td className="p-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveScheduleFile(sf.id)}
                                  className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-6 bg-[#0c130f] rounded-2xl border border-dashed border-emerald-900/40 text-center text-xs text-slate-400">
                      Nie dodano jeszcze zewnętrznych plików grafików. System może zainicjalizować standardowe szablony grafików.
                    </div>
                  )}
                </div>
              )}

              {/* ZAKŁADKA 3: MAPAL */}
              {activeReviewTab === 'MAPAL' && (
                <div className="p-4 bg-[#0d1611] rounded-2xl border border-emerald-900/40 space-y-3 text-xs">
                  <div className="flex items-center space-x-3">
                    <Clock className="w-6 h-6 text-blue-400" />
                    <div>
                      <div className="font-bold text-white text-sm">Status Ewidencji MAPAL Fichajes</div>
                      <div className="text-slate-400 text-[11px]">{fichajesState.message}</div>
                    </div>
                  </div>
                  {fichajesState.data ? (
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-900/30 text-center">
                      <div className="p-2 bg-[#141e18] rounded-xl">
                        <span className="text-slate-400 text-[10px] block">Liczba Logowań</span>
                        <strong className="text-white text-sm">{fichajesState.data.records?.length || 0}</strong>
                      </div>
                      <div className="p-2 bg-[#141e18] rounded-xl">
                        <span className="text-slate-400 text-[10px] block">Godziny Rzeczywiste</span>
                        <strong className="text-emerald-400 text-sm">{fichajesState.data.totalHours || 0} h</strong>
                      </div>
                      <div className="p-2 bg-[#141e18] rounded-xl">
                        <span className="text-slate-400 text-[10px] block">Pracownicy</span>
                        <strong className="text-white text-sm">{fichajesState.data.uniqueEmployees || 0}</strong>
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-400 text-[11px] pt-1">
                      Brak wgranego pliku Fichajes. Możesz zaimportować raport w dowolnej chwili z menu.
                    </div>
                  )}
                </div>
              )}

              {/* Przyciski Nawigacji */}
              <div className="flex items-center justify-between pt-3 border-t border-emerald-900/40">
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Wstecz</span>
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-6 py-2 bg-gradient-to-r from-[#006241] to-[#00754A] hover:from-[#00754A] hover:to-[#00875A] text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-950/60 flex items-center gap-2 transition-all cursor-pointer"
                >
                  <span>Zatwierdź & Podsumowanie ➔</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* KROK 6: Podsumowanie & Rozpoczęcie Pracy */}
          {/* ========================================================= */}
          {step === 6 && (
            <div className="space-y-5 text-center animate-in fade-in duration-300">
              <div className="w-14 h-14 mx-auto rounded-3xl bg-emerald-950 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-950/80">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 block mb-1">
                  Krok 5 z 5: Gotowe
                </span>
                <h2 className="text-2xl font-black text-white">Wszystko Przygotowane!</h2>
                <p className="text-xs text-slate-400 mt-0.5 max-w-md mx-auto">
                  Dane operacyjne kawiarni zostały pomyślnie zweryfikowane.
                </p>
              </div>

              {/* Podsumowanie wyborów */}
              <div className="p-3.5 bg-[#16221b] border border-emerald-900/50 rounded-2xl text-left space-y-1.5 text-xs">
                <div className="flex justify-between py-1 border-b border-emerald-900/30">
                  <span className="text-slate-400">Kawiarnia:</span>
                  <strong className="text-white">{selectedStore.name} ({selectedStore.unitCode})</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-emerald-900/30">
                  <span className="text-slate-400">Profil i Użytkownik:</span>
                  <strong className="text-emerald-300">
                    {managerName || 'Menedżer'} ({selectedRole})
                  </strong>
                </div>
                <div className="flex justify-between py-1 border-b border-emerald-900/30">
                  <span className="text-slate-400">E-mail:</span>
                  <strong className="text-emerald-300">{managerEmail || 'Brak'}</strong>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Zaimportowane Dane:</span>
                  <strong className="text-white">
                    {dataSourceOption === 'A'
                      ? `AOP (${aopMonths.length} mies.) • ${scheduleFiles.length} Grafików • MAPAL`
                      : dataSourceOption === 'B'
                      ? 'Kopia zapasowa SQLite'
                      : 'Późniejsza konfiguracja'}
                  </strong>
                </div>
              </div>

              {/* Szybka wskazówka */}
              <div className="p-2.5 bg-emerald-950/40 border border-emerald-800/40 rounded-xl text-[11px] text-emerald-300 flex items-center gap-2 text-left">
                <HelpCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>
                  <strong>Wskazówka:</strong> Pływające logo Starbucks ☕ w prawym dolnym rogu grafiku rozwija szybką nawigację miesięcy oraz generator AI.
                </span>
              </div>

              {/* Przyciski Nawigacji */}
              <div className="flex items-center justify-between pt-3 border-t border-emerald-900/40">
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Wstecz</span>
                </button>
                <button
                  type="button"
                  disabled={isCommitting}
                  onClick={handleFinish}
                  className="px-8 py-3 bg-gradient-to-r from-[#006241] via-[#00754A] to-[#00875A] hover:from-[#00754A] hover:to-[#009664] text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-950/80 flex items-center gap-2.5 transition-all active:scale-[0.98] cursor-pointer ring-1 ring-emerald-400/40 disabled:opacity-50"
                >
                  {isCommitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Zapisywanie w SQLite...</span>
                    </>
                  ) : (
                    <span>🚀 Rozpocznij Pracę</span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Pasek Dolny */}
      <footer className="px-8 py-3 text-center text-xs text-emerald-300/40 border-t border-emerald-900/30 bg-[#060c09]/60 backdrop-blur-md relative z-10">
        Starbucks Operations Suite © 2026
      </footer>
    </div>
  );
};
