# DISPATCH: Milestone 1 Explorer 2 (Mock Rosters, Fake Salaries & Admin Mock Data)

Your working directory: /Users/dawidapel/COL Tool/.agents/teamwork/m1_explorer_2
Role: teamwork_preview_explorer
Original Request: /Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md
Project Root: /Users/dawidapel/COL Tool
Project Architecture: /Users/dawidapel/COL Tool/PROJECT.md
Survey 1 Handoff: /Users/dawidapel/COL Tool/.agents/teamwork/survey_explorer_1/handoff.md

## Scope: Feature F2 (Mock Data Purge)
Focus on identifying and formulating the exact removal of fake employee records, mock salaries, and fake metrics:
- `electron/database/db.ts`:
  * `seedDemoManagerTeamAndShifts()` (7 managers with rates/salaries)
  * `seedMonthlyRosters()` (8 managers for July, August, Sept)
  * `getTrainingPartners()` (auto-injecting Kacper Wiśniewski and Maja Zielińska)
- `src/modules/col-calculator/services/colDefaultData.ts`:
  * `DEFAULT_COL_MANAGERS` (6 named managers with base salaries 7200, 6300, etc.)
  * `DEFAULT_COL_CREW_UOP` (2 baristas)
  * `DEFAULT_COL_CREW_UZ` (20 baristas with hourly rates)
  * `DEFAULT_COL_KPIS` and `DEFAULT_COL_OTHER_COSTS`
- `src/services/admin/adminService.ts`:
  * `initDefaults()` (Dawid Apel, Kamil Kamiński, Zuzanna Makowska, Piotr Wiśniewski request)
- `src/services/auth/authService.ts`:
  * `quickLoginStoreManager()` defaults and fallback user creation
- `src/services/firebaseTelemetryService.ts`:
  * `getDefaultLocalData()` mock installations

Formulate exact clean state replacements (empty arrays, dynamic derivation from SQLite/active store) for the Worker.
Write your findings to `/Users/dawidapel/COL Tool/.agents/teamwork/m1_explorer_2/handoff.md`.

## 2026-10-24T00:26:38Z
You are m1_explorer_2 for Milestone 1.
Working directory: /Users/dawidapel/COL Tool/.agents/teamwork/m1_explorer_2
Read /Users/dawidapel/COL Tool/.agents/teamwork/m1_explorer_2/DISPATCH.md, /Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md, /Users/dawidapel/COL Tool/PROJECT.md, and /Users/dawidapel/COL Tool/.agents/teamwork/survey_explorer_1/handoff.md.

Task: Formulate exact implementation instructions for Feature F2 (Mock data & fake rosters purge) across db.ts, colDefaultData.ts, adminService.ts, and authService.ts.
Maintain progress.md and write your recommendations to handoff.md.
