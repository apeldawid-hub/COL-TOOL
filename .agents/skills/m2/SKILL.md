---
name: m2
description: Moduł 2: Managers Schedule — matryca grafiku kierowniczego, tarcza Kodeksu Pracy (11h/35h, 4. niedziela), AutoScheduler AI (2k), TOR Q1-Q4 i wsparcia.
---

# /m2 — Managers Schedule (Grafik Managerski)

Gdy użytkownik wywołuje `/m2`:
1. Zawęź kontekst operacyjny do katalogu: `src/modules/managers-schedule/`.
2. Zapoznaj się z regułami prawnymi i algorytmami w `src/modules/managers-schedule/AGENTS.md`.
3. Pamiętaj o standardach:
   - Kodeks Pracy: odpoczynek dobowy min. 11h, tygodniowy min. 35h, max. 3 pracujące niedziele z rzędu.
   - Urlopy `H` i chorobowe `L4` liczą się do etatu wyłącznie w dni robocze ($8.0\text{h} \times \text{etat}$), w weekendy 0.0h.
   - AutoScheduler AI operuje na 2 000 prób (`2k`) z wczesnym zatrzymaniem.
   - Wsparcia międzykawiarniane (`interStoreSupportEngine.ts`) rozliczają 3 scenariusze.
4. Po modyfikacji kodu zaktualizuj `src/modules/managers-schedule/AGENTS.md` oraz zarejestruj wpis w `src/modules/managers-schedule/CHANGELOG.md`.
