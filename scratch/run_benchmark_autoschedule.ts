import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';
import { fileURLToPath } from 'url';
import {
  AutoSchedulerEngine,
  AutoScheduleOptions,
  AutoScheduleResult
} from '../src/modules/managers-schedule/services/autoSchedulerEngine.js';
import {
  ManagerScheduleEngine,
  POLISH_MONTH_NAMES
} from '../src/modules/managers-schedule/services/managerScheduleEngine.js';
import {
  ManagerEmployee,
  ShiftDefinition,
  ManagerScheduleShift,
  MonthlyNormRecord
} from '../src/types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '../data/tplh_forecast.db');

async function main() {
  console.log('🚀 Uruchamianie Benchmarking AutoScheduling 2026 (Styczeń – Sierpień)...');

  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(fileBuffer);

  // 1. Pobierz definicje zmian
  const shiftDefsStmt = db.prepare('SELECT * FROM shift_definitions ORDER BY code');
  const shiftDefs: ShiftDefinition[] = [];
  while (shiftDefsStmt.step()) {
    shiftDefs.push(shiftDefsStmt.getAsObject() as unknown as ShiftDefinition);
  }
  shiftDefsStmt.free();

  const monthResults: Array<{
    month: number;
    monthName: string;
    nominalFullTime: number;
    employeesCount: number;
    historical: {
      totalHours: number;
      openingCount: number;
      closingCount: number;
      midCount: number;
      ncCount: number;
      offCount: number;
      violations11h: number;
      violations35h: number;
      violationsSunday: number;
      fullWeekendsOff: number;
      consecutiveOffBlocks: number;
      isolatedSingleOff: number;
      empStats: Array<{
        name: string;
        role: string;
        ratio: number;
        nominal: number;
        planned: number;
        balance: number;
        weekendDays: number;
        closings: number;
      }>;
    };
    ai: {
      totalHours: number;
      openingCount: number;
      closingCount: number;
      midCount: number;
      ncCount: number;
      offCount: number;
      violationsCount: number;
      dispositionMatchRate: number;
      weekendFairnessScore: number;
      fullWeekendsOff: number;
      consecutiveOffBlocks: number;
      isolatedSingleOff: number;
      empStats: Array<{
        name: string;
        role: string;
        ratio: number;
        nominal: number;
        planned: number;
        balance: number;
        weekendDays: number;
        closings: number;
      }>;
      conflictsCount: number;
    };
  }> = [];

  let prevAiShifts: ManagerScheduleShift[] = [];

  for (let month = 1; month <= 8; month++) {
    const monthName = POLISH_MONTH_NAMES[month - 1];
    console.log(`\n📅 Przetwarzanie: ${monthName} 2026 (Miesiąc ${month}/8)...`);

    // Pobierz skład na dany miesiąc
    const rosterStmt = db.prepare(`
      SELECT mr.employee_id as id, me.name, mr.role, mr.contract_hours_ratio, mr.hourly_rate, mr.is_active, me.sort_order
      FROM manager_monthly_roster mr
      JOIN manager_employees me ON mr.employee_id = me.id
      WHERE mr.year = 2026 AND mr.month = ${month} AND mr.is_active = 1
      ORDER BY me.sort_order ASC, me.id ASC
    `);
    const employees: ManagerEmployee[] = [];
    while (rosterStmt.step()) {
      employees.push(rosterStmt.getAsObject() as unknown as ManagerEmployee);
    }
    rosterStmt.free();

    // Jeśli brak w rosterze, pobierz ogólnych
    if (employees.length === 0) {
      const allEmpStmt = db.prepare('SELECT * FROM manager_employees WHERE is_active = 1 ORDER BY sort_order ASC');
      while (allEmpStmt.step()) {
        employees.push(allEmpStmt.getAsObject() as unknown as ManagerEmployee);
      }
      allEmpStmt.free();
    }

    // Pobierz normę miesiąca
    const normStmt = db.prepare(`SELECT * FROM manager_monthly_norms WHERE year = 2026 AND month = ${month}`);
    let nominalFullTime = 168;
    if (normStmt.step()) {
      const normObj = normStmt.getAsObject() as unknown as MonthlyNormRecord;
      nominalFullTime = normObj.full_time_nominal_hours || 168;
    }
    normStmt.free();

    // Pobierz istniejące zmiany historyczne
    const shiftsStmt = db.prepare(`SELECT * FROM manager_schedule_shifts WHERE year = 2026 AND month = ${month} ORDER BY day ASC, employee_id ASC`);
    const historicalShifts: ManagerScheduleShift[] = [];
    while (shiftsStmt.step()) {
      historicalShifts.push(shiftsStmt.getAsObject() as unknown as ManagerScheduleShift);
    }
    shiftsStmt.free();

    // Pobierz zmiany graniczne z poprzedniego miesiąca (historyczne)
    let prevHistoricalShifts: ManagerScheduleShift[] = [];
    if (month > 1) {
      const prevShiftsStmt = db.prepare(`SELECT * FROM manager_schedule_shifts WHERE year = 2026 AND month = ${month - 1}`);
      while (prevShiftsStmt.step()) {
        prevHistoricalShifts.push(prevShiftsStmt.getAsObject() as unknown as ManagerScheduleShift);
      }
      prevShiftsStmt.free();
    }

    // Przelicz statystyki historycznego grafiku za pomocą ManagerScheduleEngine
    const histCalculated = ManagerScheduleEngine.calculateMonthData(
      2026,
      month,
      employees,
      shiftDefs,
      historicalShifts,
      [],
      { full_time_nominal_hours: nominalFullTime } as MonthlyNormRecord,
      prevHistoricalShifts.length > 0 ? { prevMonthShifts: prevHistoricalShifts } : undefined
    );

    // Wyciągnij dyspozycje z bazy
    const dispositionsByEmployee: Record<number, Record<number, string>> = {};
    employees.forEach(emp => {
      dispositionsByEmployee[emp.id] = {};
      const empShifts = historicalShifts.filter(s => s.employee_id === emp.id);
      empShifts.forEach(s => {
        if (s.disposition) {
          dispositionsByEmployee[emp.id][s.day] = s.disposition;
        }
      });
    });

    // Uruchom AutoScheduling
    const options: AutoScheduleOptions = {
      mode: 'smart_full',
      allocateMidInPeaks: true,
      respectDispositions: true,
      preserveFixedShifts: true,
      preferConsecutiveOffDays: true,
      balanceFairness: true,
      smoothWeeklyHours: true,
      iterationsCount: 2000
    };

    const aiResult = await AutoSchedulerEngine.generateScheduleAsync(
      2026,
      month,
      employees,
      shiftDefs,
      historicalShifts,
      dispositionsByEmployee,
      options,
      prevAiShifts.length > 0 ? prevAiShifts : prevHistoricalShifts
    );

    prevAiShifts = aiResult.generatedShifts;

    // Analiza jakości Historycznego Grafiku
    let histTotalH = 0;
    let histAM = 0;
    let histPM = 0;
    let histMID = 0;
    let histNC = 0;
    let histOFF = 0;
    let histConsecutiveOff = 0;
    let histIsolatedOff = 0;
    let histFullWeekendsOff = 0;
    const daysInM = new Date(2026, month, 0).getDate();

    const histEmpStats = histCalculated.rows.map(r => {
      let weekendWorked = 0;
      let closings = 0;
      let offBlocks = 0;
      let isolated = 0;
      let fullWeekendOffCount = 0;

      for (let w = 1; w <= 5; w++) {
        // sprawdź weekendy
        const satShift = Object.values(r.shifts).find(s => {
          const d = new Date(2026, month - 1, s.day);
          return d.getDay() === 6;
        });
      }

      for (let d = 1; d <= daysInM; d++) {
        const s = r.shifts[d];
        if (!s) continue;
        const dow = new Date(2026, month - 1, d).getDay();
        const isWknd = dow === 0 || dow === 6;

        if (s.hours > 0 && s.shift_code !== 'OFF') {
          histTotalH += s.hours;
          if (isWknd) weekendWorked++;
          if (s.shift_code === 'AM' || s.shift_code === 'AMN') histAM++;
          else if (s.shift_code === 'PM' || s.shift_code === 'PMN') {
            histPM++;
            closings++;
          } else if (s.shift_code === 'MIB' || s.shift_code === 'MID') histMID++;
          else if (s.shift_code === 'NC') histNC++;
        } else {
          histOFF++;
        }

        // sprawdzanie bloków off
        const prevS = d > 1 ? r.shifts[d - 1] : null;
        const nextS = d < daysInM ? r.shifts[d + 1] : null;
        const isCurOff = !s || s.shift_code === 'OFF' || s.hours === 0;
        const isPrevOff = !prevS || prevS.shift_code === 'OFF' || prevS.hours === 0;
        const isNextOff = !nextS || nextS.shift_code === 'OFF' || nextS.hours === 0;

        if (isCurOff && isPrevOff && (d === daysInM || !isNextOff)) {
          offBlocks++;
        } else if (isCurOff && !isPrevOff && !isNextOff) {
          isolated++;
        }

        if (dow === 6 && d < daysInM) {
          const sunS = r.shifts[d + 1];
          const satOff = isCurOff;
          const sunOff = !sunS || sunS.shift_code === 'OFF' || sunS.hours === 0;
          if (satOff && sunOff) fullWeekendOffCount++;
        }
      }

      histConsecutiveOff += offBlocks;
      histIsolatedOff += isolated;
      if (fullWeekendOffCount > 0) histFullWeekendsOff++;

      return {
        name: r.employee.name,
        role: r.employee.role,
        ratio: r.employee.contract_hours_ratio || 1.0,
        nominal: r.nominalHours,
        planned: r.totalCalculatedHours,
        balance: r.balanceHours,
        weekendDays: weekendWorked,
        closings
      };
    });

    // Zlicz naruszenia KP w grafiku historycznym
    const histViolations = histCalculated.laborLawViolations || [];
    const v11 = histViolations.filter(v => v.article.includes('132') || v.severity === 'error').length;
    const v35 = histViolations.filter(v => v.article.includes('133')).length;
    const vSun = histViolations.filter(v => v.article.includes('151')).length;

    // Zgromadź statystyki AI
    const aiEmpStats = aiResult.employeeStats.map(e => {
      let closings = 0;
      aiResult.generatedShifts
        .filter(s => s.employee_id === e.employeeId)
        .forEach(s => {
          if (s.shift_code === 'PM' || s.shift_code === 'PMN') closings++;
        });

      return {
        name: e.name,
        role: e.role,
        ratio: e.contractRatio,
        nominal: e.nominalHours,
        planned: e.plannedHours,
        balance: e.balanceHours,
        weekendDays: e.weekendDaysCount,
        closings
      };
    });

    monthResults.push({
      month,
      monthName,
      nominalFullTime,
      employeesCount: employees.length,
      historical: {
        totalHours: Number(histTotalH.toFixed(1)),
        openingCount: histAM,
        closingCount: histPM,
        midCount: histMID,
        ncCount: histNC,
        offCount: histOFF,
        violations11h: v11,
        violations35h: v35,
        violationsSunday: vSun,
        fullWeekendsOff: histFullWeekendsOff,
        consecutiveOffBlocks: histConsecutiveOff,
        isolatedSingleOff: histIsolatedOff,
        empStats: histEmpStats
      },
      ai: {
        totalHours: aiResult.stats.totalPlannedHours,
        openingCount: aiResult.stats.openingShiftsCount,
        closingCount: aiResult.stats.closingShiftsCount,
        midCount: aiResult.stats.midShiftsCount,
        ncCount: aiResult.stats.ncShiftsCount,
        offCount: aiResult.generatedShifts.filter(s => s.shift_code === 'OFF' || s.hours === 0).length,
        violationsCount: aiResult.violations.length,
        dispositionMatchRate: aiResult.stats.dispositionMatchRate,
        weekendFairnessScore: aiResult.stats.qualityMetrics?.weekendFairnessScore || 100,
        fullWeekendsOff: aiResult.stats.qualityMetrics?.fullWeekendsOffCount || 0,
        consecutiveOffBlocks: aiResult.stats.qualityMetrics?.consecutiveOffBlocksCount || 0,
        isolatedSingleOff: aiResult.stats.qualityMetrics?.isolatedSingleOffCount || 0,
        empStats: aiEmpStats,
        conflictsCount: aiResult.conflictInsights?.length || 0
      }
    });
  }

  // Zapisz wyniki do pliku JSON
  fs.writeFileSync(
    path.join(__dirname, 'benchmark_results_jan_aug_2026.json'),
    JSON.stringify(monthResults, null, 2),
    'utf-8'
  );

  console.log('\n✅ Zakończono symulację wszystkich 8 miesięcy! Wyniki zapisano do scratch/benchmark_results_jan_aug_2026.json');
}

main().catch(err => {
  console.error('Błąd podczas benchmarkingu:', err);
  process.exit(1);
});
