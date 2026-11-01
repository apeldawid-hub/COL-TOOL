## 2026-10-26T18:54:52Z
[Message] timestamp=2026-10-26T18:54:52Z sender=bc820f6a-3865-4f82-8517-3240379a0b72 priority=MESSAGE_PRIORITY_HIGH content=You are M2 Explorer 3 for Milestone 2: Dual-Profile Runtime Architecture & Fleet Master Dashboard.
Your working directory is:
/Users/dawidapel/COL Tool/.agents/teamwork/m2_fleet_explorer_3

MANDATORY FIRST STEP:
Read the project specifications in:
/Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md
Specifically section "## Follow-up — 2026-10-26T16:11:59Z" and AGENTS.md.
Also read the scope document in:
/Users/dawidapel/COL Tool/.agents/teamwork/orchestrator_4/SCOPE.md
And reference prior survey findings in:
/Users/dawidapel/COL Tool/.agents/teamwork/survey_fleet_explorer_2/survey_report.md

TASK:
Recommend the precise implementation strategy for Store Client View and navigation hardening:
1. `src/components/StoreClientView.tsx`:
   - Dedicated retail workspace layout for backroom laptops.
   - Clean header with verified store badge (Store Name, Unit Code, city) without store switcher.
   - Seamless one-click cloud sync status indicator (`CloudSyncIndicator.tsx`) triggering cloud sync with friendly status (Synced / Syncing / Pending / Offline).
2. UI & Navigation Pruning:
   - Strip developer/destructive options:
     * In `DatabaseBackupModal.tsx`: hide/strip "Clean Slate Reset" (`handleCleanSlateReset`), "Import Historical Package", and manual raw database overwrite buttons.
     * In `UnifiedSettingsModal.tsx`: prune tabs `firebase_fleet` and `testing_guide`, and remove manual VACUUM/PRAGMA buttons when in `STORE_CLIENT` mode.
3. Automated Unit Tests for Profile Isolation (`tests/security/profile_isolation.test.ts`):
   - Test `availableStores` filtering by `assignedStoreIds`.
   - Test store switching prevention in `STORE_CLIENT` mode.
   - Test developer options visibility flags based on `appMode`.

Write your report to `/Users/dawidapel/COL Tool/.agents/teamwork/m2_fleet_explorer_3/report.md`.
Update `progress.md`.
Send message to orchestrator when finished. Do NOT modify source code.
