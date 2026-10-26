# Handoff Report — Explorer R1: Labor Code & Janki Standards Audit

## 1. Observation
- **Codebase inspection**:
  - `src/modules/managers-schedule/services/managerScheduleEngine.ts:334-373`: Method `calculateMonthNorms` computes monthly work norm via `workingDaysCount - saturdayHolidays` times 8.0h.
  - `src/modules/managers-schedule/services/managerScheduleEngine.ts:414-471`: Method `validateLaborLaw` checks 11h daily rest between consecutive shifts $(24.0 - \text{endHour}_1) + \text{startHour}_2 < 11.0$.
  - `src/modules/managers-schedule/services/managerScheduleEngine.ts:651-688`: Weekly rest is checked strictly via `consecutiveWorkingDaysCount >= 7`, ignoring the actual continuous rest hours between shifts.
  - `src/modules/managers-schedule/services/managerScheduleEngine.ts:809-819`: Hours for `H` (vacation) and `L4` (sick leave) are unconditionally overwritten as `Number((8.0 * empRatio).toFixed(1))` on workdays and 0.0h on weekends/holidays.
  - `src/modules/managers-schedule/constants/defaultShifts.ts:31-53`: `AMN` is defined as 8.0h (08:00–16:00) and `PMN` as 8.0h (13:00–21:00).
  - `electron/main.ts:948-959`: SQLite boundary query retrieves previous month shifts with `WHERE year = ? AND month = ? AND day >= 22`.
- **Reference workbook inspection (`Grafik/Grafik wrzesień Janki 2026.xlsm`)**:
  - Sheet `Lists` (`sheet8.xml`, rows 3–4): `AMN` is defined as 6.0h (08:00–14:00, cell P3: 0.25) and `PMN` as 7.0h (14:00–21:00, cell P4: 0.291667).
  - Sheet `Schedule` (`sheet2.xml`, rows 15–21): September 2026 roster (7 managers, 6.25 FTE) totals 1088.0 worked hours (808.0h RCP, 104.0h H, 176.0h L4) against a 1100.0h norm, resulting in -12.0h team balance.
  - Sheet `Schedules` (`sheet3.xml`, row 131): Shift code `INV` (inwentaryzacja) is used on August 31, but is missing from `defaultShifts.ts`.
  - Sheet `TOR` (`sheet10.xml`, rows 30–38): 3-column quarterly model (`RCP`, `H`, `L4`, `BILANS`) is used with lookup table `AF4:AG14`.

## 2. Logic Chain
1. Under art. 133 § 1 KP, an employee must have at least 35 continuous hours of rest every week. A rotation of Saturday PM (ends 22:30) $\rightarrow$ Sunday OFF $\rightarrow$ Monday AM (starts 07:00) yields $(24 - 22.5) + 24 + 7 = 32.5$ hours of rest ($32.5 < 35.0$). Because `managerScheduleEngine.ts` uses `consecutiveWorkingDaysCount >= 7`, Sunday OFF resets the counter to 0, completely failing to detect this illegal 32.5h turnaround.
2. Under art. 151¹⁰ KP, an employee working on Sundays must have at least one free Sunday every 4 weeks. When checking the start of month $M$, `electron/main.ts:951` only queries `day >= 22` of month $M-1$. Any working Sunday before day 22 (e.g. day 17) is missing from `boundaryShifts`, causing `ManagerScheduleEngine.validateLaborLaw:611` to terminate backwards iteration prematurely (`else { break; }`) and miscalculating a 4-week Sunday violation.
3. In `defaultShifts.ts`, defining `AMN` as 8.0h (08:00–16:00) and `PMN` as 8.0h (13:00–21:00) contradicts `Grafik wrzesień Janki 2026.xlsm` (6.0h and 7.0h), artificially inflating monthly manager labor by 12–15h per month, distorting TOR balances by +36h per quarter, and creating an unnecessary 3-hour manager overlap on low-traffic non-trading Sundays.
4. Under art. 154² § 1 KP, vacation leave is granted in hours corresponding to the scheduled shift duration on that day. In `managerScheduleEngine.ts:812`, `s.hours` is unconditionally overwritten with `8.0 * empRatio`, preventing proper deduction of custom-length shifts (e.g. 10h or 4h).
5. The `manager_monthly_roster` database table stores `contract_hours_ratio` as a single value per month. When an employee transitions FTE mid-month (e.g. 0.5 $\rightarrow$ 1.0 FTE on day 15), the monthly norm is either under- or over-calculated by ~44h, generating false overtime or undertime in the schedule and TOR.

## 3. Caveats
- The audit was conducted in strict read-only design mode; no source code or database files were modified.
- The 0.0h valuation for weekend vacation (`H`) reflects retail practice to preserve annual leave pools; however, under a strict reading of art. 154² KP, scheduled weekend shifts should deduct vacation hours from the pool if the employee was rostered to work.
- The reference workbook uses custom VBA macros (`WYSZUKIWACZ`) which evaluate to `#NAME?` in non-macro environments, but the underlying XML formulas, lookup tables, and cell values were fully reverse-engineered via zip/XML inspection.

## 4. Conclusion
Module 2's core mathematical engine (`ManagerScheduleEngine`) and quarterly model (`TorEngine`) accurately reflect the calculations in `Grafik wrzesień Janki 2026.xlsm`. However, critical legal and operational defects exist:
1. [P0] Critical PIP compliance vulnerability in art. 133 KP (32.5h weekend turnaround undetected).
2. [P0] Data truncation in `electron/main.ts:951` causing false passes for 4th consecutive Sunday violations.
3. [P0] Shift catalog discrepancy for `AMN` (6h) and `PMN` (7h) causing phantom hours and TOR distortion.
4. [P1] Missing `INV` shift code in `defaultShifts.ts`.
5. [P1] Lack of statutory holiday commercial trading check (art. 151⁹ᵃ KP).
6. [P2] Inability to model mid-month FTE contract changes.

A comprehensive audit report has been produced and saved at:
`/Users/dawidapel/COL Tool/.agents/teamwork/explorer_r1/report_r1_labor_code.md`.

## 5. Verification Method
1. Inspect the complete audit report:
   `view_file AbsolutePath="/Users/dawidapel/COL Tool/.agents/teamwork/explorer_r1/report_r1_labor_code.md"`
2. Verify Excel parity and formulas:
   Run python script against `Grafik/Grafik wrzesień Janki 2026.xlsm` to verify `Lists!P3:P4` (0.25 and 0.291667 for AMN/PMN) and `Schedule!K15:AO21`.
3. Verify codebase citations:
   - `view_file AbsolutePath="/Users/dawidapel/COL Tool/src/modules/managers-schedule/services/managerScheduleEngine.ts" StartLine=650 EndLine=690` (art. 133 KP heuristic)
   - `view_file AbsolutePath="/Users/dawidapel/COL Tool/electron/main.ts" StartLine=945 EndLine=960` (`day >= 22` SQL limitation)
   - `view_file AbsolutePath="/Users/dawidapel/COL Tool/src/modules/managers-schedule/constants/defaultShifts.ts" StartLine=30 EndLine=55` (`AMN`/`PMN` 8.0h definitions)
