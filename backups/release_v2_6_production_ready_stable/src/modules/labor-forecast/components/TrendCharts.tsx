import React, { useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  LineChart,
  AreaChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import {
  BarChart3,
  LineChart as LineChartIcon,
  Layers,
  TrendingUp,
  Clock,
  Target,
  Zap,
  Check,
} from 'lucide-react';
import { WeeklyCalculatedRow, AopPlanRecord } from '../../../types';

interface TrendChartsProps {
  rows: WeeklyCalculatedRow[];
  monthPlan: AopPlanRecord;
}

type MetricMode = 'labor' | 'trx' | 'tplh' | 'combo';
type ChartType = 'bar' | 'area' | 'line';

export const TrendCharts: React.FC<TrendChartsProps> = ({ rows, monthPlan }) => {
  const [metricMode, setMetricMode] = useState<MetricMode>('labor');
  const [chartType, setChartType] = useState<ChartType>('bar');

  // Aktywne warstwy (widoczność poszczególnych serii)
  const [visibleSeries, setVisibleSeries] = useState<{ [key: string]: boolean }>({
    planHours: true,
    actualHours: true,
    scheduledHours: true,
    floorHours: true,
    hanwHours: true,
    planTrx: true,
    actualTrx: true,
    planTplh: true,
    actualTplh: true,
  });

  const toggleSeries = (key: string) => {
    setVisibleSeries((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const targetTplh = monthPlan.target_tplh;

  // Przygotowanie danych dla Recharts
  const chartData = rows.map((r) => ({
    name: r.week.week_num_in_month,
    fullLabel: `${r.week.week_num_in_month} (${r.week.date_from} – ${r.week.date_to})`,
    planHours: Number(r.planHours.toFixed(1)),
    actualHours: r.actualHours !== null && r.actualHours > 0 ? Number(r.actualHours.toFixed(1)) : null,
    scheduledHours: r.scheduledHours !== null && r.scheduledHours > 0 ? Number(r.scheduledHours.toFixed(1)) : null,
    floorHours: Number(r.calculatedFloorHours.toFixed(1)),
    hanwHours: r.hanwRecommendation !== null ? Number(r.hanwRecommendation.toFixed(1)) : null,
    planTrx: r.planTrx,
    actualTrx: r.actualTrx,
    planTplh: Number(r.planTplh.toFixed(2)),
    actualTplh: r.actualTplh !== null ? Number(r.actualTplh.toFixed(2)) : null,
    status: r.status,
  }));

  // Szybkie metryki diagnostyczne
  const totalActualHours = rows.reduce((sum, r) => sum + (r.actualHours || 0), 0);
  const totalPlanHours = rows.reduce((sum, r) => sum + r.planHours, 0);
  const closedWeeksCount = rows.filter((r) => r.isClosed).length;
  const avgActualTplh =
    closedWeeksCount > 0
      ? Number(
          (
            rows.filter((r) => r.isClosed).reduce((sum, r) => sum + (r.actualTplh || 0), 0) /
            closedWeeksCount
          ).toFixed(2)
        )
      : null;

  return (
    <div className="bg-white border border-[#E2E8E5] rounded-2xl p-6 shadow-xs mb-6">
      {/* Pasek Nawigacyjny i Konfiguracja Wykresu */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-5 border-b border-[#E2E8E5]">
        <div>
          <h3 className="text-base font-black text-[#1E3932] tracking-tight flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#006241]" />
            Centrum Analityczne Trendów i Balansowania
          </h3>
          <p className="text-xs text-[#5C6F68] mt-0.5">
            Dostosuj widok metryk, typ prezentacji danych oraz włączaj lub wyłączaj pojedyncze warstwy.
          </p>
        </div>

        {/* Grupy Przełączników */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Przełącznik Metryk */}
          <div className="flex items-center bg-[#F4F7F5] p-1 rounded-xl border border-[#E2E8E5]">
            <button
              onClick={() => setMetricMode('labor')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                metricMode === 'labor'
                  ? 'bg-[#006241] text-white shadow-xs'
                  : 'text-[#5C6F68] hover:text-[#1E3932]'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Robocizna (h)
            </button>
            <button
              onClick={() => setMetricMode('trx')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                metricMode === 'trx'
                  ? 'bg-[#006241] text-white shadow-xs'
                  : 'text-[#5C6F68] hover:text-[#1E3932]'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              Transakcje (TRX)
            </button>
            <button
              onClick={() => setMetricMode('tplh')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                metricMode === 'tplh'
                  ? 'bg-[#006241] text-white shadow-xs'
                  : 'text-[#5C6F68] hover:text-[#1E3932]'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              TPLH
            </button>
            <button
              onClick={() => setMetricMode('combo')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                metricMode === 'combo'
                  ? 'bg-[#006241] text-white shadow-xs'
                  : 'text-[#5C6F68] hover:text-[#1E3932]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Mieszany (h + TPLH)
            </button>
          </div>

          {/* Przełącznik Typu Wykresu (Słupkowy / Warstwowy / Liniowy) */}
          {metricMode !== 'combo' && (
            <div className="flex items-center bg-[#F4F7F5] p-1 rounded-xl border border-[#E2E8E5]">
              <button
                onClick={() => setChartType('bar')}
                title="Wykres Słupkowy"
                className={`p-1.5 rounded-lg text-xs transition-all ${
                  chartType === 'bar'
                    ? 'bg-white text-[#006241] shadow-2xs font-bold'
                    : 'text-[#5C6F68] hover:text-[#1E3932]'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setChartType('area')}
                title="Wykres Obszarowy (Gradient)"
                className={`p-1.5 rounded-lg text-xs transition-all ${
                  chartType === 'area'
                    ? 'bg-white text-[#006241] shadow-2xs font-bold'
                    : 'text-[#5C6F68] hover:text-[#1E3932]'
                }`}
              >
                <Layers className="w-4 h-4" />
              </button>
              <button
                onClick={() => setChartType('line')}
                title="Wykres Liniowy"
                className={`p-1.5 rounded-lg text-xs transition-all ${
                  chartType === 'line'
                    ? 'bg-white text-[#006241] shadow-2xs font-bold'
                    : 'text-[#5C6F68] hover:text-[#1E3932]'
                }`}
              >
                <LineChartIcon className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Pasek Aktywnych Warstw (Toggles) */}
      <div className="py-3 flex flex-wrap items-center gap-2 text-xs border-b border-[#EEF2F0]">
        <span className="text-[#5C6F68] font-bold text-[11px] uppercase tracking-wider mr-1">
          Warstwy:
        </span>

        {/* Warstwy dla Robocizny */}
        {(metricMode === 'labor' || metricMode === 'combo') && (
          <>
            <button
              onClick={() => toggleSeries('planHours')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold border transition-all ${
                visibleSeries.planHours
                  ? 'bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]'
                  : 'bg-transparent text-gray-400 border-gray-200 line-through opacity-60'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#94A3B8]" />
              Plan Godziny
              {visibleSeries.planHours && <Check className="w-3 h-3 ml-0.5 text-[#475569]" />}
            </button>

            <button
              onClick={() => toggleSeries('scheduledHours')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold border transition-all ${
                visibleSeries.scheduledHours
                  ? 'bg-[#EEF2FF] text-[#4F46E5] border-[#C7D2FE]'
                  : 'bg-transparent text-gray-400 border-gray-200 line-through opacity-60'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#6366F1]" />
              Grafik (Sched.)
              {visibleSeries.scheduledHours && <Check className="w-3 h-3 ml-0.5 text-[#4F46E5]" />}
            </button>

            <button
              onClick={() => toggleSeries('actualHours')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold border transition-all ${
                visibleSeries.actualHours
                  ? 'bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD]'
                  : 'bg-transparent text-gray-400 border-gray-200 line-through opacity-60'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#0284C7]" />
              Rzeczywiste RCP
              {visibleSeries.actualHours && <Check className="w-3 h-3 ml-0.5 text-[#0369A1]" />}
            </button>

            <button
              onClick={() => toggleSeries('hanwHours')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold border transition-all ${
                visibleSeries.hanwHours
                  ? 'bg-[#DCFCE7] text-[#006241] border-[#86EFAC]'
                  : 'bg-transparent text-gray-400 border-gray-200 line-through opacity-60'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#006241]" />
              H Plan
              {visibleSeries.hanwHours && <Check className="w-3 h-3 ml-0.5 text-[#006241]" />}
            </button>

            <button
              onClick={() => toggleSeries('floorHours')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold border transition-all ${
                visibleSeries.floorHours
                  ? 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]'
                  : 'bg-transparent text-gray-400 border-gray-200 line-through opacity-60'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
              Floor Hours (Min.)
              {visibleSeries.floorHours && <Check className="w-3 h-3 ml-0.5 text-[#DC2626]" />}
            </button>
          </>
        )}

        {/* Warstwy dla Transakcji */}
        {metricMode === 'trx' && (
          <>
            <button
              onClick={() => toggleSeries('planTrx')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold border transition-all ${
                visibleSeries.planTrx
                  ? 'bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]'
                  : 'bg-transparent text-gray-400 border-gray-200 line-through opacity-60'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#94A3B8]" />
              Plan TRX
              {visibleSeries.planTrx && <Check className="w-3 h-3 ml-0.5 text-[#475569]" />}
            </button>

            <button
              onClick={() => toggleSeries('actualTrx')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold border transition-all ${
                visibleSeries.actualTrx
                  ? 'bg-[#DCFCE7] text-[#006241] border-[#86EFAC]'
                  : 'bg-transparent text-gray-400 border-gray-200 line-through opacity-60'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#006241]" />
              Rzeczywiste TRX
              {visibleSeries.actualTrx && <Check className="w-3 h-3 ml-0.5 text-[#006241]" />}
            </button>
          </>
        )}

        {/* Warstwy dla TPLH */}
        {(metricMode === 'tplh' || metricMode === 'combo') && (
          <>
            <button
              onClick={() => toggleSeries('planTplh')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold border transition-all ${
                visibleSeries.planTplh
                  ? 'bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]'
                  : 'bg-transparent text-gray-400 border-gray-200 line-through opacity-60'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
              Plan TPLH
              {visibleSeries.planTplh && <Check className="w-3 h-3 ml-0.5 text-[#B45309]" />}
            </button>

            <button
              onClick={() => toggleSeries('actualTplh')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold border transition-all ${
                visibleSeries.actualTplh
                  ? 'bg-[#DCFCE7] text-[#006241] border-[#86EFAC]'
                  : 'bg-transparent text-gray-400 border-gray-200 line-through opacity-60'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#006241]" />
              Actual TPLH
              {visibleSeries.actualTplh && <Check className="w-3 h-3 ml-0.5 text-[#006241]" />}
            </button>
          </>
        )}
      </div>

      {/* Główny Obszar Wykresu */}
      <div className="h-80 w-full pt-4">
        <ResponsiveContainer width="100%" height="100%">
          {metricMode === 'combo' ? (
            <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorScheduled" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0.2} />
                </linearGradient>
                <linearGradient id="colorActualH" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0284C7" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#0284C7" stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F0" vertical={false} />
              <XAxis dataKey="name" stroke="#5C6F68" tick={{ fill: '#5C6F68', fontSize: 11, fontWeight: 'bold' }} />
              {/* Oś lewa: Godziny */}
              <YAxis
                yAxisId="left"
                domain={[0, 'auto']}
                stroke="#5C6F68"
                tick={{ fill: '#5C6F68', fontSize: 11 }}
                unit=" h"
              />
              {/* Oś prawa: TPLH */}
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[4, 'auto']}
                stroke="#CBA258"
                tick={{ fill: '#B45309', fontSize: 11, fontWeight: 'bold' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#C8E6C9',
                  borderRadius: '12px',
                  color: '#1E3932',
                  fontSize: '12px',
                  boxShadow: '0 8px 16px -2px rgba(0, 0, 0, 0.08)',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <ReferenceLine
                yAxisId="right"
                y={targetTplh}
                stroke="#CBA258"
                strokeWidth={2}
                strokeDasharray="4 4"
                label={{
                  value: `Cel: ${targetTplh.toFixed(2)}`,
                  fill: '#B45309',
                  fontSize: 10,
                  fontWeight: 'bold',
                  position: 'insideTopRight',
                }}
              />
              {visibleSeries.planHours && (
                <Bar yAxisId="left" dataKey="planHours" name="Plan Godziny" fill="#CBD5E1" radius={[4, 4, 0, 0]} />
              )}
              {visibleSeries.scheduledHours && (
                <Bar yAxisId="left" dataKey="scheduledHours" name="Grafik (Sched.)" fill="url(#colorScheduled)" radius={[4, 4, 0, 0]} />
              )}
              {visibleSeries.actualHours && (
                <Bar yAxisId="left" dataKey="actualHours" name="Act Godziny" fill="url(#colorActualH)" radius={[4, 4, 0, 0]} />
              )}
              {visibleSeries.floorHours && (
                <Line yAxisId="left" type="stepAfter" dataKey="floorHours" name="Floor Hours" stroke="#EF4444" strokeWidth={2} strokeDasharray="3 3" dot={{ r: 3 }} />
              )}
              {visibleSeries.planTplh && (
                <Line yAxisId="right" type="monotone" dataKey="planTplh" name="Plan TPLH" stroke="#F59E0B" strokeWidth={2} dot={{ r: 4 }} />
              )}
              {visibleSeries.actualTplh && (
                <Line yAxisId="right" type="monotone" dataKey="actualTplh" name="Actual TPLH" stroke="#006241" strokeWidth={3} dot={{ r: 5, fill: '#006241' }} />
              )}
            </ComposedChart>
          ) : chartType === 'bar' ? (
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F0" vertical={false} />
              <XAxis dataKey="name" stroke="#5C6F68" tick={{ fill: '#5C6F68', fontSize: 11, fontWeight: 'bold' }} />
              <YAxis domain={[0, 'auto']} stroke="#5C6F68" tick={{ fill: '#5C6F68', fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#C8E6C9',
                  borderRadius: '12px',
                  color: '#1E3932',
                  fontSize: '12px',
                  boxShadow: '0 8px 16px -2px rgba(0, 0, 0, 0.08)',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />

              {metricMode === 'labor' && (
                <>
                  {visibleSeries.floorHours && (
                    <ReferenceLine
                      y={272}
                      stroke="#EF4444"
                      strokeDasharray="4 4"
                      label={{ value: 'Floor 272h', fill: '#DC2626', fontSize: 10, position: 'insideTopLeft' }}
                    />
                  )}
                  {visibleSeries.planHours && (
                    <Bar dataKey="planHours" name="Plan Godziny" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                  )}
                  {visibleSeries.scheduledHours && (
                    <Bar dataKey="scheduledHours" name="Grafik (Sched.)" fill="#6366F1" radius={[4, 4, 0, 0]} />
                  )}
                  {visibleSeries.actualHours && (
                    <Bar dataKey="actualHours" name="Rzeczywiste RCP" fill="#0284C7" radius={[4, 4, 0, 0]} />
                  )}
                  {visibleSeries.hanwHours && (
                    <Bar dataKey="hanwHours" name="H Plan" fill="#006241" radius={[4, 4, 0, 0]} />
                  )}
                </>
              )}

              {metricMode === 'trx' && (
                <>
                  {visibleSeries.planTrx && (
                    <Bar dataKey="planTrx" name="Plan TRX" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                  )}
                  {visibleSeries.actualTrx && (
                    <Bar dataKey="actualTrx" name="Rzeczywiste TRX" fill="#006241" radius={[4, 4, 0, 0]} />
                  )}
                </>
              )}

              {metricMode === 'tplh' && (
                <>
                  <ReferenceLine
                    y={targetTplh}
                    stroke="#CBA258"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    label={{
                      value: `Cel: ${targetTplh.toFixed(2)}`,
                      fill: '#B45309',
                      fontSize: 10,
                      fontWeight: 'bold',
                      position: 'insideTopRight',
                    }}
                  />
                  {visibleSeries.planTplh && (
                    <Bar dataKey="planTplh" name="Plan TPLH" fill="#FCD34D" radius={[4, 4, 0, 0]} />
                  )}
                  {visibleSeries.actualTplh && (
                    <Bar dataKey="actualTplh" name="Actual TPLH" fill="#006241" radius={[4, 4, 0, 0]} />
                  )}
                </>
              )}
            </BarChart>
          ) : chartType === 'area' ? (
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="areaGreen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#006241" stopOpacity={0.7} />
                  <stop offset="95%" stopColor="#006241" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="areaBlue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0284C7" stopOpacity={0.7} />
                  <stop offset="95%" stopColor="#0284C7" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F0" vertical={false} />
              <XAxis dataKey="name" stroke="#5C6F68" tick={{ fill: '#5C6F68', fontSize: 11, fontWeight: 'bold' }} />
              <YAxis domain={[0, 'auto']} stroke="#5C6F68" tick={{ fill: '#5C6F68', fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#C8E6C9',
                  borderRadius: '12px',
                  color: '#1E3932',
                  fontSize: '12px',
                  boxShadow: '0 8px 16px -2px rgba(0, 0, 0, 0.08)',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />

              {metricMode === 'labor' && (
                <>
                  {visibleSeries.planHours && (
                    <Area type="monotone" dataKey="planHours" name="Plan Godziny" stroke="#94A3B8" fill="#CBD5E1" fillOpacity={0.3} />
                  )}
                  {visibleSeries.actualHours && (
                    <Area type="monotone" dataKey="actualHours" name="Rzeczywiste RCP" stroke="#0284C7" fill="url(#areaBlue)" />
                  )}
                  {visibleSeries.hanwHours && (
                    <Area type="monotone" dataKey="hanwHours" name="HANW" stroke="#006241" fill="url(#areaGreen)" />
                  )}
                </>
              )}

              {metricMode === 'trx' && (
                <>
                  {visibleSeries.planTrx && (
                    <Area type="monotone" dataKey="planTrx" name="Plan TRX" stroke="#94A3B8" fill="#CBD5E1" fillOpacity={0.3} />
                  )}
                  {visibleSeries.actualTrx && (
                    <Area type="monotone" dataKey="actualTrx" name="Rzeczywiste TRX" stroke="#006241" fill="url(#areaGreen)" />
                  )}
                </>
              )}

              {metricMode === 'tplh' && (
                <>
                  <ReferenceLine y={targetTplh} stroke="#CBA258" strokeWidth={2} strokeDasharray="4 4" />
                  {visibleSeries.planTplh && (
                    <Area type="monotone" dataKey="planTplh" name="Plan TPLH" stroke="#F59E0B" fill="#FEF3C7" fillOpacity={0.4} />
                  )}
                  {visibleSeries.actualTplh && (
                    <Area type="monotone" dataKey="actualTplh" name="Actual TPLH" stroke="#006241" fill="url(#areaGreen)" />
                  )}
                </>
              )}
            </AreaChart>
          ) : (
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F0" vertical={false} />
              <XAxis dataKey="name" stroke="#5C6F68" tick={{ fill: '#5C6F68', fontSize: 11, fontWeight: 'bold' }} />
              <YAxis domain={[0, 'auto']} stroke="#5C6F68" tick={{ fill: '#5C6F68', fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#C8E6C9',
                  borderRadius: '12px',
                  color: '#1E3932',
                  fontSize: '12px',
                  boxShadow: '0 8px 16px -2px rgba(0, 0, 0, 0.08)',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />

              {metricMode === 'labor' && (
                <>
                  {visibleSeries.floorHours && (
                    <ReferenceLine y={272} stroke="#EF4444" strokeDasharray="4 4" />
                  )}
                  {visibleSeries.planHours && (
                    <Line type="monotone" dataKey="planHours" name="Plan Godziny" stroke="#94A3B8" strokeWidth={2} dot={{ r: 4 }} />
                  )}
                  {visibleSeries.scheduledHours && (
                    <Line type="monotone" dataKey="scheduledHours" name="Grafik (Sched.)" stroke="#6366F1" strokeWidth={2.5} strokeDasharray="5 5" dot={{ r: 4 }} />
                  )}
                  {visibleSeries.actualHours && (
                    <Line type="monotone" dataKey="actualHours" name="Rzeczywiste RCP" stroke="#0284C7" strokeWidth={2.5} dot={{ r: 5 }} />
                  )}
                  {visibleSeries.hanwHours && (
                    <Line type="monotone" dataKey="hanwHours" name="HANW" stroke="#006241" strokeWidth={3} dot={{ r: 6 }} />
                  )}
                </>
              )}

              {metricMode === 'trx' && (
                <>
                  {visibleSeries.planTrx && (
                    <Line type="monotone" dataKey="planTrx" name="Plan TRX" stroke="#94A3B8" strokeWidth={2} dot={{ r: 4 }} />
                  )}
                  {visibleSeries.actualTrx && (
                    <Line type="monotone" dataKey="actualTrx" name="Rzeczywiste TRX" stroke="#006241" strokeWidth={3} dot={{ r: 5 }} />
                  )}
                </>
              )}

              {metricMode === 'tplh' && (
                <>
                  <ReferenceLine y={targetTplh} stroke="#CBA258" strokeWidth={2} strokeDasharray="4 4" />
                  {visibleSeries.planTplh && (
                    <Line type="monotone" dataKey="planTplh" name="Plan TPLH" stroke="#F59E0B" strokeWidth={2} dot={{ r: 4 }} />
                  )}
                  {visibleSeries.actualTplh && (
                    <Line type="monotone" dataKey="actualTplh" name="Actual TPLH" stroke="#006241" strokeWidth={3} dot={{ r: 5 }} />
                  )}
                </>
              )}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Mini Kafelki Diagnostyczne pod Wykresem */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-[#EEF2F0]">
        <div className="bg-[#F8FAF9] p-3 rounded-xl border border-[#E2E8E5]">
          <span className="text-[10px] font-bold text-[#5C6F68] uppercase block">
            Plan vs Realizacja RCP
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-sm font-black text-[#1E3932]">
              {totalActualHours.toFixed(1)} h
            </span>
            <span className="text-[11px] text-[#5C6F68]">/ {totalPlanHours.toFixed(1)} h</span>
          </div>
        </div>

        <div className="bg-[#F8FAF9] p-3 rounded-xl border border-[#E2E8E5]">
          <span className="text-[10px] font-bold text-[#5C6F68] uppercase block">
            Średnie TPLH (Zamknięte)
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span
              className={`text-sm font-black ${
                avgActualTplh !== null && avgActualTplh >= targetTplh
                  ? 'text-[#006241]'
                  : 'text-[#B45309]'
              }`}
            >
              {avgActualTplh !== null ? avgActualTplh.toFixed(2) : '—'}
            </span>
            <span className="text-[11px] text-[#5C6F68]">
              (Cel: {targetTplh.toFixed(2)})
            </span>
          </div>
        </div>

        <div className="bg-[#F8FAF9] p-3 rounded-xl border border-[#E2E8E5]">
          <span className="text-[10px] font-bold text-[#5C6F68] uppercase block">
            Złota Bariera Bezpieczeństwa
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-sm font-black text-[#DC2626]">272.0 h</span>
            <span className="text-[11px] text-[#5C6F68]">/ pełny tydzień</span>
          </div>
        </div>

        <div className="bg-[#F8FAF9] p-3 rounded-xl border border-[#E2E8E5]">
          <span className="text-[10px] font-bold text-[#5C6F68] uppercase block">
            Status Miesiąca AOP
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-sm font-black text-[#006241]">
              {closedWeeksCount} / {rows.length}
            </span>
            <span className="text-[11px] text-[#5C6F68]">zamkniętych tyg.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
