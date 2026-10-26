# Progress — M2 Explorer 2 (Scalable Store Registry & React View State Isolation)

Last visited: 2026-10-24T02:56:00Z

## Status
- [x] Initialized DISPATCH.md and BRIEFING.md
- [x] Inspected `src/constants/starbucksStores.ts` (currently 37 stores, missing nationwide Polish coverage)
- [x] Inspected `src/components/StoreSwitcherModal.tsx` (unvirtualized list, un-debounced search input, full re-renders)
- [x] Inspected `src/App.tsx` and all view components (`ManagerScheduleView`, `TrainingsView`, `ColCalculatorView`, `LaborForecastView`)
- [x] Discovered critical isolation bugs: views lack `key={currentStore.id}`, local view state persists across switches, no in-flight debounce cancellation, cross-store data leakage risk
- [x] Investigated store state storage, onboarding flow, and custom store creation in `storeService.ts` and `db.ts`
- [x] Formulated detailed blueprints for Feature F8:
  - 125-store national catalog with authentic Polish locations, MPKs, Unit Codes, and Districts
  - Polish diacritic folding (`normalizeDiacritics`)
  - Multi-key deduplication (`id`, `mpk`, `unitCode`)
  - Virtualized list windowing (`useVirtualList` with 76px item height)
  - Keyboard navigation and instant responsive debounced search
- [x] Formulated detailed blueprints for Feature F9:
  - View keying via `key={`store-${currentStore.id}-${activeModule}`}`
  - Two-phase store transition event bus: `sbx:store-switching` (pre-switch aborts & timeout cancellation) and `sbx:store-switched` (post-switch fresh hydration)
  - Reusable `useStoreLifecycle` hook with AbortController and timer cleanup
  - Top-level `SaveShield` to prevent cross-database debounce race conditions
- [x] Completed 5-component handoff report in `handoff.md`
- [x] Ready to notify parent via `send_message`
