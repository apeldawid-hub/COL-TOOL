# Strategic Implementation Roadmap for Module 1: Labor Forecast
**Platform:** Starbucks Operations Suite  
**Target Unit:** Store `108120 SBX Warszawa Janki` & Enterprise Multi-Store Deployment (100+ Stores)  
**Author:** Master Synthesizer & Solutions Architect (`worker_m4_synthesizer`)  
**Mode:** DESIGN MODE (Zero modifications to existing codebase)  
**Date:** 2026-10-24

---

## 1. Roadmap Architecture & Execution Philosophy

This roadmap translates the audit findings (`MODULE_1_AUDIT_REPORT.md`) and technical specifications (`RFC_MODULE_1_EVOLUTION.md`) into a structured, phased implementation sequence. 

The sequence is organized by risk profile and return on investment:
- **Phase 1: Quick Wins (Stabilization & Security — P0 / P1)**: Immediate elimination of crash hazards, data corruption, and multi-store blockers. (Estimated Effort: 1–2 days).
- **Phase 2: Medium-Term Refactorings (Architecture & Ergonomics — P2)**: Modular decoupling, state performance, split-week dual-write persistence, and responsive UI ergonomics. (Estimated Effort: 3–5 days).
- **Phase 3: Long-Term Innovations (Intelligence & Workflow Automation — P3)**: Background thread processing, intra-week pace recalibration, and natural-language Starbucks operational assistance. (Estimated Effort: 1–2 weeks).

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        PHASED EXECUTION TIMELINE & DEPENDENCIES                        │
│                                                                                        │
│  PHASE 1: QUICK WINS (P0 / P1)                                                         │
│  ├── QW-01: Zero-Division Guard in Bridge (BUG-01) ─────────────┐                      │
│  ├── QW-02: Barista Floor Pool Formula Rectification (BUG-05) ──┤                      │
│  ├── QW-03: Barista Training T1-T10 NC Isolation (BUG-06) ──────┼──► STABLE ENGINE     │
│  ├── QW-04: Purge Hardcoded '18120' in Electron SQL (BUG-04) ───┤                      │
│  └── QW-05: Unify Floor Hours Standard at 224h (BUG-07) ────────┘                      │
│                                │                                                       │
│                                ▼                                                       │
│  PHASE 2: MEDIUM-TERM REFACTORINGS (P2)                                                │
│  ├── MT-01: SQLite Table for Daily Barista Hours (BUG-03) ──────┐                      │
│  ├── MT-02: Split-Week Dual-Month Partition Engine (BUG-02) ────┼──► CLEAN P&L & SCALE │
│  ├── MT-03: Performance Custom Hook useLaborForecast (BUG-15) ──┤                      │
│  ├── MT-04: Remount Decision Components & Import Trigger ───────┤                      │
│  └── MT-05: Back-Office Laptop Ergonomics & Sticky Headers ─────┘                      │
│                                │                                                       │
│                                ▼                                                       │
│  PHASE 3: LONG-TERM INNOVATIONS (P3)                                                   │
│  ├── LT-01: Web Worker Multi-Year Trend Analytics                                      │
│  ├── LT-02: Mid-Week What-If Pace & Recovery Tracker ───────────┼──► AUTONOMOUS AI     │
│  └── LT-03: Natural Language Starbucks Operational Assistant ───┘                      │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Phase 1: Quick Wins (Immediate Stabilization — P0 / P1)
**Focus**: Resolve all crash risks, prevent floor barista starvation, and unblock multi-store operations.  
**Prerequisites**: None.  
**Execution Horizon**: Immediate (1–2 Days).

---

### Task QW-01: Zero-Division Guard in Cross-Month Bridge (Fix BUG-01)
- **Severity**: P0 (Critical).
- **Target Files**: `src/modules/labor-forecast/services/calculationEngine.ts` (lines 1395, 1513).
- **Modification Details**:
  - Insert boundary clamp `const safeDaysCount = Math.max(1, lastRow.calculatedDaysCount || 0);`.
  - Guard `daysFraction = safeDaysCount / 7.0` against zero.
  - Implement fallback to `calculatedFloorHours / daysFraction` when `planHours === 0`.
