# Scope: Module 2 (Managers Schedule) 360° Comprehensive Audit

## Architecture
Module 2 (`src/modules/managers-schedule/`) provides manager shift scheduling, Polish Labor Code (Kodeks Pracy) validation, automated schedule generation (AutoScheduler AI Monte Carlo solver), quarterly accounting (Trzymiesięczny Okres Rozliczeniowy - TOR), and integration with MAPAL Fichajes time tracking (RCP) and absence data (L4/H).

Key components and services:
- `services/managerScheduleEngine.ts`: Polish Labor Code rules (KP art. 130, 132, 133, 135, 151^10, 154^2, 166), monthly norm calculation, shift validation, Sunday trading rules, boundary transitions ($M-1 \rightarrow D_1$, $D_{\text{last}} \rightarrow M+1$).
- `services/autoSchedulerEngine.ts`: 20,000 attempts Monte Carlo solver, shift assignment heuristics, fairness & equity distribution (weekends, closing shifts, 2-day OFF batches, weekly hours corridor), deadlock negotiation assistant.
- `services/torEngine.ts`: 3-month settlement period (TOR Q1-Q4) calculation, 3-column model (RCP, H, L4), part-time FTE handling, over/under-hours balance.
- `services/interStoreSupportEngine.ts`: Inter-store support shifts (`SAM`/`SPM`/`SUP`) and dispatching.
- `services/managerExcelExport.ts`: Excel export parity with Starbucks corporate templates (`Grafik wrzesień Janki 2026.xlsm`).
- `components/`: UI views including `ManagerScheduleView.tsx`, `ManagerScheduleGrid.tsx`, `AutoScheduleModal.tsx`, `AutoScheduleWidget.tsx`, `TorView.tsx`, `LaborLawComplianceModal.tsx`, `LaborLawViolationDialog.tsx`, `RcpAbsenceConflictDialog.tsx`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Labor Code (KP) Compliance | Validation of art. 130, 132, 133, 135, 151^10, 154^2, 166 KP | M1 | ORIGINAL_REQUEST §R1 |
| 2 | Month Transition Continuity | Rest periods and shift continuity across M-1 -> D1 and D_last -> M+1 | M1 | ORIGINAL_REQUEST §R1 |
| 3 | CH Janki Local Rules | 108120 Janki rules: 7 trading Sundays vs non-trading, AMN/PMN, 32h floor | M1 | ORIGINAL_REQUEST §R1 |
| 4 | Edge Cases Analysis | Min 3 edge cases (year/quarter boundary, FTE change mid-month, holiday on Sunday) | M1 | ORIGINAL_REQUEST §R1 |
| 5 | Reference Sheet Parity | Verification against `Grafik/Grafik wrzesień Janki 2026.xlsm` | M1 | ORIGINAL_REQUEST §R1 |
| 6 | AutoScheduler AI 20k Monte Carlo | Solver architecture, batching, and termination conditions | M2 | ORIGINAL_REQUEST §R2 |
| 7 | Web Worker Thread Offloading | Decoupling solver computation from UI/React thread with state serialization | M2 | ORIGINAL_REQUEST §R2 |
| 8 | Fairness & Equity Heuristics | Objective scoring: weekend spread, closing rotation, 2-day OFF batches, weekly corridor | M2 | ORIGINAL_REQUEST §R2 |
| 9 | Deadlock Negotiation Assistant | Conflict resolution heuristics when constraints cannot be satisfied | M2 | ORIGINAL_REQUEST §R2 |
| 10 | TOR 3-Column Model | Calculation of RCP (actuals), H (holiday), L4 (sick leave) in quarterly settlement | M3 | ORIGINAL_REQUEST §R3 |
| 11 | Part-Time FTE Balancing | Handling part-time contracts without false deficit calculations | M3 | ORIGINAL_REQUEST §R3 |
| 12 | Database Missing Entry Resilience | Graceful handling of missing days, null entries, or incomplete punch logs | M3 | ORIGINAL_REQUEST §R3 |
| 13 | Fichajes RCP vs Absence Collision | Detection and resolution of conflicts between RCP clock-ins and L4/H leaves | M3 | ORIGINAL_REQUEST §R3 |
| 14 | Architecture & Algorithmic Catalog | Prioritized catalog of technical RFCs and improvements | M4 | ORIGINAL_REQUEST §R4 |
| 15 | Back-Office UX/UI Recommendations | Store Manager ergonomics, cognitive load, table layout, keyboard navigation | M4 | ORIGINAL_REQUEST §R4 |
| 16 | Zero Code Mutation Forensic Audit | Independent verification that no source code files in `src/` were modified | M5 | DISPATCH.md Constraint |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Labor Code & Janki Standards | Legal compliance, KP articles, boundary shifts, Janki store rules, edge cases, reference sheet comparison | none | PLANNED |
| M2 | AutoScheduler AI & Web Worker | 20k Monte Carlo loop, Web Worker design, state serialization, scoring heuristics, deadlock assistant | none | PLANNED |
| M3 | TOR Accounting & Fichajes RCP | 3-column model, part-time FTE calculations, missing DB records, RCP vs L4/H collision detection | none | PLANNED |
| M4 | Architectural & UX/UI Catalog | Technical RFCs, Store Manager back-office UX recommendations, prioritization (Quick Wins / Long-Term) | M1, M2, M3 | PLANNED |
| M5 | Synthesis & Forensic Audit | Compile FINAL_REPORT.md, run forensic audit for zero code mutations, handoff to Sentinel | M1, M2, M3, M4 | PLANNED |

## Interface Contracts
### Module 2 (Managers Schedule) ↔ Module 1 (Labor Forecast)
- Manager Labor Bridge: Module 1 consumes manager coverage hours (excluding leaves `L4`/`H`/`OFF` and non-coverage/support `SAM`/`SPM`/`SUP`) to compute Remaining Barista Hours Pool.
### Module 2 (Managers Schedule) ↔ Module 4 (COL Calculator)
- Actual vs Scheduled Labor Hours, TOR overtime liabilities, and manager salary impact on Total COL %.
