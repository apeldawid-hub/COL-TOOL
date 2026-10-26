# Architectural & Algorithmic Evolution RFCs for Module 1
**Platform:** Starbucks Operations Suite  
**Target Unit:** Store `108120 SBX Warszawa Janki` & Multi-Store Network (100+ Stores)  
**Document Status:** Production Architectural Specification (RFC Suite)  
**Author:** Master Synthesizer & Solutions Architect (`worker_m4_synthesizer`)  
**Mode:** DESIGN MODE (Zero modifications to existing codebase)  
**Date:** 2026-10-24

---

## Table of Contents
1. [Overview & Architectural Principles](#1-overview--architectural-principles)
2. [RFC-01: Split-Week Dual-Month Partitioning Engine](#2-rfc-01-split-week-dual-month-partitioning-engine)
3. [RFC-02: Multi-Store Dynamic Scoping & Database Isolation](#3-rfc-02-multi-store-dynamic-scoping--database-isolation)
4. [RFC-03: Barista Floor Pool & Non-Coverage Soundness](#4-rfc-03-barista-floor-pool--non-coverage-soundness)
5. [RFC-04: Trading Sunday Outlier Filtering & Run-Rate Ensemble Dampening](#5-rfc-04-trading-sunday-outlier-filtering--run-rate-ensemble-dampening)
6. [RFC-05: Unified Floor Hours Standard (224.0 h Base)](#6-rfc-05-unified-floor-hours-standard-2240-h-base)
7. [RFC-06: Store Manager Decision-Support UX & Performance Architecture](#7-rfc-06-store-manager-decision-support-ux--performance-architecture)

---

## 1. Overview & Architectural Principles

The specifications herein address every root cause identified in `MODULE_1_AUDIT_REPORT.md`. All RFCs adhere to five non-negotiable architectural mandates:

1. **P&L Integrity (No Cross-Month Contamination)**: Financial budgets and scheduled labor must map strictly to the calendar month in which the work is performed.
2. **Absolute Multi-Store Tenant Isolation**: Zero static store codes (`18120`, `384`, `108120`) in queries or business logic; clean SQLite and memory namespaces per store instance.
3. **Inviolable Floor Staffing**: The $32.0\text{ h/day}$ ($224.0\text{ h/week}$) physical presence barrier must never be compromised by manager back-office duties or statistical anomalies.
4. **Offline-First SQLite Persistence**: All operational schedules must persist to local SQLite tables rather than transient or browser-scoped `localStorage`.
5. **Decoupled, Type-Safe Module Contracts**: Interactions between Module 1 (Labor Forecast), Module 2 (Managers Schedule), and Module 3 (Training) must operate via explicit, validated Data Transfer Objects (DTOs).

---

## 2. RFC-01: Split-Week Dual-Month Partitioning Engine

### 2.1. Problem Statement
When a fiscal week (Tuesday–Monday) straddles a calendar month boundary (e.g., September W5: September 29–30 [2 days] and October W1: October 1–5 [5 days]), the Store Manager schedules the full 7-day period as a single coherent operational unit.

Currently, saving this schedule writes the entire 7-day total (e.g., 250.0h) into the single-month key (`2026_Wrzesień_W5`). This inflates September's monthly labor by $+170.0\text{ h}$, while leaving October W1 to double-count its 5 days, severely distorting monthly P&L and labor variance reporting.

### 2.2. Solution Architecture: Dual-Write Partitioning
The Split-Week Engine must treat the week as an integrated operational unit in the UI, but partition persistence cleanly into two separate database records matching the respective calendar months:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│               SPLIT-WEEK OPERATIONAL & FINANCIAL PARTITIONING                           │
│                                                                                         │
│  Store Manager Schedule Input (Full 7-Day Cycle: 250.0 h Total)                         │
│  ┌───────────────────────┬───────────────────────────────────────────────────────────┐  │
│  │ Wt 29.09   Śr 30.09   │ Czw 01.10   Pt 02.10   Sob 03.10   Nd 04.10   Pn 05.10    │  │
│  │  32.0 h     32.0 h    │   32.0 h     36.0 h     46.0 h      36.0 h     36.0 h     │  │
│  └───────────┬───────────┴─────────────────────────────┬─────────────────────────────┘  │
│              │                                         │                                │
│              ▼                                         ▼                                │
│   Partition M (September 2026)              Partition M+1 (October 2026)                │
│   ┌─────────────────────────────┐           ┌─────────────────────────────┐             │
│   │ Week Key: 2026_Wrzesień_W5  │           │ Week Key: 2026_Październik_W1│            │
│   │ Days: 2 (29.09 - 30.09)     │           │ Days: 5 (01.10 - 05.10)     │             │
│   │ Floor: 64.0 h (2 x 32h)     │           │ Floor: 160.0 h (5 x 32h)    │             │
│   │ Scheduled: 64.0 h           │           │ Scheduled: 186.0 h          │             │
│   └─────────────────────────────┘           └─────────────────────────────┘             │
│              │                                         │                                │
│              ▼                                         ▼                                │
│   September Monthly P&L                     October Monthly P&L                         │
│   Actual vs Plan: EXACT                     Actual vs Plan: EXACT                       │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.3. Mathematical Partitioning Algorithm
Let a split week $W$ span from date $D_{\text{start}}$ to $D_{\text{end}}$ across boundary $M \rightarrow M+1$.
- Let $S_d$ be the scheduled hours entered for calendar day $d \in \{1, \dots, 7\}$.
- Let $D_M = \{d \in W \mid \text{month}(d) = M\}$ with count $k_M = |D_M|$.
- Let $D_{M+1} = \{d \in W \mid \text{month}(d) = M+1\}$ with count $k_{M+1} = |D_{M+1}|$.

The partitioned scheduled hours for month $M$ and month $M+1$ are computed as:
$$H_{\text{sched}}^{(M)} = \sum_{d \in D_M} S_d$$
$$H_{\text{sched}}^{(M+1)} = \sum_{d \in D_{M+1}} S_d$$
$$H_{\text{sched}}^{\text{Total}} = H_{\text{sched}}^{(M)} + H_{\text{sched}}^{(M+1)}$$

**Proof of Invariance**:
$$\sum_{d \in D_M} S_d + \sum_{d \in D_{M+1}} S_d \equiv \sum_{d=1}^7 S_d$$
Neither month incurs artificial budget deficits or double-counted hours.

### 2.4. Division-by-Zero Guard (Remediation of BUG-01)
In `calculateCrossMonthBridge`, replace the unguarded division:
```typescript
// BEFORE (Vulnerable to Infinity):
const nextPlanHours = Number(
  ((nextFloorHours / 224.0) * (lastRow.planHours / (lastRow.calculatedDaysCount / 7))).toFixed(1)
) || nextFloorHours;
```

With the mathematically sound, boundary-guarded formulation:
```typescript
// AFTER (Robust):
const safeDaysCount = Math.max(1, lastRow.calculatedDaysCount || 0);
const daysFraction = safeDaysCount / 7.0;

// Resolve true AOP baseline: use AOP table if available, fallback to floor base
const rawDailyAverage = lastRow.planHours > 0
  ? (lastRow.planHours / daysFraction)
  : (lastRow.calculatedFloorHours > 0 ? (lastRow.calculatedFloorHours / daysFraction) : 32.0);

const nextPlanHours = Number(
  ((nextFloorHours / 224.0) * rawDailyAverage).toFixed(1)
) || nextFloorHours;
```

### 2.5. TypeScript Contract & IPC Signature
```typescript
export interface SplitWeekPartitionPayload {
  storeId: string;
  splitWeekKey: string;              // e.g. "2026_Wrzesień_W5_2026_Październik_W1"
  currentMonthKey: string;           // "2026_Wrzesień_W5"
  nextMonthKey: string;              // "2026_Październik_W1"
  dailyAllocations: Array<{
    date: string;                    // "YYYY-MM-DD"
    dayOfWeek: string;               // "Wt", "Śr", etc.
    monthNum: number;                // 9 or 10
    managerHours: number;
    baristaHours: number;
    totalHours: number;
  }>;
  currentMonthTotalHours: number;    // Exactly sum(days in M)
  nextMonthTotalHours: number;       // Exactly sum(days in M+1)
}

// IPC Channel: 'db:save-split-week-schedule'
```

---

## 3. RFC-02: Multi-Store Dynamic Scoping & Database Isolation

### 3.1. Problem Statement
The codebase contains hardcoded strings referencing Unit `18120` / `384` across `electron/main.ts` and `db.ts`. Furthermore, `WeeklyScheduleTable.tsx` stores barista schedules in browser `localStorage` under a non-namespaced key. This prevents the application from scaling to 100+ stores and causes severe cross-store data leakage.

### 3.2. Purging Hardcoded SQL Filters
All SQL queries in `electron/main.ts` must replace static unit clauses with dynamic parameters scoped to the active store session.

#### Remediation Matrix:
```typescript
// BEFORE (electron/main.ts:530, 602, 860):
`SELECT ... FROM labor_actuals_log 
 WHERE (date LIKE ? OR date LIKE ?) 
   AND (unit_code = '18120' OR unit_code = '384' OR unit_name LIKE '%108120%')`

// AFTER (Dynamic Parameterized Execution):
ipcMain.handle('db:get-weekly-actual-hours-map', async (_event, year: number, month: number, storeId: string) => {
  const store = storeManager.getStoreById(storeId);
  const unitCode = store?.unitCode || 'UNKNOWN';
  
  const sql = `
    SELECT week_key, SUM(computable_time) as total_hours 
    FROM labor_actuals_log 
    WHERE year = ? AND month = ? AND unit_code = ?
    GROUP BY week_key
  `;
  return dbManager.all(sql, [year, month, unitCode]);
});
```

### 3.3. Migration of `dailyBaristaHours` from `localStorage` to SQLite
To guarantee multi-store data isolation and offline durability, daily barista allocations must be removed from `localStorage` and persisted in SQLite.

#### Database DDL:
```sql
CREATE TABLE IF NOT EXISTS weekly_daily_barista_hours (
  store_id TEXT NOT NULL,
  week_key TEXT NOT NULL,
  date_iso TEXT NOT NULL,
  day_num INTEGER NOT NULL,          -- 1 to 7 (Tuesday = 1, Monday = 7)
  barista_hours REAL NOT NULL DEFAULT 0.0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (store_id, week_key, date_iso)
);

CREATE INDEX IF NOT EXISTS idx_barista_lookup 
ON weekly_daily_barista_hours (store_id, week_key);
```

#### TypeScript Repository Interface:
```typescript
export interface DailyBaristaHourRecord {
  storeId: string;
  weekKey: string;
  dateIso: string;
  dayNum: number;
  baristaHours: number;
  updatedAt: string;
}

export interface IBaristaHoursRepository {
  getDailyBaristaHours(storeId: string, weekKey: string): Promise<Record<string, number>>;
  saveDailyBaristaHours(storeId: string, weekKey: string, dailyMap: Record<string, number>): Promise<void>;
}
```

---

## 4. RFC-03: Barista Floor Pool & Non-Coverage Soundness

### 4.1. Problem Statement
The current formula:
$$\text{baristaHoursPool} = \max(0, \text{Target Budget} - (\text{managerCoverage} + \text{managerNc}))$$
deducts manager back-office duties (e.g., 8h of administrative `NC`) from the floor budget. When a week is budgeted at the minimum Floor Base of 224.0h, this deduction starves the physical bar of 8 to 16 hours of barista staffing.

Additionally, barista training shifts $T_1$ through $T_{10}$ from Module 3 are omitted from Non-Coverage definitions and are incorrectly classified as floor coverage, reducing physical floor presence during training.

### 4.2. Mathematical Rectification of the Barista Pool Formula
Floor staffing requires partners physically present on the floor. Manager back-office Non-Coverage hours must be funded out of the separate corporate NC budget and must **never** reduce the customer-facing barista pool:

$$\mathbf{Correct\ Barista\ Floor\ Pool}:$$
$$H_{\text{Barista Pool (Floor)}} = \max\left(0, H_{\text{Target Budget}} - H_{\text{MGR Coverage}}\right)$$

Where:
- $H_{\text{Target Budget}} = \max\left(\text{HANW Final}, \text{Calculated Floor Base}\right)$
- $H_{\text{MGR Coverage}} = \sum \text{Hours of manager shifts where } \text{isNc} = \text{false}$

$$\mathbf{Total\ Physical\ Floor\ Presence}:$$
$$H_{\text{Floor Total}} = H_{\text{MGR Coverage}} + H_{\text{Barista Pool (Floor)}} \ge 224.0\text{ h (or } k \times 32.0\text{h)}$$

### 4.3. Universal Training Shift Recognition ($T_1$–$T_{10}$)
In `calculationEngine.ts`, update `isNc` qualification to systematically recognize all certified barista training modules:

```typescript
// Refactored Shift Qualification Function
export function isNonCoverageShift(shiftCode: string, shiftDef?: ShiftDefinition): boolean {
  if (!shiftCode) return false;
  
  // 1. Explicit domain attribute from Module 2 database
  if (shiftDef && shiftDef.is_nc === 1) return true;
  
  // 2. Barista Training Modules T1 through T10 (Module 3 certified curriculum)
  const isBaristaTrainingModule = /^T([1-9]|10)$/i.test(shiftCode);
  if (isBaristaTrainingModule) return true;
  
  // 3. Standard corporate Non-Coverage shift designations
  const standardNcCodes = ['NC', 'TAM', 'TPM', 'T', 'PRE', 'MEE', 'BT', 'ADM', 'INV'];
  return standardNcCodes.includes(shiftCode.toUpperCase());
}
```

---

## 5. RFC-04: Trading Sunday Outlier Filtering & Run-Rate Ensemble Dampening

### 5.1. Problem Statement
Centrum Handlowe Janki operates under the 7 Trading Sundays calendar. A Trading Sunday experiences a **~250% transaction spike** (+1,000 to +1,200 TRX). 

In `calculationEngine.ts`, the short-term Run-Rate model applies exponential recency weights ($1.8^k$). When a week containing a Trading Sunday closes, the engine interprets this one-off event as a permanent structural demand acceleration, erroneously inflating the labor budget for subsequent non-trading weeks by $+8\%$ to $+12\%$ (+60h to +96h).

### 5.2. Algorithmic Solution: Discrete Event De-Seasonalization
The Run-Rate velocity $v_{\text{RunRate}}$ must operate on **de-seasonalized baseline demand**, isolating the commercial spike to the specific week in which the Trading Sunday occurred:

```
Closed Week k (With Trading Sunday)
Actual TRX: 3,050  |  Plan TRX: 2,527
             │
             ├── Step 1: Detect Trading Sunday in Week k
             │   Trading Sunday Actual TRX = 875 TRX
             │   Baseline Sunday Average = 350 TRX
             │   Outlier Delta Δ_spike = 875 - 350 = +525 TRX
             │
             ├── Step 2: Normalize Actual TRX
             │   Actual TRX_norm = 3,050 - 525 = 2,525 TRX
             │   Normalized Ratio_norm = 2,525 / 2,527 = 0.999 (~100% of plan)
             │
             └── Step 3: Feed Normalized Ratio to 1.8^k Run-Rate Model
                 Result: Run-Rate accurately reflects baseline pace.
                 Next Week (Non-Trading) receives correct, disciplined budget.
```

### 5.3. Mathematical Formulation
Let week $k$ contain actual transaction volume $T_k$ and planned volume $P_k$.
If week $k$ includes a Trading Sunday $d_{\text{trade}}$:
$$\Delta_{\text{Trade Spike}} = \max\left(0, T(d_{\text{trade}}) - \overline{T}_{\text{NonTrade Sunday}}\right)$$
$$T_k^{\text{normalized}} = T_k - \Delta_{\text{Trade Spike}}$$

The normalized run-rate ratio is:
$$R_k^{\text{norm}} = \frac{T_k^{\text{normalized}}}{P_k}$$

The de-seasonalized Run-Rate Velocity is:
$$v_{\text{RunRate}}^{\text{clean}} = \frac{\sum_{k=0}^{K-1} R_k^{\text{norm}} \cdot 1.8^k}{\sum_{k=0}^{K-1} 1.8^k}$$

When planning for an upcoming week $j$:
$$\text{Projected TRX}_j = P_j \cdot v_{\text{blended}}^{\text{clean}} + \begin{cases} \Delta_{\text{Trade Spike}}^{\text{forecast}} & \text{if week } j \text{ is a Trading Sunday} \\ 0 & \text{otherwise} \end{cases}$$

---

## 6. RFC-05: Unified Floor Hours Standard (224.0 h Base)

### 6.1. Problem Statement
The calculation engine correctly computes $7\text{ days} \times 32.0\text{ h/day} = 224.0\text{ h/week}$. However, 670 database rows in `weeks_engine_seed.json`, text in `FloorHoursModal.tsx`, and reference lines in `TrendCharts.tsx` hardcode an obsolete standard of **272.0 h/week** ($6 \times 40\text{h} + 32\text{h}$).

### 6.2. Elimination of 272h Artifacts
1. **Database Seed Migration**:
   Update `desktop_app_blueprint/data_schemas_and_seeds/weeks_engine_seed.json`:
   ```json
   // For all 7-day calendar weeks:
   "floor_hours": 224.0
   ```
   For partial weeks with $k$ days:
   ```json
   "floor_hours": k * 32.0
   ```

2. **Database Migration Script**:
   ```sql
   -- Migration: 004_unify_floor_hours_224.sql
   UPDATE calendar_weeks 
   SET floor_hours = days_count * 32.0 
   WHERE floor_hours = 272.0 OR floor_hours != days_count * 32.0;
   ```

3. **Chart Reference Line Update (`TrendCharts.tsx`)**:
   ```tsx
   // BEFORE:
   <ReferenceLine y={272} label="Floor 272h" stroke="#DC2626" />
   
   // AFTER:
   <ReferenceLine 
     y={224} 
     label={{ value: 'Baza Floor 224.0h', fill: '#057A55', fontSize: 11, fontWeight: 700 }} 
     stroke="#057A55" 
     strokeWidth={2}
     strokeDasharray="4 4" 
   />
   ```

4. **UI Modal Cleanup (`FloorHoursModal.tsx`)**:
   Purge text referring to "40h Pn–Sob" and replace reset defaults with $32.0\text{ h/day}$ ($224.0\text{ h/week}$).

---

## 7. RFC-06: Store Manager Decision-Support UX & Performance Architecture

### 7.1. Performance Architecture: Custom Hook `useLaborForecast`
To resolve the "God Component" bottleneck in `App.tsx` and eliminate synchronous recalculation on every render:

```typescript
export interface UseLaborForecastReturn {
  summary: MonthlyCalculationSummary | null;
  isLoading: boolean;
  error: Error | null;
  selectedStrategy: 'floor_safe' | 'balanced' | 'growth';
  setSelectedStrategy: (s: 'floor_safe' | 'balanced' | 'growth') => void;
  saveScheduledHours: (weekKey: string, hours: number) => Promise<void>;
  saveDailyBaristaHours: (weekKey: string, dailyMap: Record<string, number>) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useLaborForecast(year: number, month: number, storeId: string): UseLaborForecastReturn {
  // 1. Data fetching managed via clean single IPC aggregation
  // 2. Calculation memoized with useMemo:
  const summary = useMemo(() => {
    if (!aopPlan || weeks.length === 0) return null;
    return CalculationEngine.calculateMonth({
      aopPlan,
      weeks,
      weeklyTrxMap,
      actualHoursMap,
      scheduledHoursMap,
      historicalPlans,
      managerShifts,
      shiftDefinitions,
      dailyKpiMap,
      dailyActualHoursMap,
      selectedStrategy, // Actively fed into engine!
      storeId
    });
  }, [
    aopPlan, weeks, weeklyTrxMap, actualHoursMap, scheduledHoursMap,
    historicalPlans, managerShifts, shiftDefinitions, dailyKpiMap,
    dailyActualHoursMap, selectedStrategy, storeId
  ]);

  return { summary, ... };
}
```

### 7.2. Active Integration of the AI Strategy Switcher
Modify `CalculationEngine.calculateMonth` to accept `selectedStrategy`:

$$\begin{array}{|l|l|l|}
\hline
\textbf{Strategy} & \textbf{Algorithmic Behavior} & \textbf{Impact on HANW Final} \\
\hline
\textbf{Floor-Safe} (\text{Konserwatywna}) & \text{Clamps to pure Floor base: } \max(224.0, \text{HANW Raw}) & \text{Minimum operational cost} \\
\textbf{Balanced} (\text{Zrównoważona}) & \text{Standard Ensemble } v_{\text{blended}} \text{ with optimal Flex distribution} & \text{Targets exact AOP TPLH} \\
\textbf{Growth} (\text{Wzrostowa}) & \text{Injects learned demand buffer } \Delta_{\text{buffer}} \text{ on peak days} & \text{Protects speed of service at peak} \\
\hline
\end{array}$$

### 7.3. Responsive Back-Office Table Ergonomics (13"–14" Laptops)
To guarantee high usability on store hardware:

1. **Sticky Layout Specifications**:
   - The table header row receives: `sticky top-0 z-20 bg-slate-900 shadow-md`.
   - The first column (`Tydzień & Status`) receives: `sticky left-0 z-10 bg-slate-800 border-r border-slate-700`.
2. **Dual-View Mode Toggle**:
   - **Operational View (Default for SM)**: Displays 6 essential columns:
     `[Tydzień & Daty | Cel TRX | Act RCP | Godziny MGR | Godziny Baristów | Rekomendacja HANW]`.
   - **Financial Audit View**: Expands to show AOP variance, TPLH breakdown, and day weights.
3. **Typography Standard**: Minimum font size across all sub-tables and input badges enforced at **12px** with high contrast (`text-slate-100` on `bg-slate-800`).

### 7.4. Excel-Like Keyboard Fast Entry
Implement standard spreadsheet navigation handlers:
- `ArrowDown` / `ArrowUp`: Traverse between week rows in the active column.
- `Enter` inside daily barista inputs: Commit current day and advance cursor focus to the next calendar day (`Wt` $\rightarrow$ `Śr` $\rightarrow$ `Czw`).
- `Escape`: Revert inline cell edit without saving.
- `Ctrl + Enter`: Save and close the daily expansion drawer.

### 7.5. Re-Mounting Decision Components (`OperationalAlert` & `KpiSummaryCards`)
Replace the overloaded single-row Hero Bar in `LaborForecastView.tsx` with a two-tier decision-support layout:
1. **Tier 1 (Decision Guidance)**: Mounts the compact, responsive `OperationalAlert.tsx` directly above the schedule matrix. Alerts clearly display schedule release status for week $W+1$ and $W+2$.
2. **Tier 2 (Core Financial Context)**: Mounts `KpiSummaryCards.tsx` showing the 3 vital metrics: Monthly AOP Target, MTD Velocity, and HANW Recommendation, explicitly rendering the current MTD TPLH ratio.
3. **Dedicated Import Trigger**: Mount an explicit, prominent button in the table header:
   ```tsx
   <button
     onClick={() => setIsImportModalOpen(true)}
     className="flex items-center gap-2 px-3 py-1.5 bg-[#00704A] hover:bg-[#005c3c] text-white rounded-lg text-xs font-semibold shadow transition-colors"
   >
     <UploadCloud className="w-4 h-4" />
     Importuj Raport MAPAL (Fichajes)
   </button>
   ```
