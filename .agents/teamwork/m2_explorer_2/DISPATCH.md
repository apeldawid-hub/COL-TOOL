# DISPATCH — Milestone 2 Explorer 2: Scalable Store Registry & React View State Isolation (F8, F9)

## Mission
Investigate and design exact implementation blueprints for Features F8 and F9 in the frontend (`src/`):
1. **F8 (Scalable Store Registry for 100+ Stores)**:
   - Inspect `src/constants/starbucksStores.ts` and `src/components/StoreSwitcherModal.tsx`.
   - Design a scalable catalog system supporting 100+ Polish Starbucks stores (with search by city, district, MPK, unit code, store name).
   - Ensure dynamic custom store additions (persisted in `stores_registry.json` or `localStorage`) merge seamlessly with the built-in catalog without duplicates.
   - Ensure `StoreSwitcherModal` renders smoothly (debounced search, virtualized or paginated list) without lag when 100+ stores are loaded.
2. **F9 (React View State Lifecycle Isolation & Reset Handlers)**:
   - Inspect `src/App.tsx` and all major module views: `ManagerScheduleView`, `TrainingsView`, `ColCalculatorView`, `LaborForecastView`.
   - Ensure each view is keyed by `key={currentStore.id}` (or `key={`${currentStore.id}-${activeTab}`}`).
   - Implement global store transition events:
     * `sbx:store-switching`: triggers state reset, cancels pending debounces/queries.
     * `sbx:store-switched`: triggers fresh fetch for the newly selected store.
   - Verify that switching stores never leaves stale state, uncommitted edits, or cross-store cached computations in React memory.

## Reference Documents
- `/Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md` (MUST read first)
- `/Users/dawidapel/COL Tool/PROJECT.md`
- `/Users/dawidapel/COL Tool/src/App.tsx`
- `/Users/dawidapel/COL Tool/src/constants/starbucksStores.ts`
- `/Users/dawidapel/COL Tool/src/components/StoreSwitcherModal.tsx`

## Deliverables
Write `/Users/dawidapel/COL Tool/.agents/teamwork/m2_explorer_2/handoff.md` with:
- Current state analysis of `StoreSwitcherModal`, `starbucksStores.ts`, and `App.tsx`
- Exact code blueprints for extended store registry and fast search filtering
- Exact code blueprints for React view keying and event-driven store lifecycle reset


## 2026-10-24T02:48:24Z
Read /Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md and /Users/dawidapel/COL Tool/.agents/teamwork/m2_explorer_2/DISPATCH.md.
Working Directory: /Users/dawidapel/COL Tool/.agents/teamwork/m2_explorer_2.
Your role: M2 Explorer 2 (Scalable Store Registry & React View State Isolation).
Investigate src/constants/starbucksStores.ts, src/components/StoreSwitcherModal.tsx, and src/App.tsx. Design the exact implementation blueprint for Features F8 and F9:
- Scalable store catalog for 100+ stores with fast search/virtualization and custom store persistence.
- React view state lifecycle isolation (keying module views by `key={currentStore.id}` and event-driven store switching resets).
Write your findings and code blueprints to /Users/dawidapel/COL Tool/.agents/teamwork/m2_explorer_2/handoff.md. Then notify parent via send_message.
