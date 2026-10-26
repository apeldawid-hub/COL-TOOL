# Execution Plan: Module 2 (Managers Schedule) 360° Comprehensive Audit

## Strategy & Approach
We execute this comprehensive audit strictly in Design & Audit Mode (zero source code mutations). All investigations, code analysis, edge-case testing, and UX assessments are performed by specialized subagents reporting to `.agents/teamwork/`.

## Phase 1: Parallel Exploration (Milestones M1, M2, M3)
Dispatch 3 specialized Explorers in parallel:
1. **Explorer R1 (M1: Labor Code & Janki Standards)**:
   - Working Directory: `.agents/teamwork/explorer_r1/`
   - Investigate `src/modules/managers-schedule/services/managerScheduleEngine.ts`, `components/LaborLawComplianceModal.tsx`, `components/LaborLawViolationDialog.tsx`, `constants/defaultShifts.ts`, and `AGENTS.md`.
   - Verify KP art. 130, 132 (11h rest), 133 (35h weekly rest), 135 (12h daily limit), 151^10 (4th Sunday), 154^2 and 166 (holidays and leaves).
   - Evaluate boundary continuity: $M-1 \rightarrow D_1$ and $D_{\text{last}} \rightarrow M+1$.
   - Evaluate Janki 108120 rules: 32h/day floor hours, 7 trading Sundays vs non-trading Sundays, AMN/PMN shifts.
   - Document at least 3 critical edge cases (e.g., year/quarter boundary, FTE change mid-month, holiday coinciding with trading Sunday).
   - Compare with reference sheet `Grafik/Grafik wrzesień Janki 2026.xlsm`.

2. **Explorer R2 (M2: AutoScheduler AI & Web Worker Architecture)**:
   - Working Directory: `.agents/teamwork/explorer_r2/`
   - Investigate `src/modules/managers-schedule/services/autoSchedulerEngine.ts`, `components/AutoScheduleModal.tsx`, `components/AutoScheduleWidget.tsx`.
   - Analyze 20,000 attempts Monte Carlo solver loop: time complexity, UI freeze / main thread blocking, batching mechanism (`yield` / `setTimeout` vs Web Worker).
   - Formulate concrete Web Worker / Worker Threads architecture: worker lifecycle, message passing interface, structured cloning / state serialization.
   - Audit Fairness & Equity heuristics: weekend distribution balance, closing shift rotation, 2 consecutive days OFF, weekly hours corridors, and deadlock negotiation assistant.

3. **Explorer R3 (M3: TOR Quarterly Accounting & Fichajes RCP Collision Model)**:
   - Working Directory: `.agents/teamwork/explorer_r3/`
   - Investigate `src/modules/managers-schedule/services/torEngine.ts`, `components/TorView.tsx`, `components/RcpAbsenceConflictDialog.tsx`, `IMPORT/manager_schedule_*.json`.
   - Audit 3-column model (RCP, H, L4) across Q1–Q4.
   - Verify handling of part-time FTE employees to avoid false deficit calculation.
   - Check resilience to missing database records, unpunched shifts, null values.
   - Examine collision detection logic between RCP clock-in actuals and scheduled absences (L4/H).

## Phase 2: Synthesis & Architectural / UX Recommendations (Milestone M4)
Dispatch Explorer R4 / Critic to synthesize and design the improvements:
- Working Directory: `.agents/teamwork/explorer_r4/`
- Prioritize improvements into:
  - Quick Wins (immediate low-risk fixes)
  - Medium-Term Architectural Refactorings (e.g., Web Worker solver, typed contracts)
  - Long-Term Innovations (e.g., multi-objective genetic / constraint satisfaction solver)
- Back-office Store Manager UX/UI ergonomics: table density, keyboard navigation, modal cognitive load, offline/laptop performance.
- Compile concrete RFCs with data models, message schemas, and mathematical formulations.

## Phase 3: Comprehensive Final Report & Forensic Audit (Milestone M5)
1. Synthesize all subagent findings into `/Users/dawidapel/COL Tool/.agents/teamwork/orchestrator_2/FINAL_REPORT.md`.
2. Dispatch a Forensic Auditor (`teamwork_preview_auditor`) to verify:
   - Zero source code modifications in `src/` (`git status` is clean).
   - All acceptance criteria are thoroughly satisfied.
   - No mock, fake, or unsubstantiated claims.
3. Record gate status in `GATE_STATUS.md`.
4. Send final completion message and victory claim to Sentinel (`b126f5f0-cbe6-4cf2-803f-91ea557f1097`).
