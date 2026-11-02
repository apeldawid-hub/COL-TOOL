# Historia Zmian — Moduł 2: Managers Schedule (Grafik Managerski)

Rejestr zmian, aktualizacji algorytmicznych i usprawnień technicznych wprowadzanych w Module 2 (Managers Schedule).

---

## [v2.9.6] — 2026-11-02
- **Synchronizacja Architektury**: Uzupełniono specyfikację techniczną w `AGENTS.md` o moduł wsparcia międzykawiarnianego (`InterStoreSupportModal.tsx`, `interStoreSupportEngine.ts`) oraz stałe zmian (`constants/defaultShifts.ts`).
- **Korekta Parametrów AutoScheduler AI**: Ujednolicono w dokumentacji domyślną liczbę iteracji do 2 000 prób (`2k`) zgodnie z implementacją w `autoSchedulerEngine.ts`.
- **Systemowa Organizacja Stałych**: Utworzono `constants/index.ts` konsolidujący reguły KP (11h/35h, 4. niedziela), Floor 32h/224h oraz solver AI (2k).
- **Public API Barrel**: Zaktualizowano `index.ts` o pełny eksport `types` oraz `constants`.
- **Reguła Auto-Sync**: Wprowadzono bezwzględną regułę aktualizacji dokumentacji po modyfikacjach kodu.

## [v2.8.63] — 2026-10-24
- **Ergonomia Siatki Grafiku**: Przypięte kolumny (`sticky`) z nazwiskami i etatami menedżerów podczas horyzontalnego przewijania 31 dni.
- **Skróty Klawiaturowe M/S**: Szybkie przełączanie widoku Miesięcznego i Tygodniowego bez konieczności klikania myszą.
- **Ujednolicenie Norm TOR (H / L4)**: Wprowadzenie ścisłego wliczania godzin urlopu i chorobowego wyłącznie w dni robocze (art. 154² § 1 KP) oraz zerowanie w weekendy/święta.

## [v2.8.62] — 2026-10-19
- **AutoScheduling AI dla Osób w Szkoleniu**: Automatyczne uwzględnianie i planowanie zmian szkoleniowych (`TAM`/`TPM`) dla menedżerów w trakcie wdrożenia (`in_training`).

## [v2.8.58] — 2026-10-19
- **Autonomiczne Składy Miesięczne**: Rozszerzenie tabeli `manager_monthly_roster` o persystencję per kawiarnia, automatyczne klonowanie z miesiąca $M-1$ i edycję w `ManagerTeamModal`.

## [v2.8.30] — 2026-09-21
- **Katalog Zmian Starbucks**: Rozszerzenie listy zmian o specyficzne kody Starbucks (np. `PRE`, `MEE`, `BT`, `SAM`, `SPM`, `SUP`), blokada zmian niedzielnych w dni powszednie w `ShiftPickerPopover`.

## [v2.8.0] — 2026-09-15
- **AutoScheduling AI (2k prób)**: Autonomiczny generator grafiku menedżerskiego z zaawansowaną heurystyką, twardymi ograniczeniami Kodeksu Pracy (11h/35h, 4. niedziela), dyspozycjami i preferencjami zespołu.
- **Floating Speed-Dial Navigation Hub (`AutoScheduleWidget`)**: Pływający widget z radialnym wskaźnikiem normy miesiąca, TOR oraz skrótami do generatora AI.

## [v2.7.0] — 2026-09-12
- **Trzymiesięczny Okres Rozliczeniowy (TOR)**: Dedykowany widok kwartalny Q1–Q4 (`TorView.tsx`, `torEngine.ts`) z bilansowaniem nadgodzin i niedogodzin.
- **Integracja MAPAL Fichajes RCP**: Zasilanie kolumn godzin rzeczywistych prosto z zaimportowanych ewidencji odbić i detekcja kolizji z absencjami L4/H.

## [v1.0.0] — 2026-08-01
- **Siatka Grafiku Managerskiego**: Bazowa miesięczna matryca planowania, tarcza Kodeksu Pracy (art. 130, 132, 133 KP) i eksport Excel.
