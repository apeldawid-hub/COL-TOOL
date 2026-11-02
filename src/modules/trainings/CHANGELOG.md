# Historia Zmian — Moduł 3: Szkolenia (Starbucks Training Suite)

Rejestr zmian, aktualizacji algorytmicznych i usprawnień technicznych wprowadzanych w Module 3 (Starbucks Training Suite).

---

## [v2.9.6] — 2026-11-02
- **Synchronizacja Architektury**: Uzupełniono specyfikację techniczną w `AGENTS.md` o kompletne drzewo plików (`types/index.ts`, serwisy, komponenty).
- **Systemowa Organizacja Stałych**: Utworzono `constants/index.ts` dla cyklu First 30 Days, kodów T1-T10 i modułów Skill Check.
- **Public API Barrel**: Zaktualizowano `index.ts` o pełny eksport `constants`.
- **Reguła Auto-Sync**: Wprowadzono bezwzględną regułę aktualizacji dokumentacji technicznej i historii zmian po modyfikacjach kodu.

## [v2.8.56] — 2026-10-18
- **Integracja Chmurowa Materiałów Szkoleniowych**: Odciążenie lokalnego pakietu aplikacji, bezpieczny dostęp do biblioteki standardów i materiałów treningowych w Firestore/Storage (100% bez PII).

## [v2.8.30] — 2026-09-21
- **Integracja Budżetu NC**: Synchronizacja godzin szkoleniowych z budżetem Non-Coverage (`nc_rules`) w Module 1 i 4 bez obciążania Floor Hours kawiarni.

## [v2.6.0] — 2026-09-08
- **Cyfrowe Arkusze Egzaminacyjne Skill Check**: Implementacja oficjalnych arkuszy certyfikacyjnych:
  - Rutyna Spieniania Mleka (5 kroków),
  - Espresso Bar Skill Check #1,
  - Cold Beverage Station Skill Check #2,
  - 4-etapowy Model Nauczania Barista Trener (Prepare, Present, Practice, Follow-up).
- **The Barista Journey**: Oś czasu rozwoju pracownika (First 30, Barista 90, Barista 180, Barista Trener, Coffee Master).
- **Harmonogram Zmian Szkoleniowych T**: Szablony sesji `T1`–`T10` z automatycznym podziałem godzin na Baristę (T), Barista Trenera (T) i Store Managera (T).

## [v1.0.0] — 2026-08-01
- **Inicjalizacja Modułu Szkoleń**: Struktura bazy danych `training_partners` oraz rejestracja postępów baristów w programie wdrożeniowym First 30.
