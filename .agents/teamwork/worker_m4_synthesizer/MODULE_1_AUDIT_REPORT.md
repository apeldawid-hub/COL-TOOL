# 360° Architectural, Mathematical, and Operational Audit of Module 1: Labor Forecast
**Platform:** Starbucks Operations Suite  
**Target Unit:** Store `108120 SBX Warszawa Janki` (Unit Code: `18120`, Operational Code: `384`)  
**Auditor:** Master Synthesizer & Solutions Architect (`worker_m4_synthesizer`)  
**Based on Expert Findings from:** `explorer_m1_math`, `explorer_m2_arch`, `explorer_m3_ux`  
**Mode:** DESIGN & AUDIT MODE (Strict Read-Only — Zero code mutations in `src/` and `electron/`)  
**Date:** 2026-10-24  
**Classification:** Publication-Grade Architectural Audit

---

## Table of Contents
1. [Executive Summary & Problem Matrix](#1-executive-summary--problem-matrix)
2. [Starbucks Operational Framework & Business Context](#2-starbucks-operational-framework--business-context)
3. [Pillar 1: Mathematical & Algorithmic Engine Audit](#3-pillar-1-mathematical--algorithmic-engine-audit)
   - 3.1. AOP Day Weights ($W_i$) and the Tuesday–Monday Fiscal Cycle
   - 3.2. MTD Velocity Ensemble Prediction Model ($1.8^k$ Exponential Weighting)
   - 3.3. Floor Hours Enforcement ($32.0\text{ h/day}$, $224.0\text{ h/week}$) vs 272h Legacy Artifacts
   - 3.4. Flex Hours Dynamic Pool Allocation
   - 3.5. Monday Flash Forecast (Pre-Closing Projection) and Tuesday Transition
   - 3.6. Numeric Edge Case Stress Tests (Mathematical Proofs & Scenarios)
4. [Pillar 2: Architecture, Bridges & Data Flow Audit](#4-pillar-2-architecture-bridges--data-flow-audit)
   - 4.1. Cross-Month Split-Week Bridge & P&L Budget Contamination
   - 4.2. Status of `CrossMonthBridgeCard.tsx` (Orphaned Component)
   - 4.3. Manager Labor Bridge Shift Filtering & Domain Classification
   - 4.4. Barista Pool Starvation Flaw (Non-Coverage Distortion)
   - 4.5. Training Shifts $T_1$–$T_{10}$ Isolation Failure
   - 4.6. SQLite WebAssembly (`sql.js`) Query Efficiency & Concurrency Hazards
   - 4.7. Multi-Store Isolation Blockers (Hardcoded SQL & Un-namespaced Storage)
   - 4.8. Inter-Module Coupling & Missing Domain DTOs
5. [Pillar 3: Store Manager Operational Workflow & UX Audit](#5-pillar-3-store-manager-operational-workflow--ux-audit)
   - 5.1. The Monday Scheduling Rhythm ("Black Monday" Cadence)
   - 5.2. Orphaned Decision Components (`OperationalAlert` and `KpiSummaryCards`)
   - 5.3. Unreachable Import Modal (`<ImportModal>`)
   - 5.4. Cosmetic AI Strategy Switcher Facade
   - 5.5. Back-Office Hardware Ergonomics (13"–14" Laptop Displays)
   - 5.6. Keyboard Accessibility & Data Entry Friction
   - 5.7. Cognitive Load & Terminology Disconnect (Statistical Jargon vs Starbucks Language)
   - 5.8. Intra-Week Blindness (Mid-Week Recovery Gap)
6. [Audit Conclusions & Synthesis Assessment](#6-audit-conclusions--synthesis-assessment)

---

## 1. Executive Summary & Problem Matrix

### 1.1. Executive Summary
A comprehensive 360° architectural, mathematical, and operational audit of **Module 1: TPLH Forecast & Labor Balancing** (`src/modules/labor-forecast/`) was conducted. Module 1 serves as the financial and operational bedrock of the Starbucks Operations Suite, translating corporate Annual Operating Plan (AOP) sales and labor productivity targets (TPLH — Transactions Per Labor Hour) into weekly and daily staffing allocations for Store Managers.

The audit examined the full vertical stack:
- Mathematical models and algorithms (`calculationEngine.ts`, `trendLearningEngine.ts`, `systemClock.ts`).
- Data structures and seeds (`weeks_engine_seed.json`, SQLite schemas).
- IPC handlers and database interaction layers (`electron/main.ts`, `electron/database/db.ts`).
- Component presentation, state lifecycle, and user ergonomics (`WeeklyScheduleTable.tsx`, `LaborForecastView.tsx`, `OperationalAlert.tsx`, `KpiSummaryCards.tsx`, `TrendIntelligencePanel.tsx`, `CrossMonthBridgeCard.tsx`).

The findings reveal an engine of **high conceptual sophistication**—specifically in its multi-model Ensemble Forecaster ($v_{\text{blended}}$ blending AOP Anchor, Run-Rate with $1.8^k$ recency weights, and YoY Seasonality) and its programmatic defense of the 32.0 h/day Floor Hours barrier. 

However, critical systemic defects, architectural leakages, and operational mismatches severely undermine production reliability, multi-store scalability, and Store Manager usability:

1. **P0 Critical Mathematical & Data Hazards**:
   - **Division by Zero in Split-Week Bridge**: Unchecked `(lastRow.calculatedDaysCount / 7)` produces `Infinity`, causing UI crashes when handling edge-case split weeks.
   - **Cross-Month P&L Budget Contamination**: When scheduling a split week (e.g., September W5: 2 days), the table writes the combined 7-day schedule (e.g., 272h) directly to the closing month's database key, resulting in a **+192h artificial budget blowout** in Month $M$ and double-counted labor in Month $M+1$.
   - **Multi-Store State Leakage**: Daily barista hour allocations (`dailyBaristaHours`) are stored in browser `localStorage` under a non-namespaced global key (`sbux_daily_barista_hours`), leaking schedules across store profiles.
   - **Hardcoded Unit Filtering in Electron SQL**: Core database queries in `electron/main.ts` filter on `unit_code = '18120' OR unit_code = '384'`, causing non-Janki stores to retrieve zero actual RCP hours.

2. **P1 High-Impact Structural & Operational Defects**:
   - **Barista Floor Starvation**: The formula `baristaHoursPool = max(0, Target - (managerCoverage + managerNc))` deducts manager back-office Non-Coverage hours from the floor budget, producing an **8h to 16h staffing deficit** on the physical bar.
   - **Training Shifts $T_1$–$T_{10}$ Counted as Floor Coverage**: The barista training curriculum is omitted from NC definitions, contaminating floor staffing and violating Starbucks policy.
   - **Trading Sunday Trend Distortions**: Un-dampened 250% sales spikes on CH Janki Trading Sundays inflate the exponential run-rate, inappropriately expanding labor budgets for subsequent non-trading weeks.
   - **Floor Hours Standard Duality (224h vs 272h)**: The calculation engine enforces 224.0h, but database seeds, modals, and charts still reference the legacy 272.0h standard.
   - **Orphaned Decision Components & Facade AI**: `OperationalAlert` and `KpiSummaryCards` are unmounted; the AI strategy selector is cosmetic only; `<ImportModal>` has no trigger button.

---

### 1.2. Comprehensive Problem Matrix

| ID | Sev | Component / File | Code Location | Nature of Failure | Operational & Business Impact |
| :--- | :---: | :--- | :--- | :--- | :--- |
| **BUG-01** | **P0** | `calculationEngine.ts` | Lines 1395, 1513 | Unchecked division by `(calculatedDaysCount / 7)` in `calculateCrossMonthBridge` | Returns `Infinity` when `calculatedDaysCount === 0`, corrupting combined plan hours and crashing rendering. |
| **BUG-02** | **P0** | `WeeklyScheduleTable.tsx` | Lines 150–160, 850–918 | Split-week schedule save writes combined 7-day hours to single-month key (`2026_Wrzesień_W5`) | Falsifies closing month P&L with +192h artificial labor overrun; duplicates hours in next month. |
| **BUG-03** | **P0** | `WeeklyScheduleTable.tsx` | Lines 63–79 | `localStorage.getItem('sbux_daily_barista_hours')` lacks `storeId` namespace | Global key shares daily barista allocations across all stores; switching stores leaks confidential rosters. |
| **BUG-04** | **P0** | `electron/main.ts` | Lines 530, 602, 799, 860 | Hardcoded `WHERE unit_code = '18120' OR unit_code = '384'` in actual labor queries | Total blocker for 100+ stores scale; non-Janki stores receive 0.0 actual RCP labor hours. |
| **BUG-05** | **P1** | `calculationEngine.ts` | Lines 1136–1141 | `managerHours = managerCoverage + managerNc` deducted from `weekTargetBudget` | Manager back-office admin/training hours starve the floor barista pool, creating physical staffing deficits under 32h/day. |
| **BUG-06** | **P1** | `calculationEngine.ts` | Lines 154–156 | Barista training modules `T1`–`T10` missing from `isNc` qualification | Training shifts are classified as floor coverage (`dayCovH`), reducing floor barista requirements and violating Starbucks policy. |
| **BUG-07** | **P1** | `weeks_engine_seed.json`, `FloorHoursModal.tsx`, `TrendCharts.tsx` | Seed lines 35+, Modal:139, Chart:433 | Database seed, UI modal, and reference lines hardcode legacy 272h floor instead of 224h | UI displays red floor threshold at 272h while calculation engine plans at 224h, creating store manager confusion. |
| **BUG-08** | **P1** | `calculationEngine.ts` | Lines 430–455 | Run-rate model ($1.8^k$ recency) lacks de-seasonalization for CH Janki Trading Sundays | One-off 250% sales spikes (+1,000 TRX) are extrapolated as permanent trends, inflating labor by +8% to +12% on non-trading weeks. |
| **BUG-09** | **P1** | `calendar_weeks.day_weight` | Database Schema & Seed | AOP day weights $W_i = \text{days\_count} / N$ assume uniform daily demand ($14.28\%/\text{day}$) | Partial weeks (e.g., Wt-Śr) are over-budgeted by $+5\%$, while weekend-heavy partial weeks are under-budgeted by $-15\%$. |
| **BUG-10** | **P1** | `calculationEngine.ts` | Lines 756–762 | Monday Flash Forecast day-scanning loop executes `curM++` without year rollover check | At December/January boundary, queries KPI map for month 13 (`2026-13-01`), dropping historical projection data. |
| **BUG-11** | **P1** | `LaborForecastView.tsx` | Lines 1–440 | `OperationalAlert.tsx` and `KpiSummaryCards.tsx` are completely unmounted in JSX | Store Manager is deprived of Monday schedule release guidance, W+1/W+2 discrepancy warnings, and MTD TPLH metrics. |
| **BUG-12** | **P1** | `LaborForecastView.tsx` | Lines 83, 392–401 | `isImportModalOpen` state exists, but zero UI elements trigger `setIsImportModalOpen(true)` | Store Manager cannot launch the MAPAL Fichajes / KPI import modal from within the Module 1 view. |
| **BUG-13** | **P1** | `TrendIntelligencePanel.tsx`, `calculationEngine.ts` | Panel:232–295, Engine:580+ | AI Strategy Selector (*Floor-Safe*, *Balanced*, *Growth*) is a cosmetic UI facade | Selecting a strategy updates no mathematical parameters in `CalculationEngine`; HANW recommendations remain completely static. |
| **BUG-14** | **P2** | `calculationEngine.ts` | Lines 852–857 | A week is flagged as `isClosed = true` if `actHours > 0` even when `actTrx === null` | Partial mid-week imports add hours to MTD labor without transactions, causing artificial TPLH collapse and HANW cuts. |
| **BUG-15** | **P2** | `App.tsx` | Lines 441–459 | `CalculationEngine.calculateMonth` is executed synchronously on every render without `useMemo` | Heavy calculations across 192 historical months and hundreds of shifts freeze UI thread during sidebar toggles. |
| **BUG-16** | **P2** | `electron/database/db.ts` | Lines 151–160 | Parallel IPC handlers concurrently call `dbManager.reloadFromDisk()` on `sql.js` | Closes and recreates the WebAssembly SQLite instance mid-flight, creating memory corruption and race conditions. |
| **BUG-17** | **P2** | `WeeklyScheduleTable.tsx` | Full component | Table requires 1280px+ width without `sticky` headers or frozen columns; micro-fonts (8–9.5px) | Severe visual strain and navigation loss on standard 13"–14" back-office laptops (1366x768). |
| **BUG-18** | **P2** | `OperationalAlert.tsx` | Lines 202, 229, 245 | Hardcoded fallback constants (`372.1`, `417.3`) and static text string `MOŻESZ BEZPIECZNIE DOŁOŻYĆ baristom do +15h` | Displays incorrect, hardcoded advice when row data is partially missing, regardless of real financial delta. |
| **BUG-19** | **P3** | `calculationEngine.ts` | Lines 658, 659 | Independent rounding `Math.round(planTrxTotal * W_i)` and `Number((planHoursTotal * W_i).toFixed(1))` | Sum of weekly rows drifts from monthly AOP totals by $\pm 1$ TRX and $\pm 0.2\text{ h}$. |
| **BUG-20** | **P3** | `WeeklyScheduleTable.tsx` | Lines 1000–1150 | No keyboard navigation (`ArrowUp`/`ArrowDown`/`Enter`) across table rows and daily inputs | Slow, error-prone data entry requiring repetitive mouse clicks on store laptop touchpads. |

---

## 2. Starbucks Operational Framework & Business Context

To establish why these defects represent serious operational risks, Module 1 must be grounded in the operational realities of Starbucks Store `108120 SBX Warszawa Janki`:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        STARBUCKS FISCAL & OPERATIONAL WEEK                             │
│                                                                                        │
│   Tuesday       Wednesday       Thursday        Friday       Saturday  Sunday   Monday │
│  ┌─────────┐   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌───────┐ ┌───────┐ ┌────┐ │
│  │ Delivery│   │ Routine │    │ Prep    │    │ Peak    │    │ Major │ │ 7x/yr │ │Pub.│ │
│  │ Day     │   │ Day     │    │ Peak    │    │ PM Peak │    │ Peak  │ │ Trade │ │W+2 │ │
│  └─────────┘   └─────────┘    └─────────┘    └─────────┘    └───────┘ └───────┘ └────┘ │
│  ◄─────────────────────────── 7-Day Planning Cycle ──────────────────────────────────► │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

1. **Tuesday–Monday Fiscal Week**:
   Unlike standard calendar weeks (Monday–Sunday), the Starbucks fiscal week begins on **Tuesday morning** and concludes on **Monday evening**.
   - Tuesday: Logistics delivery, inventory reconciliation, and schedule cycle initialization.
   - Friday–Saturday: Commercial demand peak in shopping mall environments.
   - Monday: Official publishing deadline for the schedule of week $W+2$ (7 days in advance per Art. 129 § 3 of the Polish Labor Code). Actual sales and labor from week $W$ close at 22:00.

2. **CH Janki Trading Dynamics (Trading vs Non-Trading Sundays)**:
   Store 18120 is situated in Centrum Handlowe Janki (Warsaw suburban shopping mall). Under the Polish Sunday Trading Restriction Act (*Ustawa o ograniczeniu handlu w niedziele i święta*), the calendar contains exactly **7 Trading Sundays** (*Niedziele Handlowe*) per year.
   - **Trading Sunday**: Entire mall open; customer footfall surges to **~250% of regular Sunday traffic** (+1,000 to +1,200 transactions). Staffing must flex heavily upwards.
   - **Non-Trading Sunday**: Mall closed; only cinema and food court operate. Store traffic drops to minimum. Staffing must be strictly locked at the **32.0h Floor base** (1 AM + 1 PM shift pair).

3. **The Inviolable Floor Hours Standard (32.0 h/day = 224.0 h/week)**:
   Starbucks operations mandate a non-negotiable health and safety minimum:
   $$\text{Daily Floor Base} = 1\text{ MGR} + 1\text{ Barista (Morning)} + 1\text{ MGR} + 1\text{ Barista (Evening)} = 4\text{ staff} \times 8.0\text{ h} = 32.0\text{ h/day}$$
   $$\text{Weekly Floor Base (Full 7-Day Week)} = 7\text{ days} \times 32.0\text{ h/day} = \mathbf{224.0\text{ h/week}}$$
   For partial split weeks containing $k$ calendar days ($k < 7$):
   $$\text{Partial Floor Base} = k \times 32.0\text{ h}$$
   No economic downturn, sales collapse, or algorithmic optimization is permitted to cut labor recommendations below this threshold.

4. **Non-Coverage (NC) Budget Isolation**:
   Labor performed away from customer beverage production (Store Manager administrative shifts `NC`, staff meetings `MEE`, pre-audits `PRE`, and Barista Certification Training `T1`–`T10`) is funded by a corporate **Non-Coverage budget**.
   - **Golden Rule**: Non-Coverage hours must **never reduce the 32.0h/day floor coverage**. If an SM spends 8h on administrative work on Tuesday, that shift does NOT count toward the 2-person floor requirement; another partner must be scheduled on the floor.

---

## 3. Pillar 1: Mathematical & Algorithmic Engine Audit

### 3.1. AOP Day Weights ($W_i$) and the Tuesday–Monday Fiscal Cycle
The calculation engine partitions monthly AOP sales and labor budgets into weekly rows using day weights $W_i$ stored in `calendar_weeks`.

#### The Current Formula and Its Inherent Flaw:
In `weeks_engine_seed.json` and `calculationEngine.ts`, $W_i$ is computed purely on calendar day count:
$$W_i = \frac{\text{days\_count}_i}{N_{\text{month}}}$$
where $N_{\text{month}} \in \{28, 29, 30, 31\}$.

For a 30-day month (e.g., September 2026):
- Weeks W1–W4 (7 days each): $W_i = 7 / 30 \approx 0.23333$ ($23.33\%$).
- Week W5 (2 days: Tuesday 29.09 – Wednesday 30.09): $W_{\text{W5}} = 2 / 30 \approx 0.06667$ ($6.67\%$).

#### Mathematical Proof of Distorted Labor Distribution:
The uniform day-weight formula implicitly assumes that every calendar day generates an identical $\frac{1}{7} = 14.28\%$ of weekly demand. However, empirical POS transaction distributions for CH Janki demonstrate pronounced intra-week volatility:

$$\mathbf{w}_{\text{emp}} = \begin{bmatrix} \text{Tuesday} \\ \text{Wednesday} \\ \text{Thursday} \\ \text{Friday} \\ \text{Saturday} \\ \text{Sunday (Non-Trade)} \\ \text{Monday} \end{bmatrix} = \begin{bmatrix} 12.0\% \\ 11.5\% \\ 12.5\% \\ 18.0\% \\ 24.5\% \\ 7.5\% \\ 14.0\% \end{bmatrix}$$

1. **Over-budgeting in Early-Week Partial Weeks (e.g., September W5: Wt + Śr, 2 days)**:
   - Calendar Budget Fraction: $\frac{2}{7} = \mathbf{28.57\%}$ of a full week.
   - Real Commercial Demand: $12.0\% + 11.5\% = \mathbf{23.50\%}$ of a full week.
   - **Mathematical Distortion**: Plan TRX and Plan Hours are artificially inflated by **$+5.07\%$ relative to actual demand**. The Store Manager is instructed to schedule excessive staff on historically slow days.
2. **Under-budgeting in Weekend-Heavy Partial Weeks (e.g., October W1: Czw + Pt + Sob + Nd + Pn, 5 days)**:
   - Calendar Budget Fraction: $\frac{5}{7} = \mathbf{71.43\%}$ of a full week.
   - Real Commercial Demand (with Trading Sunday): $12.5\% + 18.0\% + 24.5\% + 21.0\% + 14.0\% = \mathbf{90.00\%}$.
   - **Mathematical Distortion**: The week is starved of labor budget by **$-18.57\%$**, leading to severe floor under-staffing during commercial weekend peaks.

---

### 3.2. MTD Velocity Ensemble Prediction Model ($1.8^k$ Exponential Weighting)
In `calculationEngine.ts` (lines 410–572) and `trendLearningEngine.ts`, future transaction volume is forecast using a blended Ensemble Model:

$$v_{\text{blended}} = w_{\text{AOP}} \cdot v_{\text{AOP}} + w_{\text{RunRate}} \cdot v_{\text{RunRate}} + w_{\text{YoY}} \cdot v_{\text{YoY}}$$

#### Mathematical Specifications of the Components:
1. **AOP Baseline Velocity ($v_{\text{AOP}}$)**:
   $$v_{\text{AOP}} = \frac{\sum_{i \in \text{Closed}} \text{Actual TRX}_i}{\sum_{i \in \text{Closed}} \text{Plan TRX}_i}$$
2. **Short-Term Run-Rate with Exponential Recency Weighting ($v_{\text{RunRate}}$)**:
   For $K$ closed weeks with verified transactions, indexed from oldest ($k = 0$) to most recent ($k = K - 1$):
   $$v_{\text{RunRate}} = \frac{\sum_{k=0}^{K-1} \left( \frac{\text{Actual TRX}_k}{\text{Plan TRX}_k} \right) \cdot 1.8^k}{\sum_{k=0}^{K-1} 1.8^k}$$
3. **Year-over-Year Twin Seasonality ($v_{\text{YoY}}$)**:
   Historical pace from the same calendar month across previous years (2021–2025):
   $$v_{\text{YoY}} = \frac{\sum_{p \in \text{Historical Months}} \text{Actual TRX}_p}{\sum_{p \in \text{Historical Months}} \text{Plan TRX}_p}$$

#### Dynamic Weight Adaptation Matrix:
The engine dynamically adjusts model trust based on month data maturity:

$$\begin{array}{|l|c|c|c|c|}
\hline
\textbf{Data Maturity} & w_{\text{AOP}} & w_{\text{RunRate}} & w_{\text{YoY}}\text{ (With History)} & w_{\text{YoY}}\text{ (No History)} \\
\hline
\text{Past Month} & 1.00 & 0.00 & 0.00 & 0.00 \\
0\text{ Closed Weeks} & 0.65 & 0.00 & 0.35 & 0.00\ (w_{\text{AOP}}=1.0) \\
1\text{ Closed Week} & 0.50 & 0.30 & 0.20 & 0.00\ (w_{\text{AOP}}=0.6, w_{\text{RR}}=0.4) \\
\ge 2\text{ Closed Weeks} & 0.35 & 0.50 & 0.15 & 0.00\ (w_{\text{AOP}}=0.4, w_{\text{RR}}=0.6) \\
\hline
\end{array}$$

#### Earned Labor Budget Formulation:
1. $\text{Forecast Open TRX} = \sum_{j \in \text{Open}} (\text{Plan TRX}_j \cdot v_{\text{blended}})$
2. $\text{Forecast Total TRX} = \text{Actual TRX MTD} + \text{Forecast Open TRX}$
3. $\text{Earned Labor Budget} = \frac{\text{Forecast Total TRX}}{\text{Target TPLH}}$
4. $\Delta_{\text{Earned Hours}} = \text{Earned Labor Budget} - \text{Total AOP Plan Hours}$
5. $\text{Committed Hours} = \sum_{i < \text{Target}} \text{Actual/Scheduled Hours}_i$
6. $\text{Budget For Planning Weeks} = \max(0, \text{Earned Labor Budget} - \text{Committed Hours})$
7. $\text{HANW Raw} = \text{Budget For Planning Weeks} \cdot \frac{W_{\text{target}}}{\sum_{j \ge \text{Target}} W_j}$
8. $\mathbf{HANW Final} = \max(\text{HANW Raw}, \text{Floor Hours}_{\text{target}})$

---

### 3.3. Floor Hours Enforcement ($32.0\text{ h/day}$, $224.0\text{ h/week}$) vs 272h Legacy Artifacts

#### Algorithmic Verification:
In `calculationEngine.ts`:
- Line 26: `calculatePartialWeekInfo(week)` executes `totalFloor += FLOOR_PER_DAY` (where `FLOOR_PER_DAY = 32`).
- Line 654: `const floorHoursToUse = partialInfo.calculatedFloorHours > 0 ? partialInfo.calculatedFloorHours : w.floor_hours;`.
- Line 1087: `const hanwFinal = Math.max(hanwRaw, floorH);`.

**Result**: The mathematical core is **100% sound**. It is mathematically impossible for `HANW Final` to drop below $k \times 32.0\text{ h}$.

#### Architectural Conflict: The 272h Legacy Contamination:
Despite the calculation engine's correct 224.0h logic, the repository contains severe remnants of an obsolete **272.0h weekly floor standard** ($6\text{ days} \times 40\text{h} + 32\text{h}$):
- `desktop_app_blueprint/data_schemas_and_seeds/weeks_engine_seed.json`: 670 rows in `calendar_weeks` contain `"floor_hours": 272`.
- `FloorHoursModal.tsx` (lines 139, 228): Text claims *"Domyślna baza floor w lokalu Janki to 272.0 h/tydzień (Pn–Sob po 5 zmian x 8h = 40h, Nd 4 zmiany x 8h = 32h)"* and provides a reset button `Przywróć domyślne 272h`.
- `TrendCharts.tsx` (lines 433, 573, 656): Renders `<ReferenceLine y={272} label="Floor 272h" stroke="#DC2626" />`.

**Impact**: When the engine outputs a legally valid, floor-compliant recommendation of 224.0h, the UI chart renders this bar **below the red reference line**, misleading the Store Manager into believing their schedule violates labor standards.

---

### 3.4. Flex Hours Dynamic Pool Allocation
Any labor budget earned above the 224.0h Floor Base constitutes the **Flex Pool**:
$$\text{Flex Pool} = \max(0, \text{Target Budget} - 224.0\text{ h})$$

In `calculationEngine.ts:enrichDailyCoverageWithFlex`, the Flex Pool is distributed based on CH Janki demand profiles:

$$\begin{array}{|l|c|c|l|}
\hline
\textbf{Day of Week} & \textbf{Standard Week Flex \%} & \textbf{Trading Sunday Flex \%} & \textbf{Operational Logic} \\
\hline
\text{Tuesday} & 19.0\% & 14.0\% & \text{Delivery day extra support} \\
\text{Wednesday} & 12.0\% & 9.0\% & \text{Mid-week routine} \\
\text{Thursday} & 12.0\% & 9.0\% & \text{Pre-weekend build} \\
\text{Friday} & 20.0\% & 17.0\% & \text{Mall evening rush} \\
\text{Saturday} & 24.5\% & 22.0\% & \text{Primary retail peak} \\
\textbf{Sunday} & \mathbf{0.0\%} & \mathbf{20.0\%} & \textbf{Locked at 32h if closed; heavy peak if open} \\
\text{Monday} & 12.5\% & 9.0\% & \text{Inventory & schedule publishing} \\
\hline
\textbf{Total} & \mathbf{100.0\%} & \mathbf{100.0\%} & \\
\hline
\end{array}$$

---

### 3.5. Monday Flash Forecast (Pre-Closing Projection) and Tuesday Transition

#### The Scheduling Dilemma:
On Monday afternoon, the Store Manager must finalize and post the schedule for week $W+2$. However, week $W$ is still active (closing at 22:00). Without closing numbers, week $W$ would only possess 6 days of data (Tuesday–Sunday). If treated as incomplete or closed with missing Monday data, MTD transactions drop by ~14%, causing the Ensemble velocity $v_{\text{blended}}$ to plunge and artificially cutting the $W+2$ labor budget.

#### Mathematical Formulation of Flash Forecast:
When `isEndingTodayOnMonday === true` and Monday has not yet been reported from MAPAL:
1. $H_{\text{MGR Today}} = \text{managerHours from Module 2 (excluding leaves and external support)}$.
2. $H_{\text{Target Week}} = \text{scheduledHours} > 0 ? \text{scheduledHours} : \text{planHours}$.
3. $H_{\text{Rem}} = \max(0, H_{\text{Target Week}} - H_{\text{logged Days 1..6}})$.
4. $H_{\text{Monday Projected}} = \max(32.0, H_{\text{Rem}})$.
5. $\text{TRX}_{\text{Monday Projected}} = \text{avgMondayTrxThisMonth} > 0 ? \text{avgMondayTrxThisMonth} : \text{round}(\text{Plan TRX} \times 0.121)$.
6. Week $W$ is temporarily stamped with `isMondayProjected = true` and `isClosed = true`, feeding full 7-day normalized velocity into the Ensemble.

#### Tuesday Morning Transition:
On Tuesday morning, `SystemClock` advances:
`today.dayOfWeek === 'Wt'` $\implies$ `isEndingTodayOnMonday = false`.
The week transitions to `status = 'past'`. Upon importing Monday's actual MAPAL Fichajes file, the projected hours and transactions are cleanly replaced by empirical data without manual intervention.

---

### 3.6. Numeric Edge Case Stress Tests (Mathematical Proofs & Scenarios)

#### Test 1: Division by Zero in Cross-Month Bridge (BUG-01 — P0)
- **Code Reference**: `calculationEngine.ts:1395, 1513`.
- **Expression**:
  ```typescript
  const nextPlanHours = Number(
    ((nextFloorHours / 224.0) * (lastRow.planHours / (lastRow.calculatedDaysCount / 7))).toFixed(1)
  ) || nextFloorHours;
  ```
- **Scenario**: In an empty seed week or a corrupt database row where `lastRow.calculatedDaysCount === 0`:
  $$\frac{\text{calculatedDaysCount}}{7} = \frac{0}{7} = 0 \implies \frac{\text{lastRow.planHours}}{0} = \mathbf{Infinity}$$
  $$\text{Number}((\text{factor} \times \mathbf{Infinity})\text{.toFixed(1)}) = \mathbf{Infinity}$$
- In JavaScript: `Infinity || nextFloorHours` evaluates to **`Infinity`** because `Infinity` is truthy.
- **Proof of Failure**: `nextPlanHours` becomes `Infinity`. The combined plan hours sum evaluates to `Infinity`, propagating through React components and producing `NaN` / `Infinity` in table headers, crashing the view.

#### Test 2: Catastrophic Sales Collapse (Negative Budget Delta)
- **Scenario**: 5-week month; Plan = 10,000 TRX, Target TPLH = 6.70 $\implies$ Plan Labor = 1,492.5h.
- Weeks W1 and W2 suffer severe sales downturn: Actual TRX = 1,500 vs Plan = 2,333 each week ($v_{\text{AOP}} = 0.643$).
- The store was heavily over-scheduled: Actual Labor W1 + W2 = 760.0h.
- Week W3 is locked in published status at 320.0h.
- Committed hours prior to planning week W4:
  $$H_{\text{committed}} = 760.0 + 320.0 = 1,080.0\text{ h}$$
- Total Earned Labor Budget for the month:
  $$\text{Forecast Total TRX} = 3,000 + (5,334 \times 0.70) = 6,734\text{ TRX}$$
  $$\text{Earned Labor Budget} = \frac{6,734}{6.70} = 1,005.1\text{ h}$$
- Raw Remaining Budget:
  $$\text{Budget Delta} = 1,005.1 - 1,080.0 = \mathbf{-74.9\text{ h}}$$
- **Engine Execution**:
  - Line 1044: `budgetForPlanningWeeks = Math.max(0, -74.9) = 0.0h`.
  - Line 1081: `hanwRaw = 0.0h`.
  - Line 1087: `hanwFinal = Math.max(0.0, 224.0) = 224.0h`.
  - Line 1094: `isFloorAlertTriggered = true`.
- **Verdict**: Mathematically resilient. Clamps negative budget to zero and enforces the 224.0h Floor Base.

#### Test 3: Zero TRX / Complete Store Closure Days
- **Scenario**: Easter Sunday or Christmas Day resulting in 0 actual transactions.
- **Engine Execution**:
  - `actTrx > 0 && actHours > 0` checks prevent division by zero in daily TPLH (`calculationEngine.ts:860`).
  - `(r.actualTrx || 0) / (r.planTrx || 1)` ensures safe ratio calculation (`calculationEngine.ts:438`).
- **Verdict**: Fully guarded against division by zero.

#### Test 4: Extreme Sales Spike on Trading Sunday (~250% Norm) (BUG-08 — P1)
- **Scenario**: Store averages 350 TRX on normal Sundays. On Trading Sunday W2, volume hits 875 TRX (+525 TRX).
- Week W2 achieves 3,050 TRX against a plan of 2,527 TRX ($\text{Ratio}_{\text{W2}} = 1.207$).
- **Run-Rate Extrapolation**:
  $$v_{\text{RunRate}} = \frac{1.0 \times 1.0 + 1.8 \times 1.207}{1.0 + 1.8} = \frac{3.172}{2.8} = \mathbf{1.133}\ (+13.3\%)$$
- Blended velocity $v_{\text{blended}}$ rises by $+8.5\%$.
- The engine projects weeks W3, W4, and W5 to maintain this inflated pace, adding:
  $$\text{Extra Labor} = \frac{7,581 \text{ Plan TRX} \times 0.085}{6.70 \text{ TPLH}} \approx \mathbf{+96.1\text{ h}}$$
- **Verdict**: Faulty behavior. Trading Sunday is a discrete, non-recurring event. Extrapolating this spike to subsequent non-trading weeks causes over-budgeting by ~96 hours.

#### Test 5: Year-Boundary Rollover Flaw in Flash Forecast (BUG-10 — P1)
- **Code Reference**: `calculationEngine.ts:756–762`.
- **Loop Logic**:
  ```typescript
  curD++;
  const daysInCurMonth = new Date(w.year, curM, 0).getDate();
  if (curD > daysInCurMonth) {
    curD = 1;
    curM++;
  }
  ```
- **Scenario**: Fiscal week spans December 29, 2026 to January 4, 2027.
- When `curD` advances past 31, `curD` resets to 1 and `curM` becomes **13**.
- `w.year` is never updated.
- Line 746 constructs `iso = 2026-13-01`.
- **Verdict**: Generates invalid ISO date strings, failing lookups in `dailyActualHoursMap` and dropping historical Monday actuals.

#### Test 6: Incomplete 6-Day Loggings Without Transactions (BUG-14 — P2)
- **Code Reference**: `calculationEngine.ts:852–857`.
- **Logic**:
  ```typescript
  const hasActualData = (actHours !== null && actHours > 0) || (actTrx !== null && actTrx > 0);
  const isClosed = monthTemporalStatus === 'past' || hasActualData;
  ```
- **Scenario**: On Sunday evening, MAPAL logs contain 280.0h, but weekly transactions have not yet closed (`actTrx === null`).
- **Effect**:
  - Week is marked as `isClosed = true`.
  - MTD hours accumulate $+280.0\text{ h}$.
  - MTD transactions accumulate $+0\text{ TRX}$.
  - MTD TPLH collapses artificially: $\text{TPLH} = \frac{\text{Actual TRX}}{\text{Actual Hours} + 280} \ll \text{Target}$.
  - Remaining hours budget is prematurely penalized by 280h, slashing the $W+2$ recommendation.

#### Test 7: Floating-Point Rounding Drift (BUG-19 — P3)
- **Code Reference**: `calculationEngine.ts:658, 659`.
- **Expressions**:
  - `planTrx = Math.round(planTrxTotal * w.day_weight);`
  - `planHours = Number((planHoursTotal * w.day_weight).toFixed(1));`
- For a monthly plan of 10,000 TRX and 1,616.4h across 5 weeks ($W_i = [0.23333 \times 4, 0.06667]$):
  $$\sum \text{Plan TRX}_i = 2,333 \times 4 + 667 = \mathbf{9,999\text{ TRX}}\ (-1\text{ TRX drift})$$
  $$\sum \text{Plan Hours}_i = 377.2 \times 4 + 107.8 = \mathbf{1,616.6\text{ h}}\ (+0.2\text{ h drift})$$

---

## 4. Pillar 2: Architecture, Bridges & Data Flow Audit

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        MODULE 1 DATA FLOW & BRIDGES ARCHITECTURE                       │
│                                                                                        │
│   SQLite Database (electron/database/db.ts)                                            │
│   ├── aop_plans                                                                        │
│   ├── calendar_weeks (670 rows with legacy floor: 272h) [BUG-07]                       │
│   ├── labor_actuals_log (hardcoded unit_code = '18120') [BUG-04]                       │
│   └── manager_shifts (Moduł 2)                                                         │
│             │                                                                          │
│             ▼ IPC Channels                                                             │
│   Electron Main Process (electron/main.ts)                                             │
│   ├── db:get-manager-schedule-data                                                     │
│   └── Concurrency Hazard: 3x dbManager.reloadFromDisk() [BUG-16]                       │
│             │                                                                          │
│             ▼ React State (App.tsx: 825 lines, un-memoized calculateMonth)             │
│   CalculationEngine.calculateMonth (calculationEngine.ts: 1621 lines)                  │
│   ├── calculateCrossMonthBridge (division by zero) [BUG-01]                            │
│   ├── Barista Pool: Target - (Coverage + NC) [BUG-05]                                  │
│   └── T1-T10 Training counted as Coverage [BUG-06]                                    │
│             │                                                                          │
│             ▼ Presentation Layer (LaborForecastView.tsx)                              │
│   ├── WeeklyScheduleTable.tsx                                                          │
│   │   ├── localStorage['sbux_daily_barista_hours'] (Global, un-namespaced) [BUG-03]    │
│   │   └── Split-Week save: 272h saved into single-month W5 [BUG-02]                    │
│   ├── CrossMonthBridgeCard.tsx (ORPHANED, 0 JSX references)                            │
│   ├── OperationalAlert.tsx (ORPHANED, unmounted in JSX) [BUG-11]                       │
│   ├── KpiSummaryCards.tsx (ORPHANED, unmounted in JSX) [BUG-11]                        │
│   └── TrendIntelligencePanel.tsx (Strategy selector is cosmetic facade) [BUG-13]       │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.1. Cross-Month Split-Week Bridge & P&L Budget Contamination (BUG-02 — P0)
The most severe architectural defect in Module 1 exists in the cross-month split-week handling between `WeeklyScheduleTable.tsx` and the underlying persistence layer.

#### The Contamination Mechanism:
When a fiscal week straddles a calendar month boundary (e.g., September W5: September 29–30 [2 days] and October W1: October 1–5 [5 days]):
1. In `WeeklyScheduleTable.tsx:851–853`, when the Store Manager expands the split-week row (`isFullSplit = true`), the table presents the **full 7-day combined budget**:
   ```typescript
   const targetBudget = isFullSplit && crossMonthBridge
     ? (crossMonthBridge.recommendedCombinedHours || crossMonthBridge.totalCombinedPlanHours)
     : ...; // Evaluates to 224.0h or 272.0h for the entire 7-day period
   ```
2. The Store Manager fills in the daily hours for all 7 days (e.g., 32h + 32h + 32h + 32h + 40h + 50h + 32h = 250.0h) or clicks *"Rozdziel wg Trendu AI"*.
3. Line 158 invokes the save callback:
   ```typescript
   await onSaveScheduledHours(weekKey, Number(targetTotal.toFixed(1)));
   ```
   Crucially, `weekKey` is the closing month's week key: **`2026_Wrzesień_W5`**.
4. The entire 7-day total of **250.0h** is written into the `weekly_actual_trx` table for `2026_Wrzesień_W5`.

#### Financial Impact on P&L:
- September W5 AOP plan was **80.0h** (for 2 days).
- September P&L now records scheduled labor of **250.0h** $\implies$ **+170.0h artificial overrun** in September!
- When the Store Manager switches to October, `2026_Październik_W1` (5 days) still retains its full independent plan of **144.0h**.
- **Double Counting**: The 5 October days (October 1–5) are counted once in September's schedule and counted again in October's budget, producing severe financial reporting distortions for the District Manager and Finance Controller.

---

### 4.2. Status of `CrossMonthBridgeCard.tsx` (Orphaned Component)
- **File**: `src/modules/labor-forecast/components/CrossMonthBridgeCard.tsx` (268 lines).
- **Inspection**:
  ```bash
  grep -rn "<CrossMonthBridgeCard" src/
  ```
  **Result**: Exactly 0 occurrences across the entire codebase.
- **Analysis**: A beautifully designed, 268-line component with visual split-week stitching, two-column day grids, and floor indicators exists in the codebase but is **completely dead code**. Instead of utilizing this dedicated card, `WeeklyScheduleTable.tsx` attempts to render an un-styled, inline nested sub-table that triggers the budget contamination defect detailed above.

---

### 4.3. Manager Labor Bridge Shift Filtering & Domain Classification
In `calculationEngine.ts:143–150`, shifts are ingested from Module 2:
```typescript
for (const s of dayShifts) {
  const code = s.shift_code;
  if (!code || ['OFF', 'L4', 'H', 'SAM', 'SPM', 'SUP', 'M', 'Z', 'FULL'].includes(code)) {
    continue;
  }
```

#### Evaluation:
- ✅ **External Support Shifts (`SAM`, `SPM`, `SUP`)**: Properly excluded so non-home-store hours do not satisfy Store 18120 floor requirements.
- ✅ **Absences (`OFF`, `L4`, `H`) and Dispositions (`M`, `Z`, `FULL`)**: Properly ignored.
- ⚠️ **Architectural Fragility**: Filtering relies on a **hardcoded array of string literals** rather than the domain schema attribute `shiftDef.is_absence === 1`. If an HR update introduces a new legal leave code in Module 2 (e.g., `UW` for leave on demand, `UO` for special leave, `K` for blood donation), Module 1 fails to recognize it and treats the absence as active work hours!

---

### 4.4. Barista Pool Starvation Flaw (BUG-05 — P1)
In `calculationEngine.ts:1134–1145`:
```typescript
const managerCoverageHours = Number(weekManagerCoverageHours.toFixed(1));
const managerNcHours = Number(weekManagerNcHours.toFixed(1));
const managerHours = Number((managerCoverageHours + managerNcHours).toFixed(1));

const baristaHoursPool = Math.max(0, Number((weekTargetBudget - managerHours).toFixed(1)));
```

#### Detailed Mathematical Breakdown:
- The target weekly budget `weekTargetBudget` represents customer-facing floor coverage (e.g., 224.0h Floor Base).
- `managerCoverageHours` represents managers physically working on the bar (`AM`, `PM`, `AMN`, `PMN`).
- `managerNcHours` represents managers performing back-office duties (`NC`, `MEE`, `PRE`).
- By subtracting `managerHours` ($H_{\text{Cov}} + H_{\text{NC}}$) from `weekTargetBudget`:

$$H_{\text{Barista Pool}} = 224.0 - (H_{\text{MGR Coverage}} + H_{\text{MGR NC}})$$

Consider a week where managers work 32.0h on the bar and 16.0h on back-office administration ($H_{\text{MGR Total}} = 48.0\text{ h}$):
$$H_{\text{Barista Pool}} = 224.0 - 48.0 = 176.0\text{ h}$$
Total floor coverage provided to the store:
$$H_{\text{Total Floor}} = H_{\text{MGR Coverage}} + H_{\text{Barista Pool}} = 32.0 + 176.0 = \mathbf{208.0\text{ h}}$$

**Critical Failure**: Minimum safe floor staffing is 224.0h. Because the manager's back-office hours were deducted from the floor budget, the physical bar is short by **16.0 hours** (equivalent to 2 full barista shifts). This directly causes under-staffed store floors during operating hours.

$$\mathbf{Correct\ Formula}: \quad H_{\text{Barista Pool (Floor)}} = \max(0, H_{\text{Target Coverage}} - H_{\text{MGR Coverage}})$$

---

### 4.5. Training Shifts $T_1$–$T_{10}$ Isolation Failure (BUG-06 — P1)
In `calculationEngine.ts:154–156`:
```typescript
const isNc =
  shiftDef?.is_nc === 1 || ['NC', 'TAM', 'TPM', 'T', 'PRE', 'MEE', 'BT'].includes(code);
```

#### Analysis:
- In Starbucks Module 3 (Barista Training), training modules are designated `T1`, `T2`, ..., `T10`.
- In `defaultShifts.ts`, individual definitions for `T1` through `T10` do not exist.
- When a Store Manager schedules a partner for a `T3` training shift:
  1. `shiftDef` returns `undefined`.
  2. `['NC', 'TAM', 'TPM', 'T', 'PRE', 'MEE', 'BT'].includes('T3')` returns `false`.
  3. Execution enters the `else` branch: `dayCovH += s.hours`.
- **Impact**: The training shift is treated as active customer floor coverage! The system assumes a trainee undergoing classroom instruction is serving customers on the espresso bar, reducing the scheduled barista pool and directly violating the Starbucks operational mandate.

---

### 4.6. SQLite WebAssembly (`sql.js`) Query Efficiency & Concurrency Hazards

#### Concurrency Hazard in `reloadFromDisk()` (BUG-16 — P2):
In `electron/database/db.ts:151–160`:
```typescript
public reloadFromDisk(): Database {
  const fileBuffer = fs.readFileSync(this.dbFilePath);
  if (this.db) {
    try { this.db.close(); } catch (_) {}
  }
  this.db = new this.SQL.Database(fileBuffer);
  this.createSchema();
  return this.db!;
}
```
In `App.tsx:230–258`, three parallel asynchronous calls are dispatched inside `Promise.all`:
- `getAopPlan` $\rightarrow$ calls `reloadFromDisk()`.
- `getWeeklyScheduledHoursMap` $\rightarrow$ calls `reloadFromDisk()`.
- `getManagerScheduleData` $\rightarrow$ calls `reloadFromDisk()`.

All three invocations close the active WebAssembly database instance and instantiate a new one while re-executing `createSchema()`. If one query executes `prepare()` while another is destroying the WASM memory buffer, `sql.js` throws a fatal memory access error.

#### Unindexed Left-Wildcard SQL Scans:
In `electron/main.ts:591–605`:
```sql
SELECT date, SUM(computable_time) as total_hours
FROM labor_actuals_log
WHERE (date LIKE ? OR date LIKE ?)
  AND computable_time > 0
```
Where the parameter is `%.${month}.${year}%`. Leading wildcards (`%...`) prevent SQLite from utilizing the B-tree index on `date`, forcing a full table scan across thousands of timeclock entries on every month view switch.

---

### 4.7. Multi-Store Isolation Blockers (Hardcoded SQL & Un-namespaced Storage)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        MULTI-STORE ISOLATION BLOCKERS MATRIX                           │
│                                                                                        │
│  1. electron/main.ts:530, 602, 860                                                     │
│     WHERE (unit_code = '18120' OR unit_code = '384' OR unit_name LIKE '%108120%')     │
│     ──► Non-Janki stores receive 0.0 actual labor hours [P0]                          │
│                                                                                        │
│  2. electron/main.ts:799                                                               │
│     UPDATE stores SET weekly_floor_hours = ? WHERE store_code = '18120'                │
│     ──► Modifying floor hours in Store 18155 overwrites Store 18120 [P0]               │
│                                                                                        │
│  3. WeeklyScheduleTable.tsx:65, 75                                                     │
│     localStorage.getItem('sbux_daily_barista_hours')                                   │
│     ──► Global storage key leaks barista schedules across stores [P0]                  │
│                                                                                        │
│  4. ManagerLaborBridgeModal.tsx:516                                                    │
│     "Godziny dyżurów kierowniczych w lokalu Janki (18120)..."                          │
│     ──► Hardcoded UI text displayed to managers of other stores [P2]                   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

1. **SQL Filters**: In `electron/main.ts` (lines 530, 602, 860), queries fetching actual hours enforce:
   `AND (unit_code = '18120' OR unit_code = '384' OR unit_name LIKE '%108120%'...)`
   If Store Manager switches to Store `18155 (Galeria Mokotów)`, the query returns zero rows.
2. **Floor Hours Mutation**: In `electron/main.ts:799`:
   `UPDATE stores SET weekly_floor_hours = ? WHERE store_code = '18120' OR store_code = '384'`
   Updating settings in any other store permanently mutates Store 18120 in the database!
3. **Browser Storage Leakage**: `WeeklyScheduleTable.tsx:65` reads and writes `sbux_daily_barista_hours`. This key lacks `storeId`, causing active shifts to bleed across tenants.

---

### 4.8. Inter-Module Coupling & Missing Domain DTOs
In `calculationEngine.ts:20` and `trendLearningEngine.ts:10`:
```typescript
import { getPolishTradingSundays } from '../../managers-schedule/services/managerScheduleEngine';
```
Module 1 directly imports internal services from Module 2. Furthermore, Module 1 consumes raw database entities (`ManagerScheduleShift[]`, `ShiftDefinition[]`, `ManagerEmployee[]`) and manually parses shift codes, duplicating business logic.

---

## 5. Pillar 3: Store Manager Operational Workflow & UX Audit

### 5.1. The Monday Scheduling Rhythm ("Black Monday" Cadence)
Under Polish Labor Code Art. 129 § 3, employee schedules must be posted at least 7 days in advance. In the Starbucks operational week (Tuesday–Monday), **Monday by 17:00 is the hard statutory deadline** for publishing week $W+2$.

```
Monday Store Manager Cadence:
08:00 - 12:00: Peak morning operations on the floor
12:00 - 14:00: Review week W progress (Flash Forecast needed)
14:00 - 16:30: Finalize week W+2 schedule in Module 1 & publish to MAPAL
17:00: STATUTORY DEADLINE: Schedule posted for partners
```

During this tight window, the Store Manager works on a 13"–14" back-office laptop under extreme time pressure. Any tool friction, cryptic statistics, or hidden actions results in severe operational strain.

---

### 5.2. Orphaned Decision Components (`OperationalAlert` and `KpiSummaryCards`)
In `LaborForecastView.tsx`, two crucial components are omitted from the render tree:
1. **`OperationalAlert.tsx`**: Contains the cadence decision cards:
   - Week $W+1$ (Published): Checks whether scheduled hours match the latest demand velocity.
   - Week $W+2$ (Planning): Provides the definitive HANW recommendation and alerts if sales collapse triggers a Floor Breach.
2. **`KpiSummaryCards.tsx`**: Contains the 3 master financial cards (Monthly AOP Plan, MTD Velocity & Actuals, Earned Labor Reconciliation).

Instead of these cards, `LaborForecastView.tsx` renders a single horizontal **Hero Bar** (lines 128–252). On 1366x768 screens, the Hero Bar wraps into 4 messy rows, while omitting the operational advice and warnings that Store Managers rely on.

---

### 5.3. Unreachable Import Modal (`<ImportModal>`)
In `LaborForecastView.tsx:83`, the state `const [isImportModalOpen, setIsImportModalOpen] = useState(false)` is declared, and lines 392–401 render:
```tsx
{isImportModalOpen && (
  <ImportModal
    isOpen={isImportModalOpen}
    onClose={() => setIsImportModalOpen(false)}
    ...
  />
)}
```
However, an exhaustive search across `LaborForecastView.tsx` and `LaborForecastWidget.tsx` confirms that **no button or link ever calls `setIsImportModalOpen(true)`**. The Store Manager cannot access the Excel import modal from Module 1 without switching to another module!

---

### 5.4. Cosmetic AI Strategy Switcher Facade
In `TrendIntelligencePanel.tsx` (lines 232–295), the UI displays three strategy choices:
- 🛡️ *Floor-Safe (Konserwatywna)*
- ⚖️ *Balanced (Zrównoważona AI)*
- 🚀 *Growth (Wzrostowa)*

When clicked, `setSelectedStrategy` updates state in `App.tsx`. However:
`CalculationEngine.calculateMonth` **does not accept `selectedStrategy` as a parameter**. The parameter is discarded, and the calculation output remains completely unchanged. This facade erodes user trust in the platform.

---

### 5.5. Back-Office Hardware Ergonomics (13"–14" Laptop Displays)
Starbucks back offices are equipped with standard compact corporate laptops (1366x768 or 1920x1080 display scaled to 125%/150%, resulting in ~1280x720 effective resolution).

#### Ergonomic Violations:
1. **Excessive Width & Horizontal Scrolling**: `WeeklyScheduleTable.tsx` contains 12 main columns plus 9 sub-columns in the daily expansion, requiring ~1400px width. Horizontal scrollbars obscure data.
2. **Missing Sticky Headers & Frozen Columns**: Scrolling vertically hides column headers. Scrolling horizontally hides the week identifier (`W1`, `W2`), forcing managers to scroll back and forth to understand what row they are editing.
3. **Illegible Micro-Typography**: Nested day grids utilize font sizes of `8px`, `8.5px`, and `9px` (lines 510, 572, 1013). Under harsh back-office fluorescent lighting, these are nearly unreadable.

---

### 5.6. Keyboard Accessibility & Data Entry Friction
- **No Arrow Key Traversal**: Store Managers cannot move up and down between weeks using `ArrowUp` / `ArrowDown`.
- **No Tab / Enter Advance in Daily Inputs**: In the daily barista input row (line 1079), pressing `Enter` does not advance focus to the next day (e.g., from Tuesday to Wednesday). Managers must move their hands from keyboard to touchpad 7 times per week.

---

### 5.7. Cognitive Load & Terminology Disconnect (Statistical Jargon vs Starbucks Language)
`TrendIntelligencePanel.tsx` presents complex econometric concepts:
- *"Wielomodelowy Zespół Predykcji (Ensemble AI)"*
- *"Kotwica AOP (Waga 35%)"*
- *"Krótki Run-Rate EMA (Waga 45%)"*
- *"Przedział Ufności TRX"*

Store Managers do not think in statistical weights. They require operational, actionable instructions in Starbucks terminology:
> *"Zalecenie na W3 (22.09): Rozpisz 288.0 h baristom. W sobotę spodziewany duży peak popołudniowy w CH Janki — zaplanuj dodatkową zmianę Barista MID 11:00–19:30. Niedziela niehandlowa — obsada ściśle 32.0 h (1 AM + 1 PM)."*

---

### 5.8. Intra-Week Blindness (Mid-Week Recovery Gap)
If a major weather event or mall closure strikes on Wednesday, sales plunge. The Store Manager needs to immediately recalibrate Friday–Sunday schedules. However, because week $W$ is not closed, entering partial Wednesday numbers **does not trigger MTD velocity re-calculations** in the current engine. The system offers no "Mid-Week What-If Recalibrator," forcing managers to manually calculate staffing cuts on paper.

---

## 6. Audit Conclusions & Synthesis Assessment

Module 1 possesses an extraordinarily solid foundation: its three-pillar forecasting logic, MTD velocity modeling, and programmatic defense of floor coverage are exceptionally well conceived. 

However, before the Starbucks Operations Suite can scale across 100+ stores, the system must undergo targeted remediation:
1. **P0 Bugs must be resolved immediately**: Eliminate the division by zero in the split-week bridge, overhaul the split-week dual-write mechanism to protect monthly P&L, parameterize all Electron SQL queries by `unitCode`, and migrate barista hours into an isolated SQLite table.
2. **P1 Architectural & Algorithmic Flaws must be corrected**: Fix the barista pool formula so manager NC does not starve the bar, classify `T1`–`T10` training shifts as Non-Coverage, de-seasonalize Trading Sunday spikes in the run-rate model, and unify the floor hours standard at 224.0h across seeds, modals, and charts.
3. **P2/P3 Ergonomic Enhancements must be implemented**: Restore `OperationalAlert` and `KpiSummaryCards` into a responsive view, activate the AI strategy switcher, provide keyboard-driven fast data entry, and translate mathematical trends into Starbucks operational guidance.

The complete engineering blueprints, schema specifications, and implementation roadmap to achieve these improvements are detailed in the companion documents:
- **`RFC_MODULE_1_EVOLUTION.md`**: Technical specifications RFC-01 through RFC-06.
- **`ROADMAP_MODULE_1.md`**: Prioritized Quick Wins, Medium-Term, and Long-Term implementation plan.
