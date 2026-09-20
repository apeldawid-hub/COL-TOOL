import React from 'react';
import { TrainingPartner } from '../types';
import { TrainingEngine } from '../services/trainingEngine';
import { 
  CheckCircle2, 
  Clock, 
  Award, 
  Coffee, 
  Sparkles, 
  BookOpen, 
  Compass, 
  Calendar,
  ChevronRight
} from 'lucide-react';

interface PartnerJourneyTrackerProps {
  partner: TrainingPartner;
}

export const PartnerJourneyTracker: React.FC<PartnerJourneyTrackerProps> = ({ partner }) => {
  const milestones = TrainingEngine.calculateMilestones(partner.hire_date);

  const stages = [
    {
      id: 'first_30',
      title: 'First 30 (Pierwsze 30 Dni)',
      subtitle: 'Wdrożenie & Certyfikacja Baristy',
      targetDate: milestones.first30Target,
      dayRange: 'Dni 1 – 30',
      isCurrent: partner.current_program === 'first_30',
      isPassed: partner.current_program !== 'first_30',
      icon: Coffee,
      color: 'emerald',
      keyItems: [
        'First Sip & Wartości Starbucks',
        'Milk Steaming Routine (5 kroków)',
        'Espresso & Cold Bar Skill Checks',
        'Zielona Przypinka (Green Pin) & Certyfikat'
      ]
    },
    {
      id: 'barista_90',
      title: 'Barista 90 (90 Dni)',
      subtitle: 'Relacje & De-eskalacja',
      targetDate: milestones.barista90Target,
      dayRange: 'Dni 31 – 90',
      isCurrent: partner.current_program === 'barista_90',
      isPassed: ['barista_180', 'barista_trainer', 'coffee_master'].includes(partner.current_program),
      icon: Compass,
      color: 'blue',
      keyItems: [
        'Świadomość uprzedzeń i inkluzywność',
        'Metoda LATTE i de-eskalacja napięć',
        '90-Dniowy Check-In ze Store Managerem',
        'Indywidualny plan dalszego rozwoju'
      ]
    },
    {
      id: 'barista_180',
      title: 'Barista 180 (Pół Roku)',
      subtitle: 'Doskonałość Rzemiosła',
      targetDate: milestones.barista180Target,
      dayRange: 'Dni 91 – 180',
      isCurrent: partner.current_program === 'barista_180',
      isPassed: ['barista_trainer', 'coffee_master'].includes(partner.current_program),
      icon: BookOpen,
      color: 'indigo',
      keyItems: [
        'Coffee Academy 200 (Agronomia & sensoryka)',
        'Zaawansowane Latte Art i technika',
        'Półroczny formalny przegląd kompetencji',
        'Kwalifikacja do roli Trenera Baristów'
      ]
    },
    {
      id: 'barista_trainer',
      title: 'Barista Trener (BT)',
      subtitle: 'Nauczanie Innych',
      targetDate: 'Kwalifikacja SM',
      dayRange: 'Od 6+ msc',
      isCurrent: partner.current_program === 'barista_trainer',
      isPassed: partner.current_program === 'coffee_master',
      icon: Sparkles,
      color: 'amber',
      keyItems: [
        'Model Nauczania Starbucks (4 etapy)',
        'Prowadzenie nowych partnerów przez First 30',
        'Wzmocnienie kultury doceniania w zespole',
        'Oficjalna certyfikacja trenerska'
      ]
    },
    {
      id: 'coffee_master',
      title: 'Coffee Master',
      subtitle: 'Czarny Fartuch (Black Apron)',
      targetDate: 'Egzamin Dystryktu',
      dayRange: 'Ekspert Kawowy',
      isCurrent: partner.current_program === 'coffee_master',
      isPassed: false,
      icon: Award,
      color: 'stone',
      keyItems: [
        'Pełen Paszport Kawowy & Degustacje cupping',
        'Historia, sourcing ethical C.A.F.E. Practices',
        'Egzamin przed District Managerem i Zarządem',
        'Uroczyste wręczenie Czarnego Fartucha'
      ]
    }
  ];

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-xs p-5">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-stone-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-bold bg-emerald-100 text-emerald-800 rounded-md border border-emerald-200">
              The Barista Journey
            </span>
            <h3 className="text-base font-bold text-stone-900">
              Ścieżka Rozwoju: {partner.name}
            </h3>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Od pierwszego dnia (First Sip) do Mistrza Kawowego (Coffee Master) wg oficjalnych standardów Starbucks.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-200 text-xs">
          <div className="flex items-center gap-1.5 text-stone-600">
            <Calendar className="w-4 h-4 text-emerald-700" />
            <span>Zatrudniony: <b>{partner.hire_date}</b></span>
          </div>
          <span className="text-stone-300">|</span>
          <div className="text-emerald-800 font-semibold">
            {milestones.daysSinceHire} dni stażu w kawiarni
          </div>
        </div>
      </div>

      {/* Oś Czasu (Timeline) */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {stages.map((stg, index) => {
          const Icon = stg.icon;

          return (
            <div
              key={stg.id}
              className={`rounded-xl p-4 border transition-all relative flex flex-col justify-between ${
                stg.isCurrent
                  ? 'bg-emerald-50/60 border-emerald-500 shadow-sm ring-2 ring-emerald-500/20'
                  : stg.isPassed
                  ? 'bg-stone-50/60 border-emerald-200 text-stone-700'
                  : 'bg-white border-stone-200 text-stone-500 opacity-80'
              }`}
            >
              {/* Wskaźnik statusu u góry */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    Etap {index + 1} • {stg.dayRange}
                  </span>
                  {stg.isPassed ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Zdany
                    </span>
                  ) : stg.isCurrent ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300 animate-pulse">
                      Aktywny
                    </span>
                  ) : (
                    <span className="text-[11px] text-stone-400">Kolejny</span>
                  )}
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                    stg.isCurrent
                      ? 'bg-emerald-700 text-white border-emerald-800'
                      : stg.isPassed
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : 'bg-stone-100 text-stone-400 border-stone-200'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-stone-900 leading-tight">
                      {stg.title}
                    </h4>
                    <p className="text-[11px] text-stone-500">
                      {stg.subtitle}
                    </p>
                  </div>
                </div>

                <div className="text-[11px] text-stone-600 font-mono mb-3 bg-white/80 px-2 py-1 rounded border border-stone-200/60 inline-block">
                  Cel: <b>{stg.targetDate}</b>
                </div>

                {/* Kluczowe zagadnienia */}
                <div className="space-y-1.5 pt-2 border-t border-stone-200/60">
                  {stg.keyItems.map((item, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[11px] text-stone-600">
                      <span className="text-emerald-600 font-bold mt-0.5">•</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dolny badge */}
              <div className="mt-4 pt-3 border-t border-stone-100">
                {stg.isPassed ? (
                  <div className="w-full text-center py-1 bg-emerald-100/70 text-emerald-900 rounded font-bold text-[10px]">
                    ✓ Ukończono
                  </div>
                ) : stg.isCurrent ? (
                  <div className="w-full text-center py-1 bg-emerald-700 text-white rounded font-bold text-[10px] shadow-xs">
                    W trakcie realizacji
                  </div>
                ) : (
                  <div className="w-full text-center py-1 bg-stone-100 text-stone-500 rounded text-[10px]">
                    W kolejce rozwoju
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
