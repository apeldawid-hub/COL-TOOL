import React from 'react';
import { CalendarRange, ArrowRight, ShieldCheck, Sparkles, Clock, Users, AlertTriangle } from 'lucide-react';
import { CrossMonthBridge } from '../../../types';

interface CrossMonthBridgeCardProps {
  bridge: CrossMonthBridge;
  onNavigateMonth?: (monthName: string, year: number) => void;
}

export const CrossMonthBridgeCard: React.FC<CrossMonthBridgeCardProps> = ({
  bridge,
  onNavigateMonth,
}) => {
  const {
    bridgeType,
    partCurrentMonth,
    partAdjacentMonth,
    combinedDateRange,
    totalFloorHours,
    totalCombinedPlanHours,
    recommendedCombinedHours,
    totalCombinedManagerHours,
    totalCombinedBaristaPool,
    all7DaysCoverage,
    missingAmTotal,
    missingPmTotal,
  } = bridge;

  return (
    <div className="bg-gradient-to-br from-white to-[#F7FAF8] border-2 border-[#A7F3D0] rounded-2xl p-5 shadow-xs mb-6 relative overflow-hidden">
      {/* Tło dekoracyjne */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#006241]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Nagłówek */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#E2E8E5]">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-[#DCFCE7] text-[#006241] border border-[#86EFAC]">
            <CalendarRange className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-[#1E3932] tracking-tight uppercase">
                Przełom Miesięcy AOP — Scalony Grafik Operacyjny
              </h3>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#006241] text-white">
                Pełny Cykl: 7 dni ({bridgeType === 'trailing' ? 'Koniec miesiąca' : 'Początek miesiąca'})
              </span>
            </div>
            <p className="text-xs text-[#5C6F68] mt-0.5">
              Fizyczny grafik obejmuje dni z dwóch miesięcy AOP: <strong>{combinedDateRange}</strong>. System automatycznie rozdziela budżety i synchronizuje dyżury kierownicze.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs font-bold text-[#006241] bg-[#E8F5E9] px-3 py-1 rounded-full border border-[#C8E6C9] flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#006241]" />
            Łączny Floor: <strong>{totalFloorHours.toFixed(1)} h</strong>
          </span>
        </div>
      </div>

      {/* Dwie karty składowe połączone strzałką */}
      <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-center my-4">
        {/* Część 1: Bieżący miesiąc */}
        <div className="md:col-span-5 bg-white p-4 rounded-xl border border-[#D1E7DD] shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black text-[#1E3932] uppercase">
              {partCurrentMonth.monthName} ({partCurrentMonth.weekNum})
            </span>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]">
              {partCurrentMonth.daysCount} dni ({partCurrentMonth.activeDays.join(', ')})
            </span>
          </div>

          <div className="text-base font-black text-[#006241] mb-1">
            {partCurrentMonth.dates}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-2 border-t border-gray-100">
            <div>
              <span className="text-[#5C6F68] block text-[10px]">Floor Hours:</span>
              <strong className="text-[#1E3932]">{partCurrentMonth.floorHours.toFixed(1)} h</strong>
            </div>
            <div>
              <span className="text-[#5C6F68] block text-[10px]">Plan AOP:</span>
              <strong className="text-[#006241]">{partCurrentMonth.planHours.toFixed(1)} h</strong>
            </div>
            <div>
              <span className="text-[#5C6F68] block text-[10px]">Godziny MGR:</span>
              <strong className="text-stone-900">{partCurrentMonth.managerHours?.toFixed(1) || 0} h</strong>
            </div>
            <div>
              <span className="text-[#5C6F68] block text-[10px]">Pula Baristów:</span>
              <strong className="text-emerald-700">{partCurrentMonth.baristaPool?.toFixed(1) || 0} h</strong>
            </div>
          </div>
        </div>

        {/* Łącznik / Przejście */}
        <div className="md:col-span-1 flex flex-col items-center justify-center py-1">
          <div className="w-8 h-8 rounded-full bg-[#E8F5E9] text-[#006241] flex items-center justify-center border border-[#A7F3D0] shadow-xs">
            <ArrowRight className="w-4 h-4" />
          </div>
          <span className="text-[9px] font-black text-[#5C6F68] mt-1 uppercase">1 Grafik</span>
        </div>

        {/* Część 2: Sąsiedni miesiąc */}
        <div className="md:col-span-5 bg-white p-4 rounded-xl border border-[#BFDBFE] shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-[#1D4ED8] uppercase">
                {partAdjacentMonth.monthName} ({partAdjacentMonth.weekNum})
              </span>
              {onNavigateMonth && (
                <button
                  onClick={() => onNavigateMonth(partAdjacentMonth.monthName, partAdjacentMonth.year)}
                  className="text-[10px] text-[#2563EB] hover:underline font-bold cursor-pointer"
                  title={`Przejdź do ${partAdjacentMonth.monthName}`}
                >
                  (otwórz →)
                </button>
              )}
            </div>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-[#DBEAFE] text-[#1D4ED8] border border-[#BFDBFE]">
              {partAdjacentMonth.daysCount} dni ({partAdjacentMonth.activeDays.join(', ')})
            </span>
          </div>

          <div className="text-base font-black text-[#1D4ED8] mb-1">
            {partAdjacentMonth.dates}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-2 border-t border-gray-100">
            <div>
              <span className="text-[#5C6F68] block text-[10px]">Floor Hours:</span>
              <strong className="text-[#1E3932]">{partAdjacentMonth.floorHours.toFixed(1)} h</strong>
            </div>
            <div>
              <span className="text-[#5C6F68] block text-[10px]">Plan AOP:</span>
              <strong className="text-[#1D4ED8]">{partAdjacentMonth.planHours.toFixed(1)} h</strong>
            </div>
            <div>
              <span className="text-[#5C6F68] block text-[10px]">Godziny MGR:</span>
              <strong className="text-stone-900">{partAdjacentMonth.managerHours?.toFixed(1) || 0} h</strong>
            </div>
            <div>
              <span className="text-[#5C6F68] block text-[10px]">Pula Baristów:</span>
              <strong className="text-emerald-700">{partAdjacentMonth.baristaPool?.toFixed(1) || 0} h</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Dobowy podgląd 7 dni grafiku z obsadą kierowniczą */}
      {all7DaysCoverage && all7DaysCoverage.length > 0 && (
        <div className="mt-3 mb-4 pt-3 border-t border-[#D1E7DD]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2.5">
            <span className="text-xs font-black text-[#1E3932] uppercase tracking-tight flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#006241]" />
              Obsada Kierownicza i Floor Hours na Pełne 7 Dni (Wtorek – Poniedziałek)
            </span>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="text-stone-600">
                Suma MGR: <strong className="text-stone-900">{totalCombinedManagerHours?.toFixed(1) || 0} h</strong>
              </span>
              <span>•</span>
              <span className="text-emerald-800 font-semibold">
                Łączna Pula BAR: <strong>{totalCombinedBaristaPool?.toFixed(1) || 0} h</strong>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-7 gap-2">
            {all7DaysCoverage.map((d) => {
              const isCurrentMonthDay = d.monthName === partCurrentMonth.monthName;
              return (
                <div
                  key={`bridge-day-${d.date || d.day}`}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    isCurrentMonthDay
                      ? 'bg-white border-[#A7F3D0] shadow-2xs ring-1 ring-[#006241]/10'
                      : 'bg-[#F0F7FF] border-[#BFDBFE] shadow-2xs ring-1 ring-blue-500/10'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-black text-stone-700 mb-1.5 pb-1 border-b border-stone-100">
                    <span className="uppercase">{d.dayOfWeek}</span>
                    <span
                      className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                        isCurrentMonthDay
                          ? 'bg-emerald-50 text-[#006241]'
                          : 'bg-blue-50 text-blue-800'
                      }`}
                    >
                      {String(d.day).padStart(2, '0')}.{d.monthName ? d.monthName.slice(0, 3) : ''}
                    </span>
                  </div>

                  <div className="space-y-1 text-[9px] font-bold">
                    <div
                      className={`px-1 py-0.5 rounded flex items-center justify-between ${
                        d.hasAm
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                      title={d.hasAm ? `AM: ${d.amEmployees.join(', ')}` : 'Brak menedżera na otwarciu (AM)'}
                    >
                      <span>AM:</span>
                      <span>{d.hasAm ? '✅' : '❌'}</span>
                    </div>

                    <div
                      className={`px-1 py-0.5 rounded flex items-center justify-between ${
                        d.hasPm
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                      title={d.hasPm ? `PM: ${d.pmEmployees.join(', ')}` : 'Brak menedżera na zamknięciu (PM)'}
                    >
                      <span>PM:</span>
                      <span>{d.hasPm ? '✅' : '❌'}</span>
                    </div>
                  </div>

                  <div className="text-[10px] font-black text-stone-800 mt-1.5 pt-1 border-t border-stone-100 flex items-center justify-between">
                    <span className="text-[9px] text-stone-400 font-normal">MGR:</span>
                    <span>{d.coverageHours.toFixed(1)} h</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Podsumowanie zlecenia grafiku */}
      <div className="bg-[#F0FDF4] p-3 rounded-xl border border-[#BBF7D0] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-[#1E3932]">
          <Sparkles className="w-4 h-4 text-[#CBA258] shrink-0" />
          <span>
            Układając grafik na <strong>{combinedDateRange}</strong>, rozpisz łącznie{' '}
            <strong className="text-[#006241] font-black text-sm">
              {recommendedCombinedHours !== null ? `${recommendedCombinedHours.toFixed(1)} h` : `${totalCombinedPlanHours.toFixed(1)} h`}
            </strong>{' '}
            (w tym min. <strong>{totalFloorHours.toFixed(1)} h</strong> Floor Hours dla 7 pełnych dni).
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-[#5C6F68]">
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>
              {partCurrentMonth.monthName}: <strong>{partCurrentMonth.planHours.toFixed(1)}h</strong> | {partAdjacentMonth.monthName}: <strong>{partAdjacentMonth.planHours.toFixed(1)}h</strong>
            </span>
          </div>

          {(missingAmTotal !== undefined && missingPmTotal !== undefined && (missingAmTotal > 0 || missingPmTotal > 0)) && (
            <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-bold flex items-center gap-1 border border-rose-200">
              <AlertTriangle className="w-3 h-3 text-rose-600" />
              <span>Luki MGR: {missingAmTotal > 0 ? `${missingAmTotal} AM` : ''} {missingPmTotal > 0 ? `${missingPmTotal} PM` : ''}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
