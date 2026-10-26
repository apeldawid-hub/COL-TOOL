# BRIEFING — 2026-10-24T02:54:00Z

## Mission
Investigate and design the exact implementation blueprints for Features F8 (Scalable Store Registry for 100+ Stores) and F9 (React View State Lifecycle Isolation & Reset Handlers).

## 🔒 My Identity
- Archetype: explorer
- Roles: M2 Explorer 2 (Scalable Store Registry & React View State Isolation)
- Working directory: /Users/dawidapel/COL Tool/.agents/teamwork/m2_explorer_2
- Original parent: 53bb484f-c139-4c15-89f6-7d840b96f7e4
- Milestone: Milestone 2 — Features F8 & F9

## 🔒 Key Constraints
- Read-only investigation — do NOT implement in `src/` or `electron/`
- Design exact, copy-pasteable implementation blueprints for Features F8 and F9
- Deliver handoff.md following the 5-component protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method)
- Communicate all completion notifications to caller parent agent via send_message

## Current Parent
- Conversation ID: 53bb484f-c139-4c15-89f6-7d840b96f7e4
- Updated: 2026-10-24T02:48:24Z

## Investigation State
- **Explored paths**:
  - `ORIGINAL_REQUEST.md`, `PROJECT.md`, `DISPATCH.md`
  - `src/constants/starbucksStores.ts` (37 hardcoded stores, needs expansion to 100+ stores across Poland)
  - `src/services/storeService.ts` (deduplication logic and disk persistence via Electron IPC)
  - `src/context/StoreContext.tsx` (store switching event flow)
  - `src/components/StoreSwitcherModal.tsx` (unvirtualized list, un-debounced search input, full re-renders)
  - `src/App.tsx` (all views rendered without `key`, no lifecycle aborts or state resets on store switch)
  - `src/modules/managers-schedule/components/ManagerScheduleView.tsx` (holds internal state not keyed by store)
  - `src/modules/trainings/components/TrainingsView.tsx` (does not reload data on store switch)
  - `src/modules/col-calculator/components/ColCalculatorView.tsx` (retains old store managers/rates on switch)
  - `src/modules/labor-forecast/components/LaborForecastView.tsx`
  - `src/services/sync/syncEngine.ts` & `src/services/todoService.ts`
  - `electron/database/db.ts` (`switchStoreDatabase`, `custom_stores.json`)
- **Key findings**:
  - Critical Cross-Store Data Leakage: When switching stores, React preserves module instances because views lack `key={currentStore.id}`. In-flight debounce timers (e.g. `saveWeeklyTrx`) fire against the newly switched SQLite DB, corrupting data.
  - Scale Bottleneck: 100+ stores in unvirtualized `StoreSwitcherModal` causes laggy typing and DOM bloating.
  - Search Usability: Lack of Polish diacritic normalization breaks search (e.g. typing "krakow" fails to find "Kraków").
- **Unexplored areas**: None. All core paths for F8 and F9 have been thoroughly investigated.

## Key Decisions Made
- Architecture F8: Expand catalog to 120+ authentic Polish Starbucks locations; introduce normalizer, multi-field diacritic-insensitive search engine, custom store deduplication, and a lightweight zero-dependency virtualized list (`useVirtualList`) for 60fps scrolling in `StoreSwitcherModal`.
- Architecture F9: Mandate view keying in `App.tsx` via `key={`store-${currentStore.id}-${activeModule}`}`; implement two-phase store transition event bus (`sbx:store-switching` to cancel in-flight debounces/abort requests and reset view state, followed by `sbx:store-switched` to re-fetch); provide `useStoreLifecycle` hook for component isolation.

## Artifact Index
- `.agents/teamwork/m2_explorer_2/DISPATCH.md` — Task dispatch instructions
- `.agents/teamwork/m2_explorer_2/BRIEFING.md` — Working memory and situational awareness
- `.agents/teamwork/m2_explorer_2/progress.md` — Liveness heartbeat and step tracking
- `.agents/teamwork/m2_explorer_2/handoff.md` — Final 5-component handoff report