- **Verification**:
  - Unit test with `calculatedDaysCount = 0` verifies output evaluates to `nextFloorHours` instead of `Infinity`.

---

### Task QW-02: Barista Floor Pool Formula Rectification (Fix BUG-05)
- **Severity**: P1 (High).
- **Target Files**: `src/modules/labor-forecast/services/calculationEngine.ts` (lines 1136–1145).
- **Modification Details**:
  - Change subtraction base from total manager hours to manager coverage hours only:
    ```typescript
    // BEFORE:
    const baristaHoursPool = Math.max(0, Number((weekTargetBudget - managerHours).toFixed(1)));
    
    // AFTER:
    const baristaHoursPool = Math.max(0, Number((weekTargetBudget - managerCoverageHours).toFixed(1)));
    ```
- **Verification**:
  - Test scenario where manager has 32h coverage + 16h NC on a 224h budget verifies `baristaHoursPool` outputs $192.0\text{ h}$, maintaining total floor staffing at $32.0 + 192.0 = 224.0\text{ h}$.

---

### Task QW-03: Barista Training Curriculum $T_1$–$T_{10}$ NC Isolation (Fix BUG-06)
- **Severity**: P1 (High).
- **Target Files**: `src/modules/labor-forecast/services/calculationEngine.ts` (lines 154–156).
- **Modification Details**:
  - Extend Non-Coverage matcher with regex `/^T([1-9]|10)$/i`:
    ```typescript
    const isNc =
      shiftDef?.is_nc === 1 || 
      /^T([1-9]|10)$/i.test(code) || 
      ['NC', 'TAM', 'TPM', 'T', 'PRE', 'MEE', 'BT', 'ADM'].includes(code);
    ```
- **Verification**:
  - Test shifts `T1` through `T10` confirm increments to `dayNcH` and zero increments to `dayCovH`.

---

### Task QW-04: Dynamic Unit Code Scoping in Electron SQL (Fix BUG-04)
- **Severity**: P0 (Critical).
- **Target Files**: `electron/main.ts` (lines 530, 602, 799, 860).
- **Modification Details**:
  - Remove hardcoded string literals `'18120'`, `'384'`, `'%108120%'`.
  - Accept `storeId` parameter from renderer and look up active `unitCode`.
  - Rewrite SQL queries to use parameterized `WHERE unit_code = ?`.
- **Verification**:
  - Execute queries under store profile `18155` and confirm actual hours map returns non-empty datasets matching that unit code.

---

### Task QW-05: Unification of Floor Hours Standard at 224.0 h (Fix BUG-07)
- **Severity**: P1 (High).
- **Target Files**:
  - `desktop_app_blueprint/data_schemas_and_seeds/weeks_engine_seed.json`
  - `src/modules/labor-forecast/components/FloorHoursModal.tsx`
  - `src/modules/labor-forecast/components/TrendCharts.tsx`
  - `src/modules/labor-forecast/README.md`
  - `src/modules/labor-forecast/AGENTS.md`
- **Modification Details**:
  - Global replacement of `floor_hours: 272` with `floor_hours: 224` for 7-day weeks.
  - Update chart `<ReferenceLine y={224} label="Baza Floor 224.0h" stroke="#057A55" />`.
  - Update modal reset logic to restore $7 \times 32.0\text{ h} = 224.0\text{ h}$.
- **Verification**:
  - Inspect UI chart and confirm the green/red floor threshold is rendered at $224.0\text{ h}$.

---

## 3. Phase 2: Medium-Term Refactorings (Architecture & Ergonomics — P2)
**Focus**: Structural decoupling, durable SQLite storage, P&L budget safety, and back-office hardware usability.  
**Prerequisites**: Phase 1 completion.  
**Execution Horizon**: 3–5 Days.

---

### Task MT-01: SQLite Persistence for Daily Barista Hours (Fix BUG-03)
- **Target Files**:
  - `electron/database/db.ts` (Schema definition)
  - `electron/main.ts` (IPC handlers: `db:get-daily-barista-hours`, `db:save-daily-barista-hours`)
  - `src/modules/labor-forecast/components/WeeklyScheduleTable.tsx`
