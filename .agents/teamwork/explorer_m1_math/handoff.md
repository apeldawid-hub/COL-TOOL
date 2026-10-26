# Handoff Report — Math & Forecasting Engine Audit (Module 1: Labor Forecast)

**Agent ID**: `explorer_m1_math`  
**Working Directory**: `/Users/dawidapel/COL Tool/.agents/teamwork/explorer_m1_math`  
**Recipient**: `parent` (`03bbd3fb-1f39-425e-8127-f2a22610fd5f`)  
**Mission**: Exhaustive mathematical, algorithmic, and statistical audit of Module 1: Labor Forecast  
**Report Artifact**: `/Users/dawidapel/COL Tool/.agents/teamwork/explorer_m1_math/report_m1_math.md`  

---

## 1. Observation

1. **Division by zero in `calculateCrossMonthBridge`**:
   - In `src/modules/labor-forecast/services/calculationEngine.ts`:
     - Line 1395:
       ```typescript
       const nextPlanHours = Number(
         ((nextFloorHours / 224.0) * (lastRow.planHours / (lastRow.calculatedDaysCount / 7))).toFixed(1)
       ) || nextFloorHours;
       ```
     - Line 1513:
       ```typescript
       const prevPlanHours = Number(
         ((prevFloorHours / 224.0) * (firstRow.planHours / (firstRow.calculatedDaysCount / 7))).toFixed(1)
       ) || prevFloorHours;
       ```
     - Line 1376:
       `if (lastRow && lastRow.isPartial && lastRow.calculatedDaysCount < 7 && lastRow.week.week_num_in_month !== 'W1')`
     - Condition checks `< 7`, but does not guard against `calculatedDaysCount === 0`. When `calculatedDaysCount === 0`, `0 / 7 = 0`, and `planHours / 0` evaluates to `Infinity`. `Infinity.toFixed(1)` in Node/V8 evaluates to `"Infinity"`, resulting in `nextPlanHours = Infinity`, breaking downstream combined hours and UI rendering.

2. **Floor Hours conflict (224.0 h vs 272.0 h)**:
   - In `src/modules/labor-forecast/services/calculationEngine.ts`:
     - Lines 65-76: `const FLOOR_PER_DAY = 32;` -> loop sums `count * 32 = 224.0h` for a 7-day week.
     - Line 654: `const floorHoursToUse = partialInfo.calculatedFloorHours > 0 ? partialInfo.calculatedFloorHours : w.floor_hours;`
     - Line 1087: `const hanwFinal = Math.max(hanwRaw, floorH);` -> effectively enforces 224.0h.
   - However, in other project files:
     - `desktop_app_blueprint/data_schemas_and_seeds/weeks_engine_seed.json`: every full week has `"floor_hours": 272`.
     - `src/modules/labor-forecast/components/FloorHoursModal.tsx` lines 139 and 228: `272.0 h (Pn–Sob po 5 zmian x 8h = 40h/dzień, Niedziela 4 zmiany x 8h = 32h)`.
     - `src/modules/labor-forecast/components/TrendCharts.tsx` lines 433 and 573: `<ReferenceLine y={272} stroke="#EF4444" label={{ value: 'Floor 272h' }} />`.
     - `src/modules/labor-forecast/README.md` line 16: `Pn–Sob 40h, Nd 32h -> 272.0 h/tydzień`.
     - `src/modules/labor-forecast/AGENTS.md` line 79: `Grafik zablokowany na poziomie 272.0 h`.

3. **Uniform calendar day weighting in $W_i$**:
   - In `desktop_app_blueprint/data_schemas_and_seeds/weeks_engine_seed.json`:
     - September 2026: W1–W4 (7 days) have `day_weight: 0.23333` ($7/30$); W5 (2 days, Tue+Wed) has `day_weight: 0.06667` ($2/30$).
     - October 2026: W1 (5 days, Thu–Mon) has `day_weight: 0.16129` ($5/31$); W2–W4 (7 days) have `day_weight: 0.22581` ($7/31$).
   - In `src/modules/labor-forecast/services/calculationEngine.ts`:
     - Line 658: `const planTrx = Math.round(planTrxTotal * w.day_weight);`
     - Line 659: `const planHours = Number((planHoursTotal * w.day_weight).toFixed(1));`
     - Week weighting is strictly proportional to day count ($k / N$), with no day-of-week demand variance.

4. **Multi-Store state leakage in `localStorage`**:
   - In `src/modules/labor-forecast/components/WeeklyScheduleTable.tsx` lines 63–79:
     ```typescript
     const saved = localStorage.getItem('sbux_daily_barista_hours');
     ```
     `sbux_daily_barista_hours` lacks a store-specific prefix (`store_${storeId}_...`), leaking barista schedule edits across store profiles.

5. **Flash Forecast year boundary overflow**:
   - In `src/modules/labor-forecast/services/calculationEngine.ts` lines 756–762:
     ```typescript
     curD++;
     const daysInCurMonth = new Date(w.year, curM, 0).getDate();
     if (curD > daysInCurMonth) {
       curD = 1;
       curM++;
     }
     ```
     When traversing late December into early January (e.g. week 29.12–04.01), `curM` increments to 13 without incrementing `w.year`, querying `getDailyKpi` with invalid date key `YYYY-13-01`.

