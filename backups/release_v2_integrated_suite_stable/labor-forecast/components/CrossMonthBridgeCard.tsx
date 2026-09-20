import React from 'react';
import { CalendarRange, ArrowRight, ShieldCheck, Sparkles, Clock } from 'lucide-react';
import { CrossMonthBridge } from '../../../types';

interface CrossMonthBridgeCardProps {
  bridge: CrossMonthBridge;
  onNavigateMonth?: (monthName: string, year: number) => void;
}

export const CrossMonthBridgeCard: React.FC<CrossMonthBridgeCardProps> = ({
  bridge,
  onNavigateMonth,
}) => {
  const { partCurrentMonth, partAdjacentMonth, combinedDateRange, totalFloorHours, totalCombinedPlanHours, recommendedCombinedHours } = bridge;

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
                Pełny Cykl: 7 dni
              </span>
            </div>
            <p className="text-xs text-[#5C6F68] mt-0.5">
              Fizyczny grafik obejmuje dni z dwóch miesięcy AOP: <strong>{combinedDateRange}</strong>. System automatycznie rozdziela budżety.
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

          <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-gray-100">
            <div>
              <span className="text-[#5C6F68] block">Floor Hours:</span>
              <strong className="text-[#1E3932]">{partCurrentMonth.floorHours.toFixed(1)} h</strong>
            </div>
            <div>
              <span className="text-[#5C6F68] block">Plan AOP:</span>
              <strong className="text-[#006241]">{partCurrentMonth.planHours.toFixed(1)} h</strong>
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

        {/* Część 2: Kolejny miesiąc */}
        <div className="md:col-span-5 bg-white p-4 rounded-xl border border-[#BFDBFE] shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-[#1D4ED8] uppercase">
                {partAdjacentMonth.monthName} ({partAdjacentMonth.weekNum})
              </span>
              {onNavigateMonth && (
                <button
                  onClick={() => onNavigateMonth(partAdjacentMonth.monthName, partAdjacentMonth.year)}
                  className="text-[10px] text-[#2563EB] hover:underline font-bold"
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

          <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-gray-100">
            <div>
              <span className="text-[#5C6F68] block">Floor Hours:</span>
              <strong className="text-[#1E3932]">{partAdjacentMonth.floorHours.toFixed(1)} h</strong>
            </div>
            <div>
              <span className="text-[#5C6F68] block">Plan AOP:</span>
              <strong className="text-[#1D4ED8]">{partAdjacentMonth.planHours.toFixed(1)} h</strong>
            </div>
          </div>
        </div>
      </div>

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

        <div className="flex items-center gap-2 text-[11px] text-[#5C6F68]">
          <Clock className="w-3.5 h-3.5" />
          <span>
            Wrzesień: <strong>{partCurrentMonth.planHours.toFixed(1)}h</strong> | Październik: <strong>{partAdjacentMonth.planHours.toFixed(1)}h</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
