# Task Assignment: UI/UX Architecture & SQLite Data Layer Survey

## Identity
- Role: UI/UX & Data Layer Specification Miner
- Working Directory: /Users/dawidapel/COL Tool/.agents/teamwork/explorer_survey_ui_data
- Parent: Orchestrator 3 (/Users/dawidapel/COL Tool/.agents/teamwork/orchestrator_3)

## Mandatory Reading
- ORIGINAL_REQUEST.md: /Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md (Pay special attention to ## Follow-up — 2026-10-24T00:44:10Z)
- Project rules: /Users/dawidapel/COL Tool/AGENTS.md
- Skills: sqlite-guardian, ux-auditor
- Module 4 specifications: /Users/dawidapel/COL Tool/src/modules/col-calculator/AGENTS.md

## Objective
Thoroughly explore the existing data storage layer, SQLite architecture, and UI/UX components for Module 4:
1. SQLite & Data Architecture:
   - Current SQLite schema, tables, indices, migrations across the app (in `electron/`, `src/services/`, etc.).
   - Multi-Store Isolation (`store_${id}.db`) and separation of user data in `~/Library/Application Support/Starbucks Operations Suite/`.
   - What tables and columns are required for Module 4 (3 pillars, monthly archives, parameters, staff rosters, what-if scenarios).
2. UI/UX 6-Tab Excel Replica:
   - Requirements for the 6 tabs reproducing official Starbucks Excel workflow:
     1. `CALCULATOR`: 3-Pillar main view + staffing editors.
     2. `BONUS`: bonus incentive matrix.
     3. `Rezerwa urlopowa`: holiday accrual ledger.
     4. `DANE`: wage rates, legal minimums, store catalog.
     5. `Fields Description`: complete glossary of all 66 indicators.
     6. `USER GUIDE`: Store Manager operational guidance.
3. Interactive What-If P&L Simulator:
   - Dynamic TPLH efficiency slider/input, instant recalculation of saved crew hours, financial savings in PLN, and % COL impact.
4. Back-office Store Manager laptop ergonomics:
   - Screen resolution constraints, keyboard navigation, inline data editing, KPI summary cards, visual alerts.

## Output Requirements
- Write your comprehensive survey report to `/Users/dawidapel/COL Tool/.agents/teamwork/explorer_survey_ui_data/report.md`.
- Write your handoff summary to `/Users/dawidapel/COL Tool/.agents/teamwork/explorer_survey_ui_data/handoff.md`.
- Send completion message to Orchestrator 3 via `send_message`.


## 2026-10-24T00:47:18Z
Read /Users/dawidapel/COL Tool/.agents/teamwork/explorer_survey_ui_data/DISPATCH.md and /Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md.
Perform a thorough investigation of the SQLite data persistence layer (Multi-Store isolation store_${id}.db, electron IPC, user data in Application Support) and the UI/UX architecture for the 6-tab Excel replica (CALCULATOR, BONUS, Rezerwa urlopowa, DANE, Fields Description, USER GUIDE) plus the interactive What-If P&L Simulator.
Write your detailed report to /Users/dawidapel/COL Tool/.agents/teamwork/explorer_survey_ui_data/report.md and your handoff summary to /Users/dawidapel/COL Tool/.agents/teamwork/explorer_survey_ui_data/handoff.md.
Send a completion message back to Orchestrator 3 (e0e90d1c-21db-4fb1-b71d-37affcea30eb).
