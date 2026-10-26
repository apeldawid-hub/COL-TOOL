## 2026-10-24T00:29:53Z
You are Explorer R1 for Module 2 (Managers Schedule) Audit in the Starbucks Operations Suite project.

Your Working Directory:
/Users/dawidapel/COL Tool/.agents/teamwork/explorer_r1/

CRITICAL CONSTRAINTS:
- STRICT DESIGN & AUDIT MODE: Zero modifications to any source code files in `src/` or anywhere in the repository. Do not edit, create, or delete any source files.
- Store all your artifacts, notes, and final reports inside your assigned working directory: `/Users/dawidapel/COL Tool/.agents/teamwork/explorer_r1/`.

MANDATORY INPUTS TO READ:
1. `/Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md` (read especially `## Follow-up — 2026-10-24T00:24:55Z`).
2. `/Users/dawidapel/COL Tool/AGENTS.md`
3. `/Users/dawidapel/COL Tool/src/modules/managers-schedule/AGENTS.md`
4. `/Users/dawidapel/COL Tool/src/modules/managers-schedule/services/managerScheduleEngine.ts`
5. `/Users/dawidapel/COL Tool/src/modules/managers-schedule/components/LaborLawComplianceModal.tsx`
6. `/Users/dawidapel/COL Tool/src/modules/managers-schedule/components/LaborLawViolationDialog.tsx`
7. `/Users/dawidapel/COL Tool/src/modules/managers-schedule/constants/defaultShifts.ts`
8. Skill: `/Users/dawidapel/COL Tool/.agents/skills/labor-law-sentinel/SKILL.md`
9. Reference sheet: `/Users/dawidapel/COL Tool/Grafik/Grafik wrzesień Janki 2026.xlsm` (inspect structure, shift codes, formulas, summary tables using python or appropriate tools).

YOUR MISSION & OBJECTIVES (R1: Labor Code & Janki Standards Audit):
1. Exhaustively audit legal compliance against the Polish Labor Code:
   - art. 130 KP: Monthly work norm calculation formula (40 * W + 8 * R - 8 * S), deduction of public holidays falling on days other than Sunday.
   - art. 132 KP: 11h daily unbroken rest period between consecutive shifts.
   - art. 133 KP: 35h weekly continuous rest period (including at least 11h daily rest).
   - art. 135 KP: 12h maximum daily shift limit in equivalent work system (system równoważny).
   - art. 151^10 KP: Mandatory at least one Sunday free from work every 4 consecutive weeks.
   - art. 154^2 and art. 166 KP: Vacation/holiday leave (H) and sick leave (L4) impact on work time norm and deductions.
2. Monthly boundary transitions:
   - Audit rest period continuity across month boundaries: M-1 -> D1 and D_last -> M+1.
   - Examine how the codebase handles prior month trailing shifts and forward month leading shifts.
3. Starbucks Store 108120 CH Janki operational rules:
   - 7 trading Sundays vs non-trading Sundays in CH Janki.
   - Shift codes: AMN / PMN (management coverage on non-trading days).
   - Floor hours base: 32.0h/day (1 AM + 1 Barista AM + 1 PM + 1 Barista PM), 224.0h/week.
4. Document at least 3 critical edge cases with concrete calculations and code line citations:
   - Edge Case 1: Year/quarter boundary transitions (e.g. Dec -> Jan with New Year and Epiphany / Jan 6).
   - Edge Case 2: Employee transitioning FTE (wymiar etatu, e.g. 0.5 -> 1.0 FTE or vice versa) mid-month.
   - Edge Case 3: Public holiday coinciding with a trading Sunday or Saturday.
5. Reference Sheet Parity:
   - Compare codebase rules with `Grafik/Grafik wrzesień Janki 2026.xlsm`. Verify shift abbreviations, hours, day columns, and totals.

DELIVERABLES:
1. Comprehensive audit report: `/Users/dawidapel/COL Tool/.agents/teamwork/explorer_r1/report_r1_labor_code.md`
2. `handoff.md` and `progress.md` in your directory.
3. Send message back to parent orchestrator with concise summary and exact file path.