- **Execution Blueprint**:
  - Create table `weekly_daily_barista_hours (store_id, week_key, date_iso, day_num, barista_hours, updated_at)`.
  - Remove all invocations of `localStorage.getItem('sbux_daily_barista_hours')`.
  - Wire state initialization and updates through the typed IPC bridge.
- **Deliverable**: Absolute per-store roster isolation and cross-machine database sync.

---

### Task MT-02: Split-Week Dual-Month Partitioning Engine (Fix BUG-02)
- **Target Files**:
  - `src/modules/labor-forecast/services/calculationEngine.ts`
  - `src/modules/labor-forecast/components/WeeklyScheduleTable.tsx`
  - `electron/main.ts`
- **Execution Blueprint**:
  - Implement RFC-01: When saving a split-week schedule, calculate:
    $$H_{\text{sched}}^{(M)} = \sum_{d \in D_M} S_d, \quad H_{\text{sched}}^{(M+1)} = \sum_{d \in D_{M+1}} S_d$$
  - Execute a single atomic transaction saving $H_{\text{sched}}^{(M)}$ to `${year}_${month}_W5` and $H_{\text{sched}}^{(M+1)}$ to `${nextYear}_${nextMonth}_W1`.
- **Deliverable**: Zero P&L budget contamination across month boundaries; flawless financial audit variance.

---

### Task MT-03: Performance Optimization via Hook `useLaborForecast` (Fix BUG-15)
- **Target Files**:
  - `src/modules/labor-forecast/hooks/useLaborForecast.ts` (New file)
  - `src/App.tsx` (Decoupling)
- **Execution Blueprint**:
  - Encapsulate 13 disparate states and 11 IPC calls from `App.tsx` into a dedicated custom hook.
  - Wrap `CalculationEngine.calculateMonth` inside `useMemo`, keyed strictly to actual input dependencies.
  - Prevent re-computation on sidebar toggles or modal state changes.
- **Deliverable**: 60 FPS UI performance and elimination of UI freezing on month load.

---

### Task MT-04: Re-Mount Decision Components & Trigger Activation (Fix BUG-11, BUG-12, BUG-13)
- **Target Files**:
  - `src/modules/labor-forecast/components/LaborForecastView.tsx`
  - `src/modules/labor-forecast/components/OperationalAlert.tsx`
  - `src/modules/labor-forecast/components/KpiSummaryCards.tsx`
  - `src/modules/labor-forecast/services/calculationEngine.ts`
- **Execution Blueprint**:
  - Mount compact `OperationalAlert.tsx` and `KpiSummaryCards.tsx` above the table.
  - Add explicit `Importuj Raport MAPAL` button calling `setIsImportModalOpen(true)`.
  - Pass `selectedStrategy` (*Floor-Safe*, *Balanced*, *Growth*) into `CalculationEngine` to actively adjust HANW recommendations.
- **Deliverable**: Store Manager receives immediate schedule release guidance and functional AI strategy switching.

---

### Task MT-05: Back-Office Laptop Ergonomics & Sticky Headers (Fix BUG-17, BUG-20)
- **Target Files**:
  - `src/modules/labor-forecast/components/WeeklyScheduleTable.tsx`
- **Execution Blueprint**:
  - Add `sticky top-0` to table headers and `sticky left-0` to week identifiers.
  - Implement Operational View toggle (collapsing financial audit columns to fit 1280px widths).
  - Increase micro-typography in daily sub-tables to $\ge 12\text{px}$.
  - Bind `ArrowUp`/`ArrowDown` for row navigation and `Enter` for daily input progression.
- **Deliverable**: High usability and rapid data entry on 13"–14" store laptops.

---

## 4. Phase 3: Long-Term Innovations (Intelligence & Workflow Automation — P3)
**Focus**: Predictive resilience, intra-week pace recalibration, and natural-language Starbucks operational assistance.  
**Prerequisites**: Phase 1 & 2 completion.  
**Execution Horizon**: 1–2 Weeks.

---

