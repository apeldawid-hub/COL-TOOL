# Task Assignment: Inter-Module Integration Survey (M1, M2, M3 Bridges)

## Identity
- Role: Inter-Module Integration Explorer
- Working Directory: /Users/dawidapel/COL Tool/.agents/teamwork/explorer_survey_intermodule
- Parent: Orchestrator 3 (/Users/dawidapel/COL Tool/.agents/teamwork/orchestrator_3)

## Mandatory Reading
- ORIGINAL_REQUEST.md: /Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md (Pay special attention to ## Follow-up — 2026-10-24T00:44:10Z)
- Project rules: /Users/dawidapel/COL Tool/AGENTS.md
- Module 1 specifications: /Users/dawidapel/COL Tool/src/modules/labor-forecast/AGENTS.md
- Module 2 specifications: /Users/dawidapel/COL Tool/src/modules/managers-schedule/AGENTS.md
- Module 3 specifications: /Users/dawidapel/COL Tool/src/modules/trainings/AGENTS.md
- Skills: fichajes-pipeline, labor-law-sentinel

## Objective
Thoroughly explore the existing architectures, services, and exportable interfaces across Modules 1, 2, and 3 to define the bi-directional data contracts with Module 4:
1. Module 1 (Labor Forecast):
   - How `Sales AOP`, `TRX AOP`, `TPLH AOP` are structured and stored.
   - MTD Velocity prediction engine and sales trend ingestion.
   - Hourly labor demand synchronization (`HANW`) and floor hours enforcement (32h/day).
2. Module 2 (Managers Schedule & Fichajes RCP):
   - Manager roster schema (`manager_monthly_roster`), contract types (UoP, FTEs), base salaries, and scheduled shifts.
   - Two-track Estimation column: past days actuals from MAPAL Fichajes RCP vs future days scheduled hours.
   - Absence tracking: sick leave L4 (80% / 20% employer reduction rules) and vacation leaves (H).
   - Collision detection and synchronization mechanisms.
3. Module 3 (Trainings):
   - Structure of barista training hours (sessions T1-T10).
   - Transfer mechanism to Non-Coverage budget (`TRAINING` 75h) without penalizing Floor Hours.
4. Evaluate current bridge services, types, or gaps between these modules and Module 4.

## Output Requirements
- Write your comprehensive survey report to `/Users/dawidapel/COL Tool/.agents/teamwork/explorer_survey_intermodule/report.md`.
- Write your handoff summary to `/Users/dawidapel/COL Tool/.agents/teamwork/explorer_survey_intermodule/handoff.md`.
- Send completion message to Orchestrator 3 via `send_message`.


## 2026-10-24T00:47:18Z
Read /Users/dawidapel/COL Tool/.agents/teamwork/explorer_survey_intermodule/DISPATCH.md and /Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md.
Perform a thorough investigation of cross-module integration contracts across Module 1 (Labor Forecast), Module 2 (Managers Schedule & Fichajes RCP), and Module 3 (Trainings) in relation to Module 4.
Investigate AOP data, MTD velocity, HANW, manager roster, scheduled vs RCP actual hours (two-track estimation), L4/H absences, and T1-T10 training transfer to Non-Coverage budget.
Write your detailed report to /Users/dawidapel/COL Tool/.agents/teamwork/explorer_survey_intermodule/report.md and your handoff summary to /Users/dawidapel/COL Tool/.agents/teamwork/explorer_survey_intermodule/handoff.md.
Send a completion message back to Orchestrator 3 (e0e90d1c-21db-4fb1-b71d-37affcea30eb).
