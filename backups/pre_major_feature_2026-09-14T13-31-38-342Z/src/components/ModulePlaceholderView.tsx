import React from 'react';
import { AppModule } from '../types';
import { GraduationCap, LineChart, Boxes, ArrowLeft, Sparkles, CheckCircle2, Construction } from 'lucide-react';

interface ModulePlaceholderViewProps {
  module: AppModule;
  onNavigate: (module: AppModule) => void;
}

interface ModuleInfo {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  plannedFeatures: string[];
  badgeColor: string;
}

const MODULE_DATA: Record<string, ModuleInfo> = {
  trainings: {
    title: 'Szkolenia & Barista Certifications',
    subtitle: 'Moduł 3: Zarządzanie Ścieżką Szkoleniową i Certyfikacjami',
    icon: GraduationCap,
    description:
      'Planowany moduł do ewaluacji postępów wdrożeniowych nowych partnerów, harmonogramowania szkoleń Barista Trainer (BT), Coffee Master oraz recertyfikacji BHP i procedur operacyjnych Starbucks.',
    plannedFeatures: [
      'Matryca kompetencji i certyfikacji partnerów kawiarni Janki',
      'Harmonogram szkoleń First 30/60/90 Days dla nowozatrudnionych baristów',
      'Śledzenie godzin szkoleniowych z budżetu Non-Coverage (NC Training)',
      'Przypomnienia o wygasających badaniach Sanepid i certyfikatach BHP',
    ],
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  analytics: {
    title: 'Analiza Biznesowa & Efektywność (BI)',
    subtitle: 'Moduł 4: Zaawansowane Raportowanie Rentowności i Wskaźników',
    icon: LineChart,
    description:
      'Kompleksowy moduł analityczny łączący transakcje, wielkości koszyka, mix produktowy (Beverage / Food / Merchandise) oraz koszty robocizny w dynamicznych wizualizacjach wielomiesięcznych.',
    plannedFeatures: [
      'Analiza TPLH w ujęciu dobowym i godzinowym (Peak Hours vs Off-Peak)',
      'Porównania realizacji budżetów AOP rok do roku (YoY)',
      'Korelacja obsady grafiku z wskaźnikami Customer Connection Score (CCS)',
      'Wielowymiarowy eksport raportów do arkuszy zarządczych Excel (.xlsx)',
    ],
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  ibs_ims: {
    title: 'IBS & IMS (Inventory & Supply Chain)',
    subtitle: 'Moduł 5: Zamówienia Kawiarni i Gospodarka Magazynowa',
    icon: Boxes,
    description:
      'Integracja z systemem zamówień Starbucks (IBS/IMS), prognozowanie zużycia ziaren kawy, syropów, mleka i opakowań w kawiarni Janki w powiązaniu z ułożonym grafikiem i ruchem transakcyjnym.',
    plannedFeatures: [
      'Kalkulator zamówień cyklicznych (Dostawy chłodnicze, nabiał, suche)',
      'Kontrola stanów magazynowych i comiesięcznej inwentaryzacji (Inv Janki)',
      'Predykcja zapotrzebowania surowcowego wg prognoz AOP i szczytów sezonowych',
      'Rejestr strat (Waste) i powiadomienia o terminach przydatności (FIFO)',
    ],
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
  },
};

export const ModulePlaceholderView: React.FC<ModulePlaceholderViewProps> = ({
  module,
  onNavigate,
}) => {
  const info = MODULE_DATA[module] || {
    title: 'Nowy Moduł Operacyjny',
    subtitle: 'Moduł w przygotowaniu',
    icon: Construction,
    description: 'Moduł znajduje się w fazie projektowej.',
    plannedFeatures: [],
    badgeColor: 'bg-stone-100 text-stone-700 border-stone-200',
  };

  const IconComponent = info.icon;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Pasek powrotu */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onNavigate('dashboard')}
          className="flex items-center space-x-2 text-xs font-bold text-[#1E3932] hover:text-[#006241] bg-white px-3.5 py-2 rounded-xl border border-[#D0DCD6] shadow-2xs hover:bg-stone-50 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Powrót do Podsumowania</span>
        </button>

        <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${info.badgeColor}`}>
          <Sparkles className="w-3.5 h-3.5" />
          <span>W budowie (Scratch)</span>
        </span>
      </div>

      {/* Główna Karta Modułu */}
      <div className="bg-white rounded-3xl border border-[#E2E8E5] p-8 md:p-10 shadow-sm relative overflow-hidden">
        <div className="flex items-start space-x-5 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-[#006241]/10 border border-[#006241]/20 flex items-center justify-center text-[#006241] shrink-0 shadow-xs">
            <IconComponent className="w-8 h-8" />
          </div>

          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#006241] block mb-1">
              {info.subtitle}
            </span>
            <h2 className="text-2xl font-black text-[#1E3932] tracking-tight">
              {info.title}
            </h2>
            <p className="text-sm text-[#5C6F68] mt-2 leading-relaxed max-w-3xl">
              {info.description}
            </p>
          </div>
        </div>

        {/* Planowane Funkcjonalności */}
        <div className="mt-8 pt-8 border-t border-[#E2E8E5]">
          <h3 className="text-sm font-bold text-[#1E3932] uppercase tracking-wider mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#006241]" />
            Planowany Zakres Funkcjonalny:
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {info.plannedFeatures.map((feat, idx) => (
              <div
                key={idx}
                className="bg-[#F7F9F8] p-4 rounded-2xl border border-[#E2E8E5] flex items-start space-x-3 text-xs text-stone-700"
              >
                <span className="w-5 h-5 rounded-full bg-white border border-[#D0DCD6] flex items-center justify-center text-[10px] font-bold text-[#006241] shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <span className="font-medium leading-normal">{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Informacja dla Managera */}
        <div className="mt-8 bg-[#F0F4F2] p-4 rounded-2xl border border-[#D0DCD6] flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 text-stone-600">
            <Construction className="w-4 h-4 text-[#CBA258]" />
            <span>Szablon modułu przygotowany do wdrożenia biznesowego w kolejnym kroku.</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onNavigate('labor_forecast')}
              className="px-3 py-1.5 rounded-xl bg-white border border-[#D0DCD6] font-bold text-[#1E3932] hover:bg-stone-50 cursor-pointer shadow-2xs"
            >
              Przejdź do TPLH Forecast
            </button>
            <button
              onClick={() => onNavigate('managers_schedule')}
              className="px-3 py-1.5 rounded-xl bg-[#006241] text-white font-bold hover:bg-[#00754A] cursor-pointer shadow-2xs"
            >
              Przejdź do Grafiku
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
