# Historia Zmian — Moduł 4: COL Calculator (Cost of Labor Suite)

Rejestr zmian, aktualizacji algorytmicznych i usprawnień technicznych wprowadzanych w Module 4 (COL Calculator).

---




## [v2.9.9] — 2026-11-05
- Bieżąca synchronizacja i optymalizacje modułu.

## [v2.9.8] — 2026-11-05
- Bieżąca synchronizacja i optymalizacje modułu.

## [v2.9.7] — 2026-11-02
- Bieżąca synchronizacja i optymalizacje modułu.

## [v2.9.7] — 2026-11-02
- **Dostosowanie Floty**: Kompatybilność modułu finansowego COL z bazą flotową Janki & Kalisz Amber.

## [v2.9.6] — 2026-11-02
- **Pełna Specyfikacja Architektury**: Uzupełniono `AGENTS.md` o kompletne drzewo plików modułu (7 komponentów arkusza Excel Replica, silniki, typy).
- **Architektura Multi-Store Fleet**: Przejście z pojedynczej kawiarni testowej na uniwersalny model flotowy obsługujący dowolną kawiarnię sieci Starbucks w Polsce.
- **Systemowa Organizacja Stałych**: Utworzono `constants/index.ts` ze stałymi narzutów ZUS 19.48%, PPK 1.5% oraz rezerwy urlopowej 9.24%.
- **Public API Barrel**: Zaktualizowano `index.ts` o pełny eksport `constants`.
- **Reguła Auto-Sync**: Wprowadzono bezwzględną regułę aktualizacji dokumentacji technicznej i historii zmian po modyfikacjach kodu.

## [v2.8.54] — 2026-10-18
- **Multi-Store Dynamic Isolation**: P&L i koszty pracy kalkulowane per wybrana kawiarnia z bazy `store_${safeId}.db`.

## [v2.8.42] — 2026-09-27
- **Integracja Finansowa AOP**: Automatyczne zasilanie `Sales AOP`, `AGC` (średni paragon) i `TOTAL COL %` z bazy AOP.
- **Dynamiczna Estymacja MTD**: Integracja rzeczywistych odbić RCP z MAPAL Fichajes i estymacji transakcji z Modułu 1 w celu prognozowania domknięcia miesiąca.

## [v2.6.0] — 2026-09-08
- **Excel Replica (6 Zakładek)**: Wdrożenie interfejsu repliki oryginalnego arkusza korporacyjnego AmRest:
  - `CALCULATOR`: Główna matryca 4-kolumnowa (Wskaźnik, AOP, Target, Estymacja) + panele personelu MGR i Crew,
  - `BONUS`: Kalkulator premii kwartalnych SM/ASM/SSV,
  - `Rezerwa urlopowa`: Wycena bilansowa niewykorzystanych dni urlopu (dzielnik 21, narzut ZUS 19.5%),
  - `DANE`: Tabele stawek minimalnych, ZUS, dodatków nocnych i katalog 96 kawiarni,
  - `Fields Description`: Słownik 66 wskaźników finansowych i operacyjnych,
  - `USER GUIDE`: Oficjalny przewodnik postępowania dla SM.
- **Automatyczny Most z Modułem 2**: Zasilanie personelu menedżerskiego z `manager_monthly_roster`.

## [v1.0.0] — 2026-08-01
- **Inicjalizacja Modułu COL**: Podstawowy kalkulator Total Cost of Labor i symulator TPLH What-If.
