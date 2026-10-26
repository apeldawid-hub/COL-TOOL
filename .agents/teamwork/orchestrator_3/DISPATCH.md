# DISPATCH — Orchestrator (Generation 3)

## Mission
Lead the comprehensive architectural, mathematical, and operational design of Module 4 (COL Calculator / Cost of Labor Suite) for Starbucks Operations Suite (`108120 SBX Warszawa Janki`), bringing it from a skeletal/initial state to a fully specified, robust, and deeply integrated production-grade module in synergy with Module 1 (Labor Forecast), Module 2 (Managers Schedule & RCP), and Module 3 (Trainings). Task is executed strictly in design mode (ZERO source code modifications).

## Working Directory
`/Users/dawidapel/COL Tool/.agents/teamwork/orchestrator_3`

## Reference Request
See `/Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md` under `## Follow-up — 2026-10-24T00:44:10Z`.

## Scope & Core Requirements

### R1. P&L Engine Architecture & 3-Pillar Model (AOP, Target, MTD Estimation)
- Complete production calculation model for Starbucks/AmRest in `colEngine`:
  - 🏛️ AOP Pillar: annual data sources (Sales, TRX, TPLH, Budget PLN, COL % AOP).
  - 🎯 Target Pillar: monthly plan created by Store Manager (SM), manager and crew hours calculation.
  - ⚡ Estimation Pillar: dynamic month-end estimation based on Month-To-Date (MTD) progress.
  - Automatic calculation of variance $\Delta$ vs AOP and $\Delta$ vs Target (PLN amounts and percentage points p.p.).
- Financial P&L Formulas & Labor Economics:
  - Total COL % ($\frac{\text{Total COL Costs}}{\text{Sales}}$), TPLH Total vs TPLH Coverage (excluding leaves and training).
  - ZUS overheads (16.93% employer social contributions, FP/FGŚP 2.55%, PFRON 200 PLN/FTE) strictly separated by:
    - Managers (MGR),
    - Crew UoP (employment contract, minimum wage safeguards for 2025/2026),
    - Crew UZ (mandate contracts, hourly rates).
  - Holiday Accrual (rezerwa urlopowa, 21-day working divisor), clothing allowance (ekwiwalent odzieżowy 0.85 PLN/h for crew, lump sum for MGR), SM/ASM/SSV bonus matrices, and delivery order costs (orders $\times$ drop cost 14 PLN).

### R2. End-to-End Inter-Module Data Bus & SQLite Persistence
- Module 1 (Labor Forecast) integration:
  - Automatic import of `Sales AOP`, `TRX AOP`, `TPLH AOP`.
  - MTD Velocity prediction and sales trend ingestion.
  - Hourly labor demand synchronization (`HANW`).
- Module 2 (Managers Schedule & Fichajes RCP) integration:
  - Automatic ingestion of manager roster (`manager_monthly_roster`), FTEs, base rates, and scheduled manager hours.
  - Two-track Estimation column: past days populated with actual MAPAL Fichajes RCP hours, future days with scheduled hours from Module 2.
  - Absence synchronization: sick leave L4 (80% / 20% reduction) and vacation leaves (H).
- Module 3 (Trainings) integration:
  - Automatic transfer of barista training hours (sessions T1-T10) to Non-Coverage budget (`TRAINING` 75h) without penalizing Floor Hours.
- SQLite Data Layer:
  - Production-ready schema design for Module 4 with Multi-Store Isolation (`store_${id}.db`) and separation of user data in `Application Support`.

### R3. UI/UX Architecture & Sheet Replica (Excel Replica & What-If Simulator)
- 6-tab ergonomic layout reproducing official Starbucks Excel workflow:
  - `CALCULATOR`: 3-Pillar main view + staffing editors.
  - `BONUS`: bonus incentive matrix.
  - `Rezerwa urlopowa`: holiday accrual ledger.
  - `DANE`: wage rates, legal minimums, store catalog.
  - `Fields Description`: complete glossary of all 66 indicators.
  - `USER GUIDE`: Store Manager operational guidance.
- Interactive What-If P&L Simulator: dynamic TPLH efficiency slider/input, instant recalculation of saved crew hours, financial savings in PLN, and % COL impact.
- Ergonomics for Store Manager back-office laptop workflow (keyboard navigation, inline editing, clear KPI status cards).

### R4. Comprehensive Implementation Blueprint & Roadmap
- Phased technical blueprint:
  - Phase 1: Data models & SQLite schema (tables, indices, migrations).
  - Phase 2: Computational engine `colEngine` & mathematical P&L regression tests.
  - Phase 3: Integration bridge services (Modules 1, 2, and 3).
  - Phase 4: UI components, Excel replica tabs, and What-If simulator.

## Strict Operational Constraints
- **Design Mode Only**: Do NOT edit, mutate, or delete any source code files (`.ts`, `.tsx`, `.js`, `.json`) in `src/`.
- Decompose and coordinate subagents under `.agents/teamwork/`.
- Keep `BRIEFING.md` and `progress.md` continuously updated in your directory.
- Deliver comprehensive, structured design specifications fulfilling all acceptance criteria.
- When finished, claim victory to Sentinel.
