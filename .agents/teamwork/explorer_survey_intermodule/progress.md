# Progress — explorer_survey_intermodule

Last visited: 2026-10-24T00:48:30Z

## Status: IN_PROGRESS
- [x] Initialized DISPATCH.md and BRIEFING.md
- [ ] Read module AGENTS.md files:
  - [ ] `src/modules/labor-forecast/AGENTS.md`
  - [ ] `src/modules/managers-schedule/AGENTS.md`
  - [ ] `src/modules/trainings/AGENTS.md`
  - [ ] `src/modules/col-calculator/AGENTS.md` (if exists)
- [ ] Deep exploration of Module 1 (Labor Forecast):
  - [ ] AOP data structure (`Sales AOP`, `TRX AOP`, `TPLH AOP`)
  - [ ] MTD velocity calculation & trends
  - [ ] HANW calculation & Floor Hours enforcement (32h/day)
- [ ] Deep exploration of Module 2 (Managers Schedule & Fichajes RCP):
  - [ ] Manager roster schema (`manager_monthly_roster`), contract types (UoP, FTEs), base salaries, and scheduled shifts
  - [ ] Two-track Estimation column: past days actuals from MAPAL Fichajes RCP vs future days scheduled hours
  - [ ] Absence tracking: sick leave L4 (80% / 20% employer reduction rules) and vacation leaves (H)
  - [ ] Collision detection & sync mechanisms
- [ ] Deep exploration of Module 3 (Trainings):
  - [ ] Structure of barista training hours (sessions T1-T10)
  - [ ] Transfer mechanism to Non-Coverage budget (`TRAINING` 75h) without penalizing Floor Hours
- [ ] Explore existing Module 4 (`src/modules/col-calculator`) code and shared bridges/types
- [ ] Synthesize findings into concrete TypeScript interfaces and data flow architecture
- [ ] Write `report.md`
- [ ] Write `handoff.md`
- [ ] Send completion message to Orchestrator 3
