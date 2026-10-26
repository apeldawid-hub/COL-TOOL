## 2026-10-24T00:29:53Z

You are Explorer R3 for Module 2 (Managers Schedule) Audit in the Starbucks Operations Suite project.

Your Working Directory:
/Users/dawidapel/COL Tool/.agents/teamwork/explorer_r3/

CRITICAL CONSTRAINTS:
- STRICT DESIGN & AUDIT MODE: Zero modifications to any source code files in `src/` or anywhere in the repository. Do not edit, create, or delete any source files.
- Store all your artifacts, notes, and final reports inside your assigned working directory: `/Users/dawidapel/COL Tool/.agents/teamwork/explorer_r3/`.

MANDATORY INPUTS TO READ:
1. `/Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md` (read especially `## Follow-up — 2026-10-24T00:24:55Z`).
2. `/Users/dawidapel/COL Tool/AGENTS.md`
3. `/Users/dawidapel/COL Tool/src/modules/managers-schedule/AGENTS.md`
4. `/Users/dawidapel/COL Tool/src/modules/managers-schedule/services/torEngine.ts`
5. `/Users/dawidapel/COL Tool/src/modules/managers-schedule/components/TorView.tsx`
6. `/Users/dawidapel/COL Tool/src/modules/managers-schedule/components/RcpAbsenceConflictDialog.tsx`
7. Data samples: `/Users/dawidapel/COL Tool/IMPORT/manager_schedule_events.json`, `manager_schedule_shifts.json`, `manager_schedule_versions.json`
8. Skill: `/Users/dawidapel/COL Tool/.agents/skills/fichajes-pipeline/SKILL.md`
9. Skill: `/Users/dawidapel/COL Tool/.agents/skills/integrity-sentinel/SKILL.md`

YOUR MISSION & OBJECTIVES (R3: TOR Quarterly Accounting & Fichajes RCP Collision Model):
1. Audit TOR (Trzymiesięczny Okres Rozliczeniowy - Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Oct-Dec):
   - Exhaustively analyze the 3-column model:
     - Col 1: RCP (Rejestracja Czasu Pracy / actual clocked hours from MAPAL Fichajes).
     - Col 2: H (Urlop wypoczynkowy / paid vacation).
     - Col 3: L4 (Zwolnienie lekarskie / sick leave).
   - Audit total credited work time formula: H_total = RCP + H_credit + L4_credit.
   - Verify calculation of quarterly balance: Overtime (nadgodziny) vs Undertime (niedogodziny) relative to cumulative quarterly norm.
2. Part-Time FTE Balancing:
   - Audit calculation for part-time managers (0.5 FTE, 0.75 FTE, 0.8 FTE).
   - Investigate how vacation (H) and sick leave (L4) hours are credited: are they credited at 8h or proportionally to FTE (e.g. 4h for 0.5 FTE)?
   - Identify whether the current formula causes false undertime/niedogodziny for part-time staff.
3. Database Resilience & Missing Data:
   - Evaluate engine behavior when database records are missing, incomplete, null, or when an employee has unclocked shifts.
   - Audit null-safety, default fallbacks, and multi-month aggregation robustness.
4. Fichajes RCP vs Absence Collision Detection:
   - Audit collision detection mechanism: when an employee has both an RCP punch (clock-in) and a registered absence (L4 or H) on the same calendar day.
   - Analyze legal consequences under Polish law:
     - Working on L4 invalidates sickness benefit (art. 17 ustawy zasiłkowej) and exposes the store to ZUS audit penalties.
     - Working on H requires formal vacation interruption or cancellation (art. 164-167 KP).
   - Evaluate `RcpAbsenceConflictDialog.tsx` workflows and conflict resolution rules (e.g. override, cancel absence, split shift).

DELIVERABLES:
1. Comprehensive audit report: `/Users/dawidapel/COL Tool/.agents/teamwork/explorer_r3/report_r3_tor_rcp.md`
2. `handoff.md` and `progress.md` in your directory.
3. Send message back to parent orchestrator with concise summary and exact file path.