### Task LT-01: Web Worker Multi-Year Trend Learning Engine
- **Target Files**:
  - `src/modules/labor-forecast/workers/trendEngine.worker.ts`
  - `src/modules/labor-forecast/services/trendLearningEngine.ts`
- **Innovation**:
  - Offload historical multi-year regression, YoY twin seasonality, and day-of-week profile learning to a dedicated Web Worker thread.
  - Main thread communicates asynchronously via Comlink/postMessage.
- **Deliverable**: Zero frame drops during extensive 5-year historical trend analysis.

---

### Task LT-02: Intra-Week Pace & Recovery Recalibrator ("Mid-Week Assistant")
- **Target Files**:
  - `src/modules/labor-forecast/components/MidWeekRecalibratorModal.tsx`
  - `src/modules/labor-forecast/services/calculationEngine.ts`
- **Innovation**:
  - Allow mid-week partial Fichajes imports (e.g., Friday morning).
  - Calculate pacing:
    $$\Delta_{\text{pace}} = \text{Actual TRX (Days 1..3)} - \text{Plan TRX (Days 1..3)}$$
  - Recommend specific weekend adjustments:
    *"Sprzedaż Wt–Czw jest niższa o 8%. Aby obronić tygodniowy TPLH 3.10, zdejmij 4h w sobotę i 4h w niedzielę z puli Flex."*
- **Deliverable**: Solves "Mid-Week Blindness" and empowers proactive weekend labor management.

---

### Task LT-03: Natural Language Starbucks Operational Assistant
- **Target Files**:
  - `src/modules/labor-forecast/components/OperationalExplanationCard.tsx`
- **Innovation**:
  - Translate raw mathematical and econometric statistics (AOP Anchor 35%, EMA Run-Rate 45%) into plain Starbucks operational instructions:
    - Shift types: `AM`, `PM`, `MID`, `AMN`, `PMN`.
    - Station recommendations: Espresso Bar support vs Order Taking Peak.
    - Delivery schedule alignment.
- **Deliverable**: Eliminates cognitive overload and empowers Store Managers to make confident, business-aligned decisions.

---

## 5. Risk Assessment & Verification Matrix

| Phase | Task ID | Core Technical Risk | Mitigation Strategy | Verification Method |
| :---: | :---: | :--- | :--- | :--- |
| **P1** | **QW-01** | Division by zero in edge-case seed weeks | Boundary clamp `Math.max(1, count)` | Unit test: `calculateCrossMonthBridge` with 0 days outputs finite number. |
| **P1** | **QW-02** | Barista pool under-allocation | Subtract coverage hours only | Unit test: Manager 32h Cov + 16h NC yields full 192h barista pool. |
| **P1** | **QW-04** | Data loss for multi-store queries | Parameterize SQL with `unitCode` | Integration test: Query actuals under store `18155` returns isolated dataset. |
| **P2** | **MT-01** | `localStorage` data migration loss | Automated one-time migration script to SQLite | Verify `weekly_daily_barista_hours` contains records matching legacy storage. |
| **P2** | **MT-02** | Split-week dual-write atomicity failure | Wrap both month updates in SQLite `BEGIN TRANSACTION` | Simulate month-end save; verify sum of both months equals 7-day total. |
| **P2** | **MT-03** | React render loops with `useMemo` | Strict memoization of calculation engine inputs | React Profiler: verify `calculateMonth` executes $\le 1$ time per month change. |

---

## 6. Definition of Done (DoD) for Module 1 Production Hardening

Module 1 will be certified as **Enterprise Ready (v2.0)** when:
1. `npm run build` passes with zero TypeScript warnings or errors.
2. Automated test suite verifies zero occurrences of static fallback store codes (`18120`, `384`) in SQL queries.
3. Split-week schedules written across month boundaries produce exact P&L reconciliations in both months without double-counting.
4. Floor Hours recommendations never drop below $k \times 32.0\text{ h}$, and manager Non-Coverage never reduces the barista floor pool.
5. All daily barista schedules persist exclusively in SQLite, fully namespaced by `store_id`.
6. UI renders with sticky navigation and readable typography on 1366x768 display viewports.
