import React from 'react';
import { AppModule } from '../types';
import {
  BarChart3,
  CalendarDays,
  GraduationCap,
  LineChart,
  Boxes,
  ArrowRight,
  Store,
  Calendar,
  Sparkles,
  Layers,
  Clock,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (module: AppModule) => void;
  selectedYear: number;
  selectedMonth: string;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  selectedYear,
  selectedMonth,
}) => {
  const currentDateFormatted = new Intl.DateTimeFormat('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className="space-y-6 max-w-7xl mx-auto select-none">
      {/* Baner Powitalny Store Managera */}
      <div className="bg-gradient-to-r from-[#1E3932] via-[#006241] to-[#00754A] rounded-3xl p-8 text-white shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 right-20 w-48 h-48 bg-[#CBA258]/10 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center space-x-2 text-emerald-200 text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles className="w-4 h-4 text-[#CBA258]" />
              <span>Pulpit Operacyjny Store Managera</span>
            </div>

            <h1 className="text-3xl font-black tracking-tight text-white">
              Witaj w Starbucks Operations Suite
            </h1>

            <p className="text-emerald-100/80 text-sm mt-1.5 flex items-center gap-2">
              <Store className="w-4 h-4 text-[#CBA258]" />
              <span className="font-bold">108120 SBX Warszawa Janki</span>
              <span>•</span>
              <span>Kod jednostki: <strong>384</strong></span>
              <span>•</span>
              <span className="capitalize">{currentDateFormatted}</span>
            </p>
          </div>

          <div className="flex items-center space-x-3 bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/15 text-xs text-white">
            <Clock className="w-4 h-4 text-[#CBA258]" />
            <div>
              <span className="text-white/60 block text-[10px] font-bold uppercase">Aktywny Okres AOP</span>
              <span className="font-black text-sm text-white">{selectedMonth} {selectedYear}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Siatka Głównych Modułów Suite */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-xs font-bold text-[#5C6F68] uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-[#006241]" />
            Moduły Platformy Operacyjnej
          </h2>
          <span className="text-xs text-stone-400 font-medium">5 Modułów (3 aktywne, 2 w budowie)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* KAFELEK 1: TPLH Forecast */}
          <div
            onClick={() => onNavigate('labor_forecast')}
            className="bg-white rounded-3xl border border-[#E2E8E5] hover:border-[#006241] p-6 shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-[#006241]/10 text-[#006241] flex items-center justify-center font-bold shadow-2xs group-hover:bg-[#006241] group-hover:text-white transition-colors">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Aktywny v1.2
                </span>
              </div>

              <h3 className="text-base font-black text-[#1E3932] group-hover:text-[#006241] transition-colors">
                TPLH Forecast & Labor Balancing
              </h3>
              <p className="text-xs text-[#5C6F68] mt-1.5 leading-relaxed">
                Predykcja MTD Trend Velocity, bufor robocizny, dobowe Floor Hours (32h) oraz ciągłe uczenie maszynowe trendów sezonowych AOP.
              </p>
            </div>

            <div className="mt-5 pt-4 border-t border-[#F0F4F2] flex items-center justify-between text-xs font-bold text-[#006241]">
              <span>Otwórz moduł TPLH</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </div>
          </div>

          {/* KAFELEK 2: Managers Schedule */}
          <div
            onClick={() => onNavigate('managers_schedule')}
            className="bg-white rounded-3xl border border-[#E2E8E5] hover:border-[#006241] p-6 shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-[#006241]/10 text-[#006241] flex items-center justify-center font-bold shadow-2xs group-hover:bg-[#006241] group-hover:text-white transition-colors">
                  <CalendarDays className="w-6 h-6" />
                </div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Aktywny v1.0
                </span>
              </div>

              <h3 className="text-base font-black text-[#1E3932] group-hover:text-[#006241] transition-colors">
                Managers Schedule (Grafik)
              </h3>
              <p className="text-xs text-[#5C6F68] mt-1.5 leading-relaxed">
                Miesięczna siatka 7 menedżerów, Tarcza Kodeksu Pracy, godziny zmian Od-Do, rozliczenie TOR Q1–Q4 oraz wsparcia MAPAL.
              </p>
            </div>

            <div className="mt-5 pt-4 border-t border-[#F0F4F2] flex items-center justify-between text-xs font-bold text-[#006241]">
              <span>Otwórz grafik</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </div>
          </div>

          {/* KAFELEK 3: Szkolenia (Aktywny v1.0) */}
          <div
            onClick={() => onNavigate('trainings')}
            className="bg-white rounded-3xl border border-[#E2E8E5] hover:border-[#006241] p-6 shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-[#006241]/10 text-[#006241] flex items-center justify-center font-bold shadow-2xs group-hover:bg-[#006241] group-hover:text-white transition-colors">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Aktywny v1.0
                </span>
              </div>

              <h3 className="text-base font-black text-[#1E3932] group-hover:text-[#006241] transition-colors">
                Szkolenia & Certyfikacje
              </h3>
              <p className="text-xs text-[#5C6F68] mt-1.5 leading-relaxed">
                Wdrożenie First 30 (Zmiany T1–T10), The Barista Journey (B90/B180/BT), cyfrowe arkusze Skill Check i monitoring godzin Non-Coverage.
              </p>
            </div>

            <div className="mt-5 pt-4 border-t border-[#F0F4F2] flex items-center justify-between text-xs font-bold text-[#006241]">
              <span>Otwórz szkolenia</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </div>
          </div>

          {/* KAFELEK 4: Analiza (Scratch) */}
          <div
            onClick={() => onNavigate('analytics')}
            className="bg-white/80 hover:bg-white rounded-3xl border border-[#E2E8E5] hover:border-blue-400 p-6 shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold shadow-2xs group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <LineChart className="w-6 h-6" />
                </div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                  W budowie
                </span>
              </div>

              <h3 className="text-base font-black text-[#1E3932] group-hover:text-blue-800 transition-colors">
                Analiza Biznesowa (BI)
              </h3>
              <p className="text-xs text-[#5C6F68] mt-1.5 leading-relaxed">
                Raporty wielomiesięczne sprzedaży, basket size, mix produktowy (Beverage/Food) oraz zaawansowane korelacje TPLH z CCS.
              </p>
            </div>

            <div className="mt-5 pt-4 border-t border-[#F0F4F2] flex items-center justify-between text-xs font-bold text-blue-700">
              <span>Zobacz zarys modułu</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </div>
          </div>

          {/* KAFELEK 5: IBS & IMS (Scratch) */}
          <div
            onClick={() => onNavigate('ibs_ims')}
            className="bg-white/80 hover:bg-white rounded-3xl border border-[#E2E8E5] hover:border-purple-400 p-6 shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold shadow-2xs group-hover:bg-purple-600 group-hover:text-white transition-colors">
                  <Boxes className="w-6 h-6" />
                </div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                  W budowie
                </span>
              </div>

              <h3 className="text-base font-black text-[#1E3932] group-hover:text-purple-800 transition-colors">
                IBS & IMS (Magazyn & Zamówienia)
              </h3>
              <p className="text-xs text-[#5C6F68] mt-1.5 leading-relaxed">
                Kalkulatory zamówień dostaw, stany magazynowe, kontrola strat (Waste) oraz comiesięczna inwentaryzacja kawiarni.
              </p>
            </div>

            <div className="mt-5 pt-4 border-t border-[#F0F4F2] flex items-center justify-between text-xs font-bold text-purple-700">
              <span>Zobacz zarys modułu</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </div>
          </div>
        </div>
      </div>

      {/* Sekcja Podsumowania Operacyjnego (Na razie estetyczny pusty stan) */}
      <div className="bg-white rounded-3xl border border-[#E2E8E5] p-8 shadow-xs">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#E2E8E5]">
          <div>
            <h3 className="text-base font-black text-[#1E3932] tracking-tight">
              Podsumowanie Operacyjne Kawiarni 108120 Janki
            </h3>
            <p className="text-xs text-[#5C6F68] mt-0.5">
              Główny ekran podsumowania przygotowany na integrację widżetów operacyjnych Store Managera
            </p>
          </div>

          <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#F0F4F2] text-[#1E3932] border border-[#D0DCD6] flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#006241]" />
            System Gotowy
          </span>
        </div>

        {/* Pusty stan podsumowania (Clean Empty State) */}
        <div className="py-12 px-4 text-center max-w-md mx-auto">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-[#F0F4F2] border border-[#D0DCD6] flex items-center justify-center text-stone-400 mb-4">
            <Layers className="w-8 h-8 text-stone-400" />
          </div>

          <h4 className="text-sm font-bold text-[#1E3932]">
            Przestrzeń Pulpitu Podsumowania
          </h4>
          <p className="text-xs text-[#5C6F68] mt-1.5 leading-relaxed">
            Tutaj pojawią się skrócone widżety dobowe: status realizacji TPLH za dzisiaj, najbliższe dyżury kierowników oraz kluczowe alerty operacyjne kawiarni Janki.
          </p>

          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              onClick={() => onNavigate('labor_forecast')}
              className="px-4 py-2 rounded-xl bg-[#006241] text-white text-xs font-bold hover:bg-[#00754A] shadow-xs cursor-pointer transition-all"
            >
              Przejdź do TPLH Forecast
            </button>
            <button
              onClick={() => onNavigate('managers_schedule')}
              className="px-4 py-2 rounded-xl bg-white border border-[#D0DCD6] text-stone-700 text-xs font-bold hover:bg-stone-50 cursor-pointer transition-all"
            >
              Przejdź do Grafiku
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
