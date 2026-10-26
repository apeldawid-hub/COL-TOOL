# BRIEFING — 2026-10-24T00:40:00Z

## Mission
Execute Milestone 1: Deep Codebase Audit, Mock Purge & Onboarding Flow (Features F1, F2, F3, F4, F5). Purge all static store fallbacks (108120/18120/384/Janki), mock data/salaries/users/training partners, eliminate AI filler texts, parameterize Electron SQL queries & importers with active store metadata, and ensure clean launch onboarding flow.

## 🔒 My Identity
- Archetype: teamwork_preview_worker
- Roles: implementer, qa, specialist
- Working directory: /Users/dawidapel/COL Tool/.agents/teamwork/m1_worker_1
- Original parent: 53bb484f-c139-4c15-89f6-7d840b96f7e4
- Milestone: Milestone 1: Deep Codebase Audit, Mock Purge & Onboarding Flow

## 🔒 Key Constraints
- DO NOT CHEAT: All implementations must be genuine. No dummy implementations, no hardcoding.
- Maintain minimal change principle: make precise, surgical modifications.
- Preserve company catalogs (Starbucks shift codes, KP art. 130 working norms, store catalogs).
- Ensure TypeScript and Vite compile cleanly with 0 errors (`npm run build`).
- Update progress.md with timestamped heartbeats after every meaningful step.
- Deliver self-contained handoff report following Handoff Protocol.

## Current Parent
- Conversation ID: 53bb484f-c139-4c15-89f6-7d840b96f7e4
- Updated: not yet

## Task Summary
- **What to build**: Implement F1 (remove static store fallbacks), F2 (purge mock data, fake rosters/salaries, fake partners, admin mock data), F3 (remove AI filler text), F4 (clean launch store onboarding flow in db.ts, main.ts, App.tsx), and F5 (parameterize Electron SQL queries and importers).
- **Success criteria**: Zero hardcoded logic fallbacks to 18120/108120/384, zero AI filler text, clean onboarding on empty profile, parameterized SQL queries, 0 TypeScript/Vite errors on build.
- **Interface contracts**: PROJECT.md and m1_explorer_1, m1_explorer_2, m1_explorer_3 handoff reports.
- **Code layout**: Electron SQLite backend in `electron/`, frontend components in `src/`.

## Key Decisions Made
- Adopting exact blueprints from m1_explorer_1, m1_explorer_2, and m1_explorer_3 handoff reports.
- Preserving special payroll calculation rows in colDefaultData.ts with zeroed monetary amounts.
- Preserving statutory shift codes and KP monthly norms in SQLite.

## Artifact Index
- `.agents/teamwork/m1_worker_1/DISPATCH.md` — Assignment and dispatch history
- `.agents/teamwork/m1_worker_1/BRIEFING.md` — Persistent agent memory and tracker
- `.agents/teamwork/m1_worker_1/progress.md` — Heartbeat and step log
- `.agents/teamwork/m1_worker_1/handoff.md` — Final handoff report

## Change Tracker
- **Files modified**: None yet
- **Build status**: Pending initial run
- **Pending issues**: None

## Quality Status
- **Build/test result**: Pending
- **Lint status**: Pending
- **Tests added/modified**: Pending

## Loaded Skills
- None
