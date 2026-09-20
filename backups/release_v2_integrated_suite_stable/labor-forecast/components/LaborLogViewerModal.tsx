import React, { useEffect, useState, useMemo } from 'react';
import {
  X,
  Users,
  Search,
  Filter,
  FileSpreadsheet,
  RotateCcw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Calendar,
  Building2,
  Clock,
  UserCheck,
  ListFilter,
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface LaborLogViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  weekKey: string | null;
  weekLabel: string;
}

type SortField =
  | 'date'
  | 'day_of_week'
  | 'week'
  | 'employee'
  | 'category'
  | 'contract_type'
  | 'computable_time';

type EmployeeSortField =
  | 'employee'
  | 'category'
  | 'contract_type'
  | 'shifts_count'
  | 'total_hours'
  | 'avg_shift_hours'
  | 'labor_share';

export const LaborLogViewerModal: React.FC<LaborLogViewerModalProps> = ({
  isOpen,
  onClose,
  weekKey,
  weekLabel,
}) => {
  const [records, setRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Zakładka widoku: lista pojedynczych zmian vs podsumowanie pracowników
  const [activeTab, setActiveTab] = useState<'shifts' | 'employees'>('shifts');

  // Filtry
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedContractType, setSelectedContractType] = useState<string>('all');
  const [selectedWeek, setSelectedWeek] = useState<string>('all');

  // Sortowanie widoku pojedynczych zmian
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Sortowanie widoku podsumowania pracowników
  const [empSortField, setEmpSortField] = useState<EmployeeSortField>('total_hours');
  const [empSortDirection, setEmpSortDirection] = useState<'asc' | 'desc'>('desc');

  // Reset filtrów przy zmianie zakresu
  useEffect(() => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedContractType('all');
    setSelectedWeek('all');
    setSortField('date');
    setSortDirection('asc');
    setEmpSortField('total_hours');
    setEmpSortDirection('desc');
  }, [weekKey]);

  // Pobieranie rekordów z ochroną przed race condition
  useEffect(() => {
    if (!isOpen || !weekKey) return;

    let isCancelled = false;
    setIsLoading(true);

    if ((window as any).api?.getLaborRecords) {
      (window as any).api
        .getLaborRecords(weekKey)
        .then((data: any[]) => {
          if (!isCancelled) {
            setRecords(data || []);
            setIsLoading(false);
          }
        })
        .catch((err: any) => {
          if (!isCancelled) {
            console.error('Błąd pobierania logowań:', err);
            setIsLoading(false);
          }
        });
    } else {
      setIsLoading(false);
    }

    return () => {
      isCancelled = true;
    };
  }, [isOpen, weekKey]);

  const isMonthView = Boolean(weekKey && !weekKey.includes('_W'));

  // Kategorie z sumami godzin
  const categoryOptions = useMemo(() => {
    const map = new Map<string, { count: number; hours: number }>();
    records.forEach((r) => {
      const cat = r.category || 'Nieokreślone';
      const prev = map.get(cat) || { count: 0, hours: 0 };
      map.set(cat, {
        count: prev.count + 1,
        hours: prev.hours + (Number(r.computable_time) || 0),
      });
    });
    return Array.from(map.entries()).sort((a, b) => b[1].hours - a[1].hours);
  }, [records]);

  // Wymiary etatu z sumami godzin
  const contractTypeOptions = useMemo(() => {
    const map = new Map<string, { count: number; hours: number }>();
    records.forEach((r) => {
      const ct = r.contract_type || 'Nieokreślone';
      const prev = map.get(ct) || { count: 0, hours: 0 };
      map.set(ct, {
        count: prev.count + 1,
        hours: prev.hours + (Number(r.computable_time) || 0),
      });
    });
    return Array.from(map.entries()).sort((a, b) => b[1].hours - a[1].hours);
  }, [records]);

  // Tygodnie w miesiącu
  const weekOptions = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.week) set.add(r.week);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [records]);

  // Rekordy po przefiltrowaniu
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (selectedCategory !== 'all' && r.category !== selectedCategory) return false;
      if (selectedContractType !== 'all' && r.contract_type !== selectedContractType) return false;
      if (selectedWeek !== 'all' && r.week !== selectedWeek) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const emp = (r.employee || '').toLowerCase();
        const cat = (r.category || '').toLowerCase();
        const date = (r.date || '').toLowerCase();
        const day = (r.day_of_week || '').toLowerCase();
        if (!emp.includes(q) && !cat.includes(q) && !date.includes(q) && !day.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [records, selectedCategory, selectedContractType, selectedWeek, searchQuery]);

  // Posortowane rekordy pojedynczych zmian
  const sortedRecords = useMemo(() => {
    const copy = [...filteredRecords];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'computable_time') {
        cmp = (Number(a.computable_time) || 0) - (Number(b.computable_time) || 0);
      } else if (sortField === 'date') {
        cmp = (a.date || '').localeCompare(b.date || '');
      } else if (sortField === 'employee') {
        cmp = (a.employee || '').localeCompare(b.employee || '', 'pl');
      } else if (sortField === 'category') {
        cmp = (a.category || '').localeCompare(b.category || '', 'pl');
      } else if (sortField === 'contract_type') {
        cmp = (a.contract_type || '').localeCompare(b.contract_type || '', 'pl');
      } else if (sortField === 'day_of_week') {
        cmp = (a.day_of_week || '').localeCompare(b.day_of_week || '', 'pl');
      } else if (sortField === 'week') {
        cmp = (a.week || '').localeCompare(b.week || '', undefined, { numeric: true });
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [filteredRecords, sortField, sortDirection]);

  const totalComputable = useMemo(() => {
    return records.reduce((acc, r) => acc + (Number(r.computable_time) || 0), 0);
  }, [records]);

  const filteredComputable = useMemo(() => {
    return filteredRecords.reduce((acc, r) => acc + (Number(r.computable_time) || 0), 0);
  }, [filteredRecords]);

  // Zestawienie i agregacja per pracownik
  const aggregatedEmployees = useMemo(() => {
    const map = new Map<
      string,
      {
        employee: string;
        category: string;
        contract_type: string;
        shifts_count: number;
        total_hours: number;
        categoriesCount: Map<string, number>;
        contractsCount: Map<string, number>;
      }
    >();

    filteredRecords.forEach((r) => {
      const emp = r.employee || 'Nieznany';
      const existing = map.get(emp) || {
        employee: emp,
        category: r.category || 'Barista',
        contract_type: r.contract_type || 'Zlecenie',
        shifts_count: 0,
        total_hours: 0,
        categoriesCount: new Map<string, number>(),
        contractsCount: new Map<string, number>(),
      };

      existing.shifts_count += 1;
      existing.total_hours += Number(r.computable_time) || 0;

      const cat = r.category || 'Barista';
      existing.categoriesCount.set(cat, (existing.categoriesCount.get(cat) || 0) + 1);

      const ct = r.contract_type || 'Zlecenie';
      existing.contractsCount.set(ct, (existing.contractsCount.get(ct) || 0) + 1);

      map.set(emp, existing);
    });

    const list = Array.from(map.values()).map((emp) => {
      // Wybierz najczęściej występujące stanowisko i etat
      let topCat = emp.category;
      let maxCatCount = 0;
      emp.categoriesCount.forEach((count, cat) => {
        if (count > maxCatCount) {
          maxCatCount = count;
          topCat = cat;
        }
      });

      let topCt = emp.contract_type;
      let maxCtCount = 0;
      emp.contractsCount.forEach((count, ct) => {
        if (count > maxCtCount) {
          maxCtCount = count;
          topCt = ct;
        }
      });

      const avg_shift_hours =
        emp.shifts_count > 0 ? Number((emp.total_hours / emp.shifts_count).toFixed(2)) : 0;
      const labor_share =
        filteredComputable > 0
          ? Number(((emp.total_hours / filteredComputable) * 100).toFixed(1))
          : 0;

      return {
        employee: emp.employee,
        category: topCat,
        contract_type: topCt,
        shifts_count: emp.shifts_count,
        total_hours: Number(emp.total_hours.toFixed(2)),
        avg_shift_hours,
        labor_share,
      };
    });

    // Sortowanie zagregowanych pracowników
    list.sort((a, b) => {
      let cmp = 0;
      if (empSortField === 'total_hours') {
        cmp = a.total_hours - b.total_hours;
      } else if (empSortField === 'shifts_count') {
        cmp = a.shifts_count - b.shifts_count;
      } else if (empSortField === 'avg_shift_hours') {
        cmp = a.avg_shift_hours - b.avg_shift_hours;
      } else if (empSortField === 'labor_share') {
        cmp = a.labor_share - b.labor_share;
      } else if (empSortField === 'employee') {
        cmp = a.employee.localeCompare(b.employee, 'pl');
      } else if (empSortField === 'category') {
        cmp = a.category.localeCompare(b.category, 'pl');
      } else if (empSortField === 'contract_type') {
        cmp = a.contract_type.localeCompare(b.contract_type, 'pl');
      }
      return empSortDirection === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [filteredRecords, filteredComputable, empSortField, empSortDirection]);

  const uniqueEmployeesCount = aggregatedEmployees.length;

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedCategory !== 'all' ||
    selectedContractType !== 'all' ||
    selectedWeek !== 'all';

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedContractType('all');
    setSelectedWeek('all');
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'computable_time' ? 'desc' : 'asc');
    }
  };

  const handleEmpSort = (field: EmployeeSortField) => {
    if (empSortField === field) {
      setEmpSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setEmpSortField(field);
      setEmpSortDirection(field === 'total_hours' || field === 'shifts_count' ? 'desc' : 'asc');
    }
  };

  // Dwuarkuszowy Eksport do Excela (.xlsx)
  const handleExportExcel = () => {
    if (filteredRecords.length === 0) return;

    const workbook = XLSX.utils.book_new();

    // ARKUSZ 1: Zestawienie Pracowników
    const empExportData = aggregatedEmployees.map((e, idx) => ({
      'Lp': idx + 1,
      'Pracownik': e.employee,
      'Stanowisko (główne)': e.category,
      'Wymiar Etatu': e.contract_type,
      'Liczba Zmian': e.shifts_count,
      'Suma Godzin (h)': e.total_hours,
      'Średnia h/zmianę': e.avg_shift_hours,
      'Udział w Robociznie (%)': `${e.labor_share}%`,
    }));

    // Wiersz podsumowania na dole Arkusza 1
    const totalEmpShifts = aggregatedEmployees.reduce((s, e) => s + e.shifts_count, 0);
    empExportData.push({
      'Lp': '' as any,
      'Pracownik': `RAZEM (${uniqueEmployeesCount} osób)`,
      'Stanowisko (główne)': '',
      'Wymiar Etatu': '',
      'Liczba Zmian': totalEmpShifts,
      'Suma Godzin (h)': Number(filteredComputable.toFixed(2)),
      'Średnia h/zmianę':
        totalEmpShifts > 0 ? Number((filteredComputable / totalEmpShifts).toFixed(2)) : 0,
      'Udział w Robociznie (%)': '100.0%',
    });

    const wsEmployees = XLSX.utils.json_to_sheet(empExportData);
    wsEmployees['!cols'] = [
      { wch: 6 },  // Lp
      { wch: 28 }, // Pracownik
      { wch: 26 }, // Stanowisko
      { wch: 22 }, // Wymiar etatu
      { wch: 14 }, // Liczba zmian
      { wch: 18 }, // Suma godzin
      { wch: 18 }, // Średnia h/zmianę
      { wch: 24 }, // Udział %
    ];
    XLSX.utils.book_append_sheet(workbook, wsEmployees, 'Zestawienie Pracowników');

    // ARKUSZ 2: Szczegółowe Zmiany (Fichajes)
    const shiftsExportData = sortedRecords.map((r, idx) => {
      const row: Record<string, any> = {
        'Lp': idx + 1,
        'Data': r.date,
        'Dzień': r.day_of_week,
      };
      if (isMonthView) {
        row['Tydzień'] = r.week || '';
      }
      row['Pracownik'] = r.employee;
      row['Stanowisko'] = r.category;
      row['Wymiar Etatu'] = r.contract_type;
      row['Godziny (Computable)'] = Number((Number(r.computable_time) || 0).toFixed(2));
      return row;
    });

    // Wiersz podsumowania na dole Arkusza 2
    const summaryShiftRow: Record<string, any> = {
      'Lp': '',
      'Data': 'RAZEM / SUMA',
      'Dzień': '',
    };
    if (isMonthView) {
      summaryShiftRow['Tydzień'] = '';
    }
    summaryShiftRow['Pracownik'] = `${uniqueEmployeesCount} pracowników`;
    summaryShiftRow['Stanowisko'] =
      selectedCategory !== 'all' ? selectedCategory : 'Wszystkie stanowiska';
    summaryShiftRow['Wymiar Etatu'] =
      selectedContractType !== 'all' ? selectedContractType : 'Wszystkie wymiary';
    summaryShiftRow['Godziny (Computable)'] = Number(filteredComputable.toFixed(2));
    shiftsExportData.push(summaryShiftRow);

    const wsShifts = XLSX.utils.json_to_sheet(shiftsExportData);
    wsShifts['!cols'] = [
      { wch: 6 },  // Lp
      { wch: 12 }, // Data
      { wch: 8 },  // Dzień
      ...(isMonthView ? [{ wch: 9 }] : []),
      { wch: 28 }, // Pracownik
      { wch: 26 }, // Stanowisko
      { wch: 22 }, // Wymiar etatu
      { wch: 24 }, // Godziny
    ];
    XLSX.utils.book_append_sheet(workbook, wsShifts, 'Szczegóły Zmian');

    const cleanLabel = (weekLabel || 'Logowania')
      .replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ_]/g, '_')
      .replace(/_+/g, '_');
    const filename = `Ewidencja_RCP_SBX_Janki_${cleanLabel}.xlsx`;

    XLSX.writeFile(workbook, filename);
  };

  if (!isOpen || !weekKey) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white border border-[#D0DCD6] rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl relative overflow-hidden">
        {/* Nagłówek okna */}
        <div className="p-5 sm:p-6 border-b border-[#E2E8E5] flex items-center justify-between shrink-0 bg-[#F4F7F5]">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 rounded-2xl bg-[#E0F2FE] text-[#0284C7] border border-[#BAE6FD] shadow-2xs">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-[#1E3932]">
                  Ewidencja Zmian i Logowań (MAPAL Fichajes)
                </h3>
                <span
                  className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                    isMonthView
                      ? 'bg-[#E8F5E9] text-[#006241] border-[#A5D6A7]'
                      : 'bg-[#E0F2FE] text-[#0284C7] border-[#BAE6FD]'
                  }`}
                >
                  {isMonthView ? '📅 Cały Miesiąc' : '📆 Tydzień'}
                </span>
              </div>
              <p className="text-xs text-[#5C6F68] mt-0.5">
                Zakres: <strong className="text-[#1E3932]">{weekLabel}</strong>{' '}
                <span className="opacity-70 font-mono text-[11px]">({weekKey})</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* Przycisk eksportu do Excela */}
            <button
              onClick={handleExportExcel}
              disabled={filteredRecords.length === 0}
              title="Pobierz 2-arkuszowy plik Excel (.xlsx) z podsumowaniem pracowników i listą zmian"
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#006241] hover:bg-[#00754A] text-white font-bold text-xs shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Eksportuj (.xlsx)</span>
            </button>

            {/* Suma Godzin */}
            <div className="text-right pl-2 border-l border-[#D0DCD6]">
              <span className="text-[11px] text-[#5C6F68] font-bold block">
                {hasActiveFilters ? 'Suma (Filtr):' : 'Suma Godzin:'}
              </span>
              <div className="text-xl sm:text-2xl font-black text-[#0284C7] leading-tight">
                {filteredComputable.toFixed(1)}{' '}
                <span className="text-xs font-bold text-[#5C6F68]">h</span>
              </div>
              {hasActiveFilters && (
                <div className="text-[10px] text-[#5C6F68] font-medium">
                  z {totalComputable.toFixed(1)} h łącznie
                </div>
              )}
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-full bg-[#E8ECE9] text-[#5C6F68] hover:text-[#1E3932] hover:bg-[#D0DCD6] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Pasek Filtrów i Wyszukiwania */}
        <div className="px-6 py-3.5 bg-[#F9FBFA] border-b border-[#E2E8E5] shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Przełącznik Zakładek: Zmiany vs Pracownicy */}
            <div className="inline-flex rounded-xl bg-[#E8ECE9] p-1 border border-[#D0DCD6]">
              <button
                onClick={() => setActiveTab('shifts')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'shifts'
                    ? 'bg-white text-[#006241] shadow-2xs'
                    : 'text-[#5C6F68] hover:text-[#1E3932]'
                }`}
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span>Lista Zmian ({filteredRecords.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('employees')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'employees'
                    ? 'bg-white text-[#006241] shadow-2xs'
                    : 'text-[#5C6F68] hover:text-[#1E3932]'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Pracownicy ({uniqueEmployeesCount})</span>
              </button>
            </div>

            {/* Wyszukiwarka */}
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#5C6F68]" />
              <input
                type="text"
                placeholder="Szukaj pracownika, stanowiska lub daty..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-[#D0DCD6] focus:border-[#006241] rounded-xl text-xs text-[#1E3932] font-semibold placeholder:text-gray-400 focus:outline-none shadow-2xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filtr Kategoria / Stanowisko */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-[#5C6F68] hidden md:inline">Stanowisko:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-[#D0DCD6] focus:border-[#006241] rounded-xl text-xs text-[#1E3932] font-bold focus:outline-none shadow-2xs"
              >
                <option value="all">Wszystkie stanowiska ({records.length})</option>
                {categoryOptions.map(([cat, stats]) => (
                  <option key={cat} value={cat}>
                    {cat} ({stats.hours.toFixed(1)} h / {stats.count} zm.)
                  </option>
                ))}
              </select>
            </div>

            {/* Filtr Wymiar Etatu */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-[#5C6F68] hidden md:inline">Wymiar:</span>
              <select
                value={selectedContractType}
                onChange={(e) => setSelectedContractType(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-[#D0DCD6] focus:border-[#006241] rounded-xl text-xs text-[#1E3932] font-bold focus:outline-none shadow-2xs"
              >
                <option value="all">Wszystkie etaty ({records.length})</option>
                {contractTypeOptions.map(([ct, stats]) => (
                  <option key={ct} value={ct}>
                    {ct} ({stats.hours.toFixed(1)} h / {stats.count} zm.)
                  </option>
                ))}
              </select>
            </div>

            {/* Filtr Tygodnia (jeśli widok miesiąca) */}
            {isMonthView && weekOptions.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-[#5C6F68] hidden md:inline">Tydzień:</span>
                <select
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-[#D0DCD6] focus:border-[#006241] rounded-xl text-xs text-[#1E3932] font-bold focus:outline-none shadow-2xs"
                >
                  <option value="all">Wszystkie tygodnie</option>
                  {weekOptions.map((wk) => (
                    <option key={wk} value={wk}>
                      Tydzień {wk}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Przycisk resetu filtrów */}
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#DC2626] font-bold text-xs border border-[#FCA5A5] transition-colors cursor-pointer"
                title="Wyczyść wszystkie filtry"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Resetuj</span>
              </button>
            )}
          </div>

          {/* Szybkie podsumowanie aktywnych filtrów */}
          <div className="flex items-center gap-3 mt-2.5 text-[11px] text-[#5C6F68] flex-wrap">
            <span className="font-semibold">
              Wyniki:{' '}
              <strong className="text-[#1E3932]">
                {filteredRecords.length}
              </strong>{' '}
              zmian ({uniqueEmployeesCount} pracowników)
            </span>
            <span className="text-gray-300">•</span>
            <span>
              Średnia zmiana:{' '}
              <strong className="text-[#1E3932]">
                {filteredRecords.length > 0
                  ? (filteredComputable / filteredRecords.length).toFixed(2)
                  : '0.00'}{' '}
                h
              </strong>
            </span>
            {selectedCategory !== 'all' && (
              <span className="px-2 py-0.5 rounded-md bg-[#E8F5E9] text-[#006241] font-bold border border-[#C8E6C9]">
                Stanowisko: {selectedCategory}
              </span>
            )}
            {selectedContractType !== 'all' && (
              <span className="px-2 py-0.5 rounded-md bg-[#E0F2FE] text-[#0284C7] font-bold border border-[#BAE6FD]">
                Etat: {selectedContractType}
              </span>
            )}
            {selectedWeek !== 'all' && (
              <span className="px-2 py-0.5 rounded-md bg-[#FEF3C7] text-[#B45309] font-bold border border-[#FDE68A]">
                Tydzień: {selectedWeek}
              </span>
            )}
          </div>
        </div>

        {/* Zawartość tabeli z naprawionym sticky header */}
        <div className="p-6 flex-1 min-h-0 flex flex-col">
          {isLoading ? (
            <div className="py-16 text-center text-xs text-[#5C6F68] flex flex-col items-center justify-center flex-1">
              <div className="w-8 h-8 border-3 border-[#006241] border-t-transparent rounded-full animate-spin mb-3" />
              Ładowanie rekordów logowań...
            </div>
          ) : records.length === 0 ? (
            <div className="py-16 text-center text-xs text-gray-400 flex flex-col items-center justify-center flex-1">
              Brak zarejestrowanych logowań w bazie dla wskazanego zakresu. Zaimportuj raport MAPAL Fichajes.
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="py-16 text-center text-xs text-gray-500 flex flex-col items-center justify-center flex-1">
              Brak danych pasujących do wybranych kryteriów filtrowania.{' '}
              <button
                onClick={handleResetFilters}
                className="text-[#006241] underline font-bold ml-1 cursor-pointer"
              >
                Wyczyść filtry
              </button>
            </div>
          ) : activeTab === 'shifts' ? (
            /* ZAKŁADKA 1: TABELA POJEDYNCZYCH ZMIAN */
            <div className="flex-1 overflow-y-auto border border-[#E2E8E5] rounded-2xl shadow-2xs relative">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-20 bg-[#F4F7F5] shadow-xs">
                  <tr className="text-[#006241] uppercase font-black tracking-wider border-b border-[#E2E8E5] select-none">
                    {/* Data */}
                    <th
                      onClick={() => handleSort('date')}
                      className="py-2.5 px-3 cursor-pointer hover:bg-[#EAEFEA] transition-colors"
                      title="Kliknij, aby posortować po dacie"
                    >
                      <div className="flex items-center gap-1">
                        <span>Data</span>
                        {sortField === 'date' ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-[#006241]" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-[#006241]" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-[#5C6F68]/50" />
                        )}
                      </div>
                    </th>

                    {/* Dzień */}
                    <th
                      onClick={() => handleSort('day_of_week')}
                      className="py-2.5 px-2 text-center cursor-pointer hover:bg-[#EAEFEA] transition-colors"
                      title="Kliknij, aby posortować po dniu tygodnia"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Dzień</span>
                        {sortField === 'day_of_week' &&
                          (sortDirection === 'asc' ? (
                            <ArrowUp className="w-3 h-3 text-[#006241]" />
                          ) : (
                            <ArrowDown className="w-3 h-3 text-[#006241]" />
                          ))}
                      </div>
                    </th>

                    {/* Tydzień (jeśli widok miesiąca) */}
                    {isMonthView && (
                      <th
                        onClick={() => handleSort('week')}
                        className="py-2.5 px-2 text-center cursor-pointer hover:bg-[#EAEFEA] transition-colors"
                        title="Kliknij, aby posortować po tygodniu"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>Tydz.</span>
                          {sortField === 'week' &&
                            (sortDirection === 'asc' ? (
                              <ArrowUp className="w-3 h-3 text-[#006241]" />
                            ) : (
                              <ArrowDown className="w-3 h-3 text-[#006241]" />
                            ))}
                        </div>
                      </th>
                    )}

                    {/* Pracownik */}
                    <th
                      onClick={() => handleSort('employee')}
                      className="py-2.5 px-3 cursor-pointer hover:bg-[#EAEFEA] transition-colors"
                      title="Kliknij, aby posortować alfabetycznie po pracowniku"
                    >
                      <div className="flex items-center gap-1">
                        <span>Pracownik</span>
                        {sortField === 'employee' ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-[#006241]" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-[#006241]" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-[#5C6F68]/50" />
                        )}
                      </div>
                    </th>

                    {/* Stanowisko */}
                    <th
                      onClick={() => handleSort('category')}
                      className="py-2.5 px-3 cursor-pointer hover:bg-[#EAEFEA] transition-colors"
                      title="Kliknij, aby posortować po stanowisku"
                    >
                      <div className="flex items-center gap-1">
                        <span>Stanowisko</span>
                        {sortField === 'category' &&
                          (sortDirection === 'asc' ? (
                            <ArrowUp className="w-3 h-3 text-[#006241]" />
                          ) : (
                            <ArrowDown className="w-3 h-3 text-[#006241]" />
                          ))}
                      </div>
                    </th>

                    {/* Wymiar Etatu */}
                    <th
                      onClick={() => handleSort('contract_type')}
                      className="py-2.5 px-3 cursor-pointer hover:bg-[#EAEFEA] transition-colors"
                      title="Kliknij, aby posortować po wymiarze etatu"
                    >
                      <div className="flex items-center gap-1">
                        <span>Wymiar Etatu</span>
                        {sortField === 'contract_type' &&
                          (sortDirection === 'asc' ? (
                            <ArrowUp className="w-3 h-3 text-[#006241]" />
                          ) : (
                            <ArrowDown className="w-3 h-3 text-[#006241]" />
                          ))}
                      </div>
                    </th>

                    {/* Godziny Computable */}
                    <th
                      onClick={() => handleSort('computable_time')}
                      className="py-2.5 px-4 text-right cursor-pointer hover:bg-[#EAEFEA] transition-colors"
                      title="Kliknij, aby posortować po liczbie godzin (Computable)"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Godziny (Computable)</span>
                        {sortField === 'computable_time' ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-[#0284C7]" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-[#0284C7]" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-[#5C6F68]/50" />
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2F0]">
                  {sortedRecords.map((rec, idx) => (
                    <tr
                      key={rec.id || idx}
                      className="hover:bg-[#F0F5F2] transition-colors"
                    >
                      <td className="py-2.5 px-3 font-semibold text-[#2D3748] whitespace-nowrap">
                        {rec.date}
                      </td>
                      <td className="py-2.5 px-2 text-center text-[#5C6F68] font-bold">
                        {rec.day_of_week}
                      </td>
                      {isMonthView && (
                        <td className="py-2.5 px-2 text-center">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-[#E8F5E9] text-[#006241] border border-[#C8E6C9]">
                            {rec.week || '—'}
                          </span>
                        </td>
                      )}
                      <td className="py-2.5 px-3 font-black text-[#1E3932] whitespace-nowrap">
                        {rec.employee}
                      </td>
                      <td className="py-2.5 px-3 text-[#2D3748]">
                        <span className="px-2 py-0.5 rounded-md bg-[#F1F5F9] text-[#334155] font-semibold text-[11px]">
                          {rec.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[#5C6F68] font-medium">
                        {rec.contract_type}
                      </td>
                      <td className="py-2.5 px-4 text-right font-black text-[#0284C7] whitespace-nowrap">
                        {Number(rec.computable_time).toFixed(2)} h
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Wiersz sumy tabeli */}
                <tfoot className="sticky bottom-0 z-10 bg-[#F8FAF9] shadow-inner">
                  <tr className="border-t-2 border-[#D0DCD6] font-black text-xs text-[#1E3932]">
                    <td className="py-3 px-3 uppercase text-[#006241]" colSpan={isMonthView ? 3 : 2}>
                      RAZEM / PODSUMOWANIE
                    </td>
                    <td className="py-3 px-3 text-[#5C6F68]">
                      {uniqueEmployeesCount} pracowników
                    </td>
                    <td className="py-3 px-3 text-[#5C6F68]">
                      {selectedCategory !== 'all' ? selectedCategory : 'Wszystkie stanowiska'}
                    </td>
                    <td className="py-3 px-3 text-[#5C6F68]">
                      {selectedContractType !== 'all' ? selectedContractType : 'Wszystkie wymiary'}
                    </td>
                    <td className="py-3 px-4 text-right text-sm font-black text-[#0284C7]">
                      {filteredComputable.toFixed(2)} h
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            /* ZAKŁADKA 2: PODSUMOWANIE PER PRACOWNIK */
            <div className="flex-1 overflow-y-auto border border-[#E2E8E5] rounded-2xl shadow-2xs relative">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-20 bg-[#F4F7F5] shadow-xs">
                  <tr className="text-[#006241] uppercase font-black tracking-wider border-b border-[#E2E8E5] select-none">
                    <th className="py-2.5 px-3 w-12 text-center">Lp</th>

                    {/* Pracownik */}
                    <th
                      onClick={() => handleEmpSort('employee')}
                      className="py-2.5 px-3 cursor-pointer hover:bg-[#EAEFEA] transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>Pracownik</span>
                        {empSortField === 'employee' ? (
                          empSortDirection === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-[#006241]" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-[#006241]" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-[#5C6F68]/50" />
                        )}
                      </div>
                    </th>

                    {/* Stanowisko */}
                    <th
                      onClick={() => handleEmpSort('category')}
                      className="py-2.5 px-3 cursor-pointer hover:bg-[#EAEFEA] transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>Główne Stanowisko</span>
                        {empSortField === 'category' &&
                          (empSortDirection === 'asc' ? (
                            <ArrowUp className="w-3 h-3 text-[#006241]" />
                          ) : (
                            <ArrowDown className="w-3 h-3 text-[#006241]" />
                          ))}
                      </div>
                    </th>

                    {/* Wymiar Etatu */}
                    <th
                      onClick={() => handleEmpSort('contract_type')}
                      className="py-2.5 px-3 cursor-pointer hover:bg-[#EAEFEA] transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>Wymiar Etatu</span>
                        {empSortField === 'contract_type' &&
                          (empSortDirection === 'asc' ? (
                            <ArrowUp className="w-3 h-3 text-[#006241]" />
                          ) : (
                            <ArrowDown className="w-3 h-3 text-[#006241]" />
                          ))}
                      </div>
                    </th>

                    {/* Liczba Zmian */}
                    <th
                      onClick={() => handleEmpSort('shifts_count')}
                      className="py-2.5 px-3 text-center cursor-pointer hover:bg-[#EAEFEA] transition-colors"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Liczba Zmian</span>
                        {empSortField === 'shifts_count' ? (
                          empSortDirection === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-[#006241]" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-[#006241]" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-[#5C6F68]/50" />
                        )}
                      </div>
                    </th>

                    {/* Suma Godzin */}
                    <th
                      onClick={() => handleEmpSort('total_hours')}
                      className="py-2.5 px-4 text-right cursor-pointer hover:bg-[#EAEFEA] transition-colors"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Suma Godzin (h)</span>
                        {empSortField === 'total_hours' ? (
                          empSortDirection === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-[#0284C7]" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-[#0284C7]" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-[#5C6F68]/50" />
                        )}
                      </div>
                    </th>

                    {/* Średnia h/zmianę */}
                    <th
                      onClick={() => handleEmpSort('avg_shift_hours')}
                      className="py-2.5 px-3 text-right cursor-pointer hover:bg-[#EAEFEA] transition-colors"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Śr. h/zmianę</span>
                        {empSortField === 'avg_shift_hours' &&
                          (empSortDirection === 'asc' ? (
                            <ArrowUp className="w-3 h-3 text-[#006241]" />
                          ) : (
                            <ArrowDown className="w-3 h-3 text-[#006241]" />
                          ))}
                      </div>
                    </th>

                    {/* Udział w robociznie */}
                    <th
                      onClick={() => handleEmpSort('labor_share')}
                      className="py-2.5 px-3 text-right cursor-pointer hover:bg-[#EAEFEA] transition-colors"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Udział (%)</span>
                        {empSortField === 'labor_share' &&
                          (empSortDirection === 'asc' ? (
                            <ArrowUp className="w-3 h-3 text-[#006241]" />
                          ) : (
                            <ArrowDown className="w-3 h-3 text-[#006241]" />
                          ))}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2F0]">
                  {aggregatedEmployees.map((emp, idx) => (
                    <tr key={emp.employee} className="hover:bg-[#F0F5F2] transition-colors">
                      <td className="py-2.5 px-3 text-center text-[10px] font-bold text-[#5C6F68]">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-black text-[#1E3932] whitespace-nowrap">
                        {emp.employee}
                      </td>
                      <td className="py-2.5 px-3 text-[#2D3748]">
                        <span className="px-2 py-0.5 rounded-md bg-[#F1F5F9] text-[#334155] font-semibold text-[11px]">
                          {emp.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[#5C6F68] font-medium">
                        {emp.contract_type}
                      </td>
                      <td className="py-2.5 px-3 text-center font-extrabold text-[#1E3932]">
                        {emp.shifts_count}
                      </td>
                      <td className="py-2.5 px-4 text-right font-black text-[#0284C7] whitespace-nowrap">
                        {emp.total_hours.toFixed(2)} h
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-[#5C6F68]">
                        {emp.avg_shift_hours.toFixed(2)} h
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-[#006241]">
                        {emp.labor_share.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Wiersz sumy pracowników */}
                <tfoot className="sticky bottom-0 z-10 bg-[#F8FAF9] shadow-inner">
                  <tr className="border-t-2 border-[#D0DCD6] font-black text-xs text-[#1E3932]">
                    <td className="py-3 px-3 text-center">—</td>
                    <td className="py-3 px-3 text-[#006241] uppercase">
                      ŁĄCZNIE ({uniqueEmployeesCount} osób)
                    </td>
                    <td className="py-3 px-3 text-[#5C6F68]">—</td>
                    <td className="py-3 px-3 text-[#5C6F68]">—</td>
                    <td className="py-3 px-3 text-center text-[#1E3932]">
                      {filteredRecords.length}
                    </td>
                    <td className="py-3 px-4 text-right text-sm font-black text-[#0284C7]">
                      {filteredComputable.toFixed(2)} h
                    </td>
                    <td className="py-3 px-3 text-right text-[#5C6F68]">
                      {filteredRecords.length > 0
                        ? (filteredComputable / filteredRecords.length).toFixed(2)
                        : '0.00'}{' '}
                      h
                    </td>
                    <td className="py-3 px-3 text-right text-[#006241]">100.0%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Stopka */}
        <div className="p-4 border-t border-[#E2E8E5] bg-[#F7F9F8] flex justify-between items-center text-xs text-[#5C6F68] shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span>
              {activeTab === 'shifts' ? 'Wyświetlono zmian:' : 'Wyświetlono pracowników:'}{' '}
              <strong className="text-[#1E3932]">
                {activeTab === 'shifts' ? filteredRecords.length : uniqueEmployeesCount}
              </strong>{' '}
              ({filteredComputable.toFixed(1)} h)
            </span>
            <span className="text-gray-300">•</span>
            <span>
              Kawiarnia: <strong className="text-[#006241]">108120 SBX Warszawa Janki (384)</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              disabled={filteredRecords.length === 0}
              title="Pobierz plik Excel z 2 arkuszami: Zestawienie Pracowników + Szczegóły Zmian"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-[#E8F5E9] text-[#006241] border border-[#D0DCD6] hover:border-[#006241] font-bold text-xs shadow-2xs transition-all cursor-pointer disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#006241]" />
              <span>Eksportuj (.xlsx)</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-[#E8ECE9] hover:bg-[#D0DCD6] text-[#1E3932] font-bold text-xs transition-colors cursor-pointer"
            >
              Zamknij
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
