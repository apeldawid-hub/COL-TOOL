import React from 'react';
import { TrainingPartner, TrainingShift, TrainingSkillCheck } from '../types';
import { TrainingEngine } from '../services/trainingEngine';
import { Users, Clock, Award, CheckCircle2, ShieldAlert, GraduationCap } from 'lucide-react';

interface TrainingStatsCardProps {
  partners: TrainingPartner[];
  allShifts: TrainingShift[];
  skillChecks: TrainingSkillCheck[];
  selectedYear: number;
  selectedMonth: number;
}

export const TrainingStatsCard: React.FC<TrainingStatsCardProps> = ({
  partners,
  allShifts,
  skillChecks,
  selectedYear,
  selectedMonth
}) => {
  const activePartners = partners.filter(p => p.status === 'in_progress');
  const certifiedPartners = partners.filter(p => p.status === 'certified' || p.status === 'completed');

  // Miesięczne godziny T (Non-Coverage Training)
  const monthlyHoursT = TrainingEngine.calculateMonthlyNcTrainingHours(allShifts, selectedYear, selectedMonth);

  // Rozbicie całkowitych godzin
  const hoursSummary = TrainingEngine.calculateHoursSummary(allShifts);

  // Zdawalność egzaminów
  const passedChecks = skillChecks.filter(sc => sc.is_passed).length;
  const totalChecks = skillChecks.length;
  const passRatePct = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 100;

  // Sprawdzenie Sanepid (wygasające w ciągu 30 dni)
  const now = new Date();
  const warningSanepid = partners.filter(p => {
    if (!p.sanepid_valid_until) return false;
    const sanDate = new Date(p.sanepid_valid_until);
    const diffDays = (sanDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays < 30;
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Karta 1: Partnerzy w szkoleniu */}
      <div className="bg-white rounded-xl p-4 border border-stone-200 shadow-xs hover:border-emerald-300 transition-all">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Partnerzy w procesie</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-stone-900">{activePartners.length}</span>
              <span className="text-xs text-stone-500">/ {partners.length} łącznie</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
            <Users className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-stone-600 pt-2 border-t border-stone-100">
          <span className="flex items-center gap-1 text-emerald-700 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" /> {certifiedPartners.length} certyfikowanych
          </span>
          {warningSanepid.length > 0 && (
            <span className="flex items-center gap-1 text-amber-700 font-medium bg-amber-50 px-1.5 py-0.5 rounded-sm border border-amber-200" title="Wygasające orzeczenia Sanepid">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600" /> {warningSanepid.length} Sanepid alert
            </span>
          )}
        </div>
      </div>

      {/* Karta 2: Inwestycja w Zmiany T (Miesiąc) */}
      <div className="bg-white rounded-xl p-4 border border-stone-200 shadow-xs hover:border-emerald-300 transition-all">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Godziny T (NC Trening)</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-emerald-800">{monthlyHoursT.toFixed(1)} h</span>
              <span className="text-xs text-stone-500">w tym miesiącu</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center border border-amber-200">
            <Clock className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3 text-xs text-stone-500 pt-2 border-t border-stone-100 flex items-center justify-between">
          <span>Barista T: <b className="text-stone-700">{hoursSummary.totalBaristaPlanned}h</b></span>
          <span>Trener T: <b className="text-stone-700">{hoursSummary.totalTrainerPlanned}h</b></span>
          <span>SM T: <b className="text-stone-700">{hoursSummary.totalSmPlanned}h</b></span>
        </div>
      </div>

      {/* Karta 3: Postęp sesji szkoleniowych */}
      <div className="bg-white rounded-xl p-4 border border-stone-200 shadow-xs hover:border-emerald-300 transition-all">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Zrealizowane Zmiany T</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-stone-900">{hoursSummary.progressPct}%</span>
              <span className="text-xs text-stone-500">
                ({hoursSummary.completedCount}/{hoursSummary.shiftsCount} sesji)
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100">
            <GraduationCap className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3 pt-2 border-t border-stone-100">
          <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-emerald-600 h-2 rounded-full transition-all duration-500" 
              style={{ width: `${hoursSummary.progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Karta 4: Egzaminy & Skill Checki */}
      <div className="bg-white rounded-xl p-4 border border-stone-200 shadow-xs hover:border-emerald-300 transition-all">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Zdawalność Skill Check</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-amber-900">{passRatePct}%</span>
              <span className="text-xs text-stone-500">({passedChecks}/{totalChecks} zdanych)</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200">
            <Award className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-stone-600 pt-2 border-t border-stone-100">
          <span>Standard: Milk, Bar & Cold</span>
          <span className="font-semibold text-emerald-800">Próg min. 80%</span>
        </div>
      </div>
    </div>
  );
};