6. **Trading Sunday run-rate distortion**:
   - In `src/modules/labor-forecast/services/calculationEngine.ts` lines 437–442:
     The Run-Rate model weights the most recent closed week by $1.8^k$. In weeks with a Trading Sunday (CH Janki sales spike ~250%), $v_{\text{RunRate}}$ surges and is extrapolated across non-trading weeks.

---

## 2. Logic Chain

1. **From Observation 1**: In `calculateCrossMonthBridge`, dividing by `(lastRow.calculatedDaysCount / 7)` without guarding `calculatedDaysCount > 0` directly yields `Infinity` when a week row has 0 days. Because `Infinity` is truthy, `Infinity || nextFloorHours` preserves `Infinity`, causing corrupted hours in `totalCombinedPlanHours`.
2. **From Observation 2**: `CalculationEngine` enforces $224.0\text{ h}$ ($7 \times 32.0\text{h}$) via `calculatePartialWeekInfo` and `Math.max(hanwRaw, floorH)`, but `TrendCharts.tsx` draws the reference line at $272.0\text{ h}$, and `FloorHoursModal.tsx` resets to $272.0\text{ h}$. This creates cognitive dissonance for the Store Manager, who sees the app recommending hours below the chart's "Floor" line.
3. **From Observation 3**: Calculating $W_i = \text{days\_count} / N_{\text{month}}$ assumes flat demand. Tuesday+Wednesday generates ~23.5% of weekly sales, but W5 (2 days) is allocated $2/7 = 28.57\%$ of a full week's budget (+5.07% over-budgeted). Conversely, W1 of October (5 days, including Friday, Saturday, Sunday) generates ~73.5%–87% of weekly sales, but is allocated only $5/7 = 71.43\%$ of a full week's budget (under-budgeted).
4. **From Observation 4**: In `WeeklyScheduleTable.tsx`, `sbux_daily_barista_hours` is stored un-namespaced in `localStorage`. When the user switches stores in a 100+ store environment, the previously cached hours populate the new store's table, violating Requirement R2 (Multi-Store Isolation).
5. **From Observation 5**: At the December/January boundary, iterating `curM++` without resetting to 1 and incrementing the year results in `curM = 13`. Queries to `getDailyKpi(year, 13, day)` fail to locate reported records for early January days.
6. **From Observation 6**: Trading Sundays occur only 7 times per year in Poland. Because the exponential run-rate model does not deseasonalize trading Sundays, a one-off spike in Week 2 is projected as baseline momentum for Weeks 3, 4, and 5, inappropriately inflating `Earned Labor Budget` by ~10–15% when subsequent weeks have closed malls on Sunday.

---

## 3. Caveats

- **Scope boundaries**: Investigation was strictly conducted in read-only audit mode. No files in `src/` or `electron/` were altered.
- **Assumptions**: The 32.0 h/day rule ($4 \text{ people} \times 8\text{h} = 1 \text{ MGR AM} + 1 \text{ Barista AM} + 1 \text{ MGR PM} + 1 \text{ Barista PM}$) is assumed to be the authoritative 2026 Starbucks CH Janki standard (as stated in AGENTS.md), superseding the legacy 272h model.
- **External database verification**: Seeds in `weeks_engine_seed.json` were inspected directly; live SQLite databases in `~/Library/Application Support/Starbucks Operations Suite/` were not modified.

---

## 4. Conclusion

Module 1's forecasting core is mathematically sophisticated and operationally sound in its primary logic:
1. The **Ensemble Forecasting Model** provides high stability by combining corporate AOP targets, exponential run-rate, and YoY seasonality.
2. The **Floor Hours Rule (32.0 h/day)** is strictly defended against sales slumps.
3. The **Monday Flash Forecast** prevents pre-closing MTD degradation.

However, production hardening requires resolving:
- **1 Critical bug (P0)**: Division by zero in `calculateCrossMonthBridge` (`Infinity`).
- **5 High-severity issues (P1)**: The 224h vs 272h Floor Hours conflict across charts, seeds, and modals; uniform calendar day weighting distortion in partial weeks; un-namespaced `localStorage` state leakage; run-rate over-projection from trading Sundays; and the year-boundary month overflow in Flash Forecast.

---

## 5. Verification Method

To independently verify all observations and mathematical deductions:

1. **Verify Division by Zero in Node**:
   ```bash
   node -e "const d = 0; console.log(((224 / 224) * (100 / (d / 7))).toFixed(1));"
   # Output: Infinity
   ```
2. **Verify Floor Hours Discrepancy via Grep**:
   ```bash
   grep -n "272" src/modules/labor-forecast/components/TrendCharts.tsx
   grep -n "272" src/modules/labor-forecast/components/FloorHoursModal.tsx
   grep -n "FLOOR_PER_DAY" src/modules/labor-forecast/services/calculationEngine.ts
   ```
3. **Verify Un-namespaced `localStorage` Key**:
   ```bash
   grep -n "sbux_daily_barista_hours" src/modules/labor-forecast/components/WeeklyScheduleTable.tsx
   ```
4. **Inspect Detailed Audit Report**:
   Read `/Users/dawidapel/COL Tool/.agents/teamwork/explorer_m1_math/report_m1_math.md` for complete formulas, LaTeX proofs, numeric scenario traces, and RFC technical designs.
